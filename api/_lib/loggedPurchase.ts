import type { VercelRequest } from '@vercel/node'
import type { User } from '@supabase/supabase-js'
import type { createSupabaseAdmin } from './supabaseAdmin.js'
import { getPixPlan, ADMIN_ONLY_PLANS, isPixPlanId, type PixPlan } from './pixPlans.js'

type AdminClient = ReturnType<typeof createSupabaseAdmin>

// As mensagens chegam à tela de assinatura: português, sem detalhe técnico.
const SESSION_ERROR = 'Sua sessão expirou. Entre de novo.'

export type LoggedPurchaseCheck =
  | { user: User; plan: PixPlan }
  | { status: number; error: string }

/**
 * Validações comuns às compras avulsas (Pix e cartão) feitas por quem já está
 * logada: token, plano, plano restrito a admin e conflito com assinatura
 * recorrente ativa. `conflictMessage` muda por rota porque o aviso depende de
 * qual método a aluna estava tentando usar.
 */
export async function checkLoggedPurchase(
  req: VercelRequest,
  admin: AdminClient,
  conflictMessage: string,
): Promise<LoggedPurchaseCheck> {
  const authHeader = (req.headers.authorization as string) || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return { status: 401, error: SESSION_ERROR }

  const planId = req.body?.plan
  if (!isPixPlanId(planId)) return { status: 400, error: 'Plano inválido.' }
  // O valor sai daqui, nunca do corpo da requisição.
  const plan = getPixPlan(planId)

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return { status: 401, error: SESSION_ERROR }
  const user = userData.user

  // O plano de verificação custa R$ 0,01. Sem esta checagem no SERVIDOR,
  // bastaria mandar {"plan":"teste"} na requisição para assinar por um
  // centavo — esconder na interface não protegeria nada.
  if (ADMIN_ONLY_PLANS.includes(planId)) {
    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
    if (!profile?.is_admin) return { status: 403, error: 'Plano indisponível.' }
  }

  // Regra de conflito (decisão P0.3 do docs/PLANO-PIX.md): quem tem assinatura
  // recorrente viva no cartão não pode pagar de novo, senão seria cobrada duas
  // vezes. Assinatura no cartão já cancelada (mesmo que ainda dentro do
  // período pago) não bloqueia — não vai gerar cobrança nova. E avulso sobre
  // avulso é justamente a renovação, que soma período no webhook.
  const { data: existing } = await admin
    .from('subscriptions')
    .select('source, status')
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing && existing.source === 'preapproval' && existing.status === 'authorized') {
    return { status: 409, error: conflictMessage }
  }

  return { user, plan }
}

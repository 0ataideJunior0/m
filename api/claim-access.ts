import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { sessionCameFromEmailLink } from './_lib/jwtAmr.js'

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>

const STEPS = ['link_opened', 'password_set'] as const
type Step = (typeof STEPS)[number]

function isStep(value: unknown): value is Step {
  return typeof value === 'string' && (STEPS as readonly string[]).includes(value)
}

/**
 * Passos do primeiro acesso de quem pagou no checkout aberto, registrados pela
 * própria aluna com a sessão aberta pelo link do e-mail.
 *
 *   link_opened  — a sessão nasceu de um link enviado ao e-mail (amr), logo a
 *                  pessoa controla a caixa de entrada: grava o e-mail como
 *                  provado. É a trava contra tomada de conta: quem cadastrou um
 *                  e-mail alheio nunca chega aqui. Sessão de senha (ou sem
 *                  amr) NÃO prova nada e leva 403.
 *   password_set — a senha acabou de ser criada na mesma sessão, então não exige
 *                  o amr; exige, porém, e-mail já provado (link_opened antes).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = (req.headers.authorization as string) || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' })
    return
  }

  const step = req.body?.step
  if (!isStep(step)) {
    res.status(400).json({ error: 'Invalid step' })
    return
  }

  const supabaseAdmin = createSupabaseAdmin()
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData.user) {
    res.status(401).json({ error: 'Invalid session' })
    return
  }
  const userId = userData.user.id

  try {
    if (step === 'link_opened') {
      // O payload só é lido depois do getUser ter validado a assinatura.
      if (!sessionCameFromEmailLink(token)) {
        res.status(403).json({ error: 'Sessão não veio do link do e-mail' })
        return
      }

      // ignoreDuplicates: quem já está provada (inclusive 'legacy') fica como está.
      const { error } = await supabaseAdmin
        .from('email_verifications')
        .upsert({ user_id: userId, method: 'link' }, { onConflict: 'user_id', ignoreDuplicates: true })
      if (error) throw error

      await stampLatestPaidIntent(supabaseAdmin, userId, 'link_opened_at')
    } else {
      // Sem prova de e-mail, quem cadastrou a conta com o e-mail de outra
      // pessoa (e uma senha) carimbaria a compra dela e silenciaria o reenvio.
      // O fluxo real sempre passa por link_opened antes, que cria a prova.
      const { data: verified, error: verifiedError } = await supabaseAdmin
        .from('email_verifications')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle()
      if (verifiedError) throw verifiedError
      if (!verified) {
        res.status(403).json({ error: 'E-mail ainda não confirmado' })
        return
      }
      await stampLatestPaidIntent(supabaseAdmin, userId, 'password_set_at')
    }
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('claim-access error:', JSON.stringify(error, Object.getOwnPropertyNames(error as object)))
    res.status(500).json({ error: 'Failed to record access step' })
  }
}

/**
 * Carimba o passo no intent pago mais recente da usuária, só se ainda vazio.
 * Sem intent pago (ex.: veio por recuperação de senha) não há o que carimbar —
 * não é erro.
 */
async function stampLatestPaidIntent(
  supabaseAdmin: SupabaseAdmin,
  userId: string,
  column: 'link_opened_at' | 'password_set_at',
) {
  const { data: intent, error: selectError } = await supabaseAdmin
    .from('purchase_intents')
    .select(`id, ${column}`)
    .eq('user_id', userId)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string } & Record<typeof column, string | null>>()
  if (selectError) throw selectError
  if (!intent || intent[column]) return

  const { error } = await supabaseAdmin
    .from('purchase_intents')
    .update({ [column]: new Date().toISOString() })
    .eq('id', intent.id)
    .is(column, null)
  if (error) throw error
}

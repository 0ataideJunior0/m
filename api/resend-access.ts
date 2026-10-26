import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { normalizeEmail } from './_lib/checkoutRules.js'
import { sendAccessEmail } from './_lib/accessEmail.js'

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>

/**
 * Reenvio do link de acesso para quem pagou e ainda não criou a senha.
 *
 * Rota pública: a resposta é SEMPRE 200 {ok:true} (fora corpo malformado e
 * método errado) e erros de envio ou de banco só vão para o log. Assim ninguém
 * descobre, por esta rota, se um e-mail tem compra ou conta.
 *
 * Só envia se existir compra paga desse e-mail com password_set_at vazio — o
 * link é a única forma de a compradora assumir a conta, e depois que a senha
 * existe um reenvio anônimo só serviria para incomodar a dona. Admin (Bearer de
 * admin) pode reenviar para qualquer compra paga. O limite de envios por
 * e-mail é o do próprio Supabase.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const email = normalizeEmail(req.body?.email)
  if (!email) {
    res.status(400).json({ error: 'Invalid email' })
    return
  }

  try {
    const supabaseAdmin = createSupabaseAdmin()
    const isAdmin = await callerIsAdmin(req, supabaseAdmin)

    let query = supabaseAdmin
      .from('purchase_intents')
      .select('id')
      .eq('email', email)
      .eq('status', 'paid')
    if (!isAdmin) query = query.is('password_set_at', null)
    const { data: intents, error } = await query.limit(1)
    if (error) throw error

    if (intents && intents.length > 0) {
      // A origem do link vem da configuração, nunca do host da requisição.
      const origin = (process.env.PUBLIC_APP_URL || '').replace(/\/+$/, '')
      if (!origin) {
        console.error('resend-access: PUBLIC_APP_URL não configurada; e-mail de acesso não enviado')
      } else {
        await sendAccessEmail(supabaseAdmin, email, origin)
      }
    }
  } catch (error) {
    console.error('resend-access error:', JSON.stringify(error, Object.getOwnPropertyNames(error as object)))
  }

  res.status(200).json({ ok: true })
}

/** Token ausente, inválido ou de não-admin vale como anônima: nunca vira erro. */
async function callerIsAdmin(req: VercelRequest, supabaseAdmin: SupabaseAdmin): Promise<boolean> {
  const authHeader = (req.headers.authorization as string) || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return false

  const { data: userData, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !userData.user) return false

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .maybeSingle()
  return Boolean(profile?.is_admin)
}

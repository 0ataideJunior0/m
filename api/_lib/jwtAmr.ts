/** Métodos de autenticação que provam acesso à caixa de entrada do e-mail. */
const EMAIL_LINK_METHODS = ['otp', 'magiclink', 'recovery']

/**
 * Diz se a sessão nasceu de um link enviado por e-mail. O Supabase grava no
 * access token `amr: [{ method, timestamp }]` com o(s) método(s) usados para
 * abrir a sessão; o link do template Magic Link entra como 'otp'.
 *
 * Só decodifica o payload — NÃO valida a assinatura. Chame depois de
 * `auth.getUser(token)` ter dado certo (é ele que valida). Token ou `amr`
 * malformado conta como "não veio do link".
 */
export function sessionCameFromEmailLink(accessToken: string): boolean {
  const payload = accessToken.split('.')[1]
  if (!payload) return false

  let claims: unknown
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return false
  }

  const amr = (claims as { amr?: unknown } | null)?.amr
  if (!Array.isArray(amr)) return false
  return amr.some((entry) => {
    const method = (entry as { method?: unknown } | null)?.method
    return typeof method === 'string' && EMAIL_LINK_METHODS.includes(method)
  })
}

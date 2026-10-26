/** Métodos de autenticação que provam acesso à caixa de entrada do e-mail. */
const EMAIL_LINK_METHODS = ['otp', 'magiclink', 'recovery']

/**
 * Versão do navegador de api/_lib/jwtAmr.ts (mesma regra): diz se a sessão
 * nasceu de um link enviado por e-mail, lendo o `amr` do access token. Só
 * decide o que a tela mostra — quem confere de verdade é o servidor, que
 * valida a assinatura do token. Token malformado conta como "não veio do link".
 */
export function sessionCameFromEmailLink(accessToken: string): boolean {
  const payload = accessToken.split('.')[1]
  if (!payload) return false

  let claims: unknown
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    claims = JSON.parse(new TextDecoder().decode(bytes))
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

/**
 * Erros do Supabase Auth chegam em inglês. Esta tabela traduz os que a aluna
 * pode ver; o resto cai numa mensagem genérica em português (nunca mostra o
 * texto original). Casa pelo `code` quando o erro traz um; senão, pela mensagem.
 */
type AuthErrorLike = { code?: string; message?: string } | null | undefined

const FALLBACK = 'Não foi possível concluir. Tente de novo.'

const RULES: Array<{ codes: string[]; message: RegExp; text: string }> = [
  {
    codes: ['user_already_exists', 'email_exists'],
    message: /already (been )?registered/i,
    text: "Já existe uma conta com esse e-mail. Entre ou use 'Esqueci a senha'.",
  },
  {
    codes: ['invalid_credentials'],
    message: /invalid login credentials/i,
    text: 'E-mail ou senha incorretos.',
  },
  {
    codes: ['email_not_confirmed'],
    message: /email not confirmed/i,
    text: 'Confirme seu e-mail antes de entrar: procure o link na sua caixa de entrada.',
  },
  {
    codes: ['weak_password'],
    message: /password should be at least/i,
    text: 'A senha deve ter pelo menos 6 caracteres.',
  },
  {
    codes: ['same_password'],
    message: /should be different from the old password/i,
    text: 'A nova senha precisa ser diferente da atual.',
  },
  {
    codes: ['over_request_rate_limit', 'over_email_send_rate_limit'],
    message: /rate limit|too many requests/i,
    text: 'Muitas tentativas. Espere um pouco e tente de novo.',
  },
]

function findRule(error: AuthErrorLike) {
  if (!error) return undefined
  if (error.code) {
    const byCode = RULES.find((rule) => rule.codes.includes(error.code as string))
    if (byCode) return byCode
  }
  const message = error.message ?? ''
  return RULES.find((rule) => rule.message.test(message))
}

export function authErrorMessage(error: AuthErrorLike): string {
  return findRule(error)?.text ?? FALLBACK
}

/** "A senha nova é igual à atual": no primeiro acesso isso conta como sucesso. */
export function isSamePasswordError(error: AuthErrorLike): boolean {
  return findRule(error)?.codes.includes('same_password') ?? false
}

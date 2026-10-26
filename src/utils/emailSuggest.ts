const DOMAIN_FIXES: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'yahoo.com.b': 'yahoo.com.br',
  'icloud.co': 'icloud.com',
}

/** Se o domínio parece um erro de digitação comum, devolve o e-mail corrigido; senão, null. */
export function suggestEmail(email: string): string | null {
  const trimmed = email.trim()
  const at = trimmed.lastIndexOf('@')
  if (at <= 0) return null

  const fixed = DOMAIN_FIXES[trimmed.slice(at + 1).toLowerCase()]
  return fixed ? `${trimmed.slice(0, at)}@${fixed}` : null
}

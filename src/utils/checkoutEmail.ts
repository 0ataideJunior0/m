const KEY_PREFIX = 'musa_checkout_email:'

/**
 * O pagamento no cartão sai da página e volta por /comprar/retorno, que só
 * conhece o id do pedido (o servidor não devolve o e-mail). Guardamos o e-mail
 * na sessão do navegador antes de sair, para o aviso do login poder citá-lo.
 */
export function rememberCheckoutEmail(intentId: string, email: string): void {
  try {
    sessionStorage.setItem(KEY_PREFIX + intentId, email)
  } catch {
    // Armazenamento bloqueado: o aviso do login só não cita o e-mail.
  }
}

export function recallCheckoutEmail(intentId: string): string | null {
  try {
    return sessionStorage.getItem(KEY_PREFIX + intentId)
  } catch {
    return null
  }
}

/** Destino depois do pagamento aprovado: o login avisa que o link de acesso foi enviado. */
export function paidLoginPath(email: string | null): string {
  return email ? `/login?pago=1&email=${encodeURIComponent(email)}` : '/login?pago=1'
}

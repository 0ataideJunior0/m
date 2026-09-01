/**
 * Formato do external_reference dos pagamentos Pix e a matemática de período.
 *
 * O external_reference é o único canal por onde o webhook descobre de quem é o
 * pagamento e quantos meses creditar — por isso o formato é definido aqui, em
 * um lugar só, e usado tanto na criação quanto na leitura.
 */

const PIX_MARKER = 'pix'

export function buildPixExternalReference(userId: string, months: number): string {
  return `${userId}|${PIX_MARKER}|${months}`
}

export interface ParsedPixReference {
  userId: string
  months: number
}

/**
 * Devolve null para qualquer coisa que não seja uma referência de Pix — o que
 * inclui o external_reference das assinaturas no cartão, que é o user id puro.
 */
export function parsePixExternalReference(reference: unknown): ParsedPixReference | null {
  if (typeof reference !== 'string') return null
  const parts = reference.split('|')
  if (parts.length !== 3) return null
  const [userId, marker, monthsRaw] = parts
  if (marker !== PIX_MARKER) return null
  if (!userId) return null
  const months = Number(monthsRaw)
  if (!Number.isInteger(months) || months <= 0) return null
  return { userId, months }
}

/**
 * Soma meses preservando o dia sempre que ele existir no mês de destino.
 *
 * Sem o ajuste, 31/01 + 1 mês viraria 03/03 no JavaScript (fevereiro não tem
 * 31), dando ao cliente dias a mais de graça e uma data de vencimento que não
 * bate com o que a tela prometeu. O clamp joga para o último dia do mês certo.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime())
  const day = result.getDate()
  result.setMonth(result.getMonth() + months)
  if (result.getDate() !== day) {
    result.setDate(0)
  }
  return result
}

/**
 * Regras puras do checkout aberto (pagar primeiro, conta depois): e-mail,
 * referência da intenção de compra e resolução do plano. Sem I/O — o que toca
 * banco ou Mercado Pago fica nas rotas.
 */
import { PIX_PLANS, isPixPlanId, ADMIN_ONLY_PLANS, type PixPlan } from './pixPlans.js'

/** Teto de intenções de compra por e-mail por hora (freio contra abuso). */
export const MAX_INTENTS_PER_EMAIL_PER_HOUR = 5

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  return EMAIL_PATTERN.test(email) ? email : null
}

const INTENT_PREFIX = 'intent|'

/**
 * external_reference dos pagamentos do checkout aberto. Ainda não existe
 * usuário nessa hora, então a referência aponta para a intenção de compra.
 */
export function buildIntentReference(intentId: string): string {
  return `${INTENT_PREFIX}${intentId}`
}

export function parseIntentReference(ref: unknown): string | null {
  if (typeof ref !== 'string' || !ref.startsWith(INTENT_PREFIX)) return null
  const intentId = ref.slice(INTENT_PREFIX.length)
  if (!intentId || intentId.includes('|')) return null
  return intentId
}

export function parseTestEmails(env: string | undefined): string[] {
  if (!env) return []
  return env
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter((email): email is string => email !== null)
}

/**
 * O preço vem sempre do servidor. Planos restritos (hoje só `teste`, R$ 0,01)
 * ficam disponíveis no checkout aberto apenas para os e-mails da lista de teste.
 */
export function resolveCheckoutPlan(
  planId: unknown,
  email: string,
  testEmails: string[],
): { plan: PixPlan } | { error: 'invalid_plan' | 'unavailable' } {
  if (!isPixPlanId(planId)) return { error: 'invalid_plan' }
  if (ADMIN_ONLY_PLANS.includes(planId) && !testEmails.includes(email)) {
    return { error: 'unavailable' }
  }
  return { plan: PIX_PLANS[planId] }
}

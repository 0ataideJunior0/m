import { describe, it, expect } from 'vitest'
import {
  normalizeEmail,
  buildIntentReference,
  parseIntentReference,
  resolveCheckoutPlan,
  parseTestEmails,
  MAX_INTENTS_PER_EMAIL_PER_HOUR,
} from '../../api/_lib/checkoutRules'

describe('normalizeEmail', () => {
  it('apara e põe em minúsculas', () => {
    expect(normalizeEmail('  Ana@Gmail.COM ')).toBe('ana@gmail.com')
  })

  it('devolve null para e-mail inválido ou que não é texto', () => {
    expect(normalizeEmail('ana@')).toBeNull()
    expect(normalizeEmail('ana@gmail')).toBeNull()
    expect(normalizeEmail('a na@gmail.com')).toBeNull()
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail(undefined)).toBeNull()
    expect(normalizeEmail(42)).toBeNull()
  })
})

describe('referência de intenção', () => {
  it('faz ida e volta', () => {
    expect(buildIntentReference('abc')).toBe('intent|abc')
    expect(parseIntentReference(buildIntentReference('abc'))).toBe('abc')
  })

  it('não confunde com a referência de usuário logado nem com lixo', () => {
    expect(parseIntentReference('u1|pix|3')).toBeNull()
    expect(parseIntentReference('intent|')).toBeNull()
    expect(parseIntentReference('intent|a|b')).toBeNull()
    expect(parseIntentReference('224e4c07-a10c-49e6-ba3e-ffa7f6c38e99')).toBeNull()
    expect(parseIntentReference(null)).toBeNull()
  })
})

describe('resolveCheckoutPlan', () => {
  it('plano teste só existe para e-mails da lista', () => {
    expect(resolveCheckoutPlan('teste', 'x@y.com', [])).toEqual({ error: 'unavailable' })
    expect(resolveCheckoutPlan('teste', 'x@y.com', ['qa@musa.com'])).toEqual({ error: 'unavailable' })
    expect(resolveCheckoutPlan('teste', 'qa@musa.com', ['qa@musa.com'])).toHaveProperty('plan.amount', 0.01)
  })

  it('planos normais resolvem com o preço do servidor', () => {
    expect(resolveCheckoutPlan('trimestral', 'x@y.com', [])).toHaveProperty('plan.months', 3)
    expect(resolveCheckoutPlan('mensal', 'x@y.com', [])).toHaveProperty('plan.amount', 49.9)
  })

  it('plano desconhecido é inválido', () => {
    expect(resolveCheckoutPlan('vitalicio', 'x@y.com', [])).toEqual({ error: 'invalid_plan' })
    expect(resolveCheckoutPlan(undefined, 'x@y.com', [])).toEqual({ error: 'invalid_plan' })
  })
})

describe('parseTestEmails', () => {
  it('normaliza e descarta vazios', () => {
    expect(parseTestEmails(' QA@Musa.com, ,b@c.com')).toEqual(['qa@musa.com', 'b@c.com'])
  })

  it('variável ausente vira lista vazia', () => {
    expect(parseTestEmails(undefined)).toEqual([])
    expect(parseTestEmails('')).toEqual([])
  })
})

describe('limite de intenções', () => {
  it('é 5 por e-mail por hora', () => {
    expect(MAX_INTENTS_PER_EMAIL_PER_HOUR).toBe(5)
  })
})

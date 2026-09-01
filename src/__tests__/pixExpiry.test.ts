import { describe, it, expect } from 'vitest'
import { getPixExpiryWarning, formatExpiryMessage } from '../utils/pixExpiry'
import { Subscription } from '../types'

const NOW = new Date('2026-08-19T12:00:00.000Z')

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  id: 's1',
  user_id: 'u1',
  preapproval_id: null,
  payment_id: 'pay-1',
  source: 'pix',
  status: 'authorized',
  next_payment_date: '2026-08-24T12:00:00.000Z', // 5 dias
  created_at: '',
  updated_at: '',
  ...over,
})

describe('getPixExpiryWarning', () => {
  it('avisa dentro da janela de 7 dias', () => {
    const warning = getPixExpiryWarning(sub(), NOW)
    expect(warning?.daysLeft).toBe(5)
    expect(warning?.urgent).toBe(false)
  })

  it('não avisa quando ainda falta mais que a janela', () => {
    expect(getPixExpiryWarning(sub({ next_payment_date: '2026-09-19T12:00:00.000Z' }), NOW)).toBeNull()
  })

  it('marca como urgente faltando 1 dia', () => {
    const warning = getPixExpiryWarning(sub({ next_payment_date: '2026-08-20T12:00:00.000Z' }), NOW)
    expect(warning?.daysLeft).toBe(1)
    expect(warning?.urgent).toBe(true)
  })

  it('continua avisando depois de vencido, enquanto a folga do gate ainda dá acesso', () => {
    const warning = getPixExpiryWarning(sub({ next_payment_date: '2026-08-18T12:00:00.000Z' }), NOW)
    expect(warning?.daysLeft).toBe(-1)
    expect(warning?.urgent).toBe(true)
  })

  it('não avisa sobre assinatura no cartão, que renova sozinha', () => {
    expect(getPixExpiryWarning(sub({ source: 'preapproval' }), NOW)).toBeNull()
  })

  it('não avisa quando não há assinatura, data ou acesso ativo', () => {
    expect(getPixExpiryWarning(null, NOW)).toBeNull()
    expect(getPixExpiryWarning(sub({ next_payment_date: null }), NOW)).toBeNull()
    expect(getPixExpiryWarning(sub({ status: 'cancelled' }), NOW)).toBeNull()
  })
})

describe('formatExpiryMessage', () => {
  it('usa "amanhã" em vez de "1 dias"', () => {
    const warning = getPixExpiryWarning(sub({ next_payment_date: '2026-08-20T12:00:00.000Z' }), NOW)!
    expect(formatExpiryMessage(warning)).toContain('amanhã')
  })

  it('fala no passado quando já venceu', () => {
    const warning = getPixExpiryWarning(sub({ next_payment_date: '2026-08-18T12:00:00.000Z' }), NOW)!
    expect(formatExpiryMessage(warning)).toContain('venceu')
  })

  it('mostra a contagem e a data quando ainda falta tempo', () => {
    const message = formatExpiryMessage(getPixExpiryWarning(sub(), NOW)!)
    expect(message).toContain('5 dias')
    expect(message).toContain('24/08/2026')
  })
})

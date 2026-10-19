import { describe, it, expect } from 'vitest'
import {
  isPrepaidSource,
  isGrantableMonths,
  grantsAccess,
  manualGrantPeriodStart,
} from '../../api/_lib/prepaid'

const NOW = new Date('2026-10-19T12:00:00Z')
const days = (n: number) => new Date(NOW.getTime() + n * 86400000).toISOString()

describe('isPrepaidSource', () => {
  it('Pix e liberação manual são pré-pagos; cartão não', () => {
    expect(isPrepaidSource('pix')).toBe(true)
    expect(isPrepaidSource('manual')).toBe(true)
    expect(isPrepaidSource('preapproval')).toBe(false)
    expect(isPrepaidSource(undefined)).toBe(false)
  })
})

describe('isGrantableMonths', () => {
  it('aceita só os pacotes oferecidos', () => {
    ;[1, 3, 6, 12].forEach((m) => expect(isGrantableMonths(m)).toBe(true))
    ;[0, 2, -1, 1.5, 24, '1', null].forEach((m) => expect(isGrantableMonths(m)).toBe(false))
  })
})

describe('grantsAccess (espelha has_active_subscription)', () => {
  it('authorized com data futura ou dentro dos 3 dias de folga libera', () => {
    expect(grantsAccess({ status: 'authorized', next_payment_date: days(10) }, NOW)).toBe(true)
    expect(grantsAccess({ status: 'authorized', next_payment_date: days(-2) }, NOW)).toBe(true)
    expect(grantsAccess({ status: 'authorized', next_payment_date: days(-4) }, NOW)).toBe(false)
  })

  it('cancelled só libera até a data paga, sem folga', () => {
    expect(grantsAccess({ status: 'cancelled', next_payment_date: days(5) }, NOW)).toBe(true)
    expect(grantsAccess({ status: 'cancelled', next_payment_date: days(-1) }, NOW)).toBe(false)
  })

  it('pending e ausência de linha não liberam', () => {
    expect(grantsAccess({ status: 'pending', next_payment_date: days(30) }, NOW)).toBe(false)
    expect(grantsAccess(null, NOW)).toBe(false)
  })
})

describe('manualGrantPeriodStart', () => {
  it('sem acesso atual, começa agora', () => {
    expect(manualGrantPeriodStart(null, NOW)).toEqual(NOW)
    expect(manualGrantPeriodStart({ status: 'authorized', next_payment_date: days(-10) }, NOW)).toEqual(NOW)
  })

  it('com acesso pago ainda valendo, soma depois dele (não joga dias fora)', () => {
    const end = days(12)
    expect(manualGrantPeriodStart({ status: 'authorized', next_payment_date: end }, NOW)).toEqual(new Date(end))
    expect(manualGrantPeriodStart({ status: 'cancelled', next_payment_date: end }, NOW)).toEqual(new Date(end))
  })

  it('dentro da folga de 3 dias, recomeça de agora (a data já passou)', () => {
    expect(manualGrantPeriodStart({ status: 'authorized', next_payment_date: days(-1) }, NOW)).toEqual(NOW)
  })

  it('pending nunca foi pago: não serve de base', () => {
    expect(manualGrantPeriodStart({ status: 'pending', next_payment_date: days(30) }, NOW)).toEqual(NOW)
  })
})

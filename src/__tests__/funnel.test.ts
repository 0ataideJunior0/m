import { describe, it, expect } from 'vitest'
import { computeFunnel, FUNNEL_STEPS, FUNNEL_STEP_LABELS, UNKNOWN_SOURCE } from '../utils/funnel'
import type { PurchaseIntent } from '../types'

const SINCE = new Date('2026-10-01T00:00:00.000Z')

let seq = 0
const intent = (over: Partial<PurchaseIntent> = {}): PurchaseIntent => ({
  id: `i${++seq}`,
  email: 'ana@example.com',
  plan_id: 'mensal',
  method: 'pix',
  months: 1,
  amount: 49.9,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  referrer: null,
  status: 'pending',
  last_payment_status: null,
  payment_id: null,
  user_id: null,
  created_at: '2026-10-10T12:00:00.000Z',
  paid_at: null,
  access_email_sent_at: null,
  link_opened_at: null,
  password_set_at: null,
  ...over,
})

const counts = (steps: { key: string; count: number }[]) =>
  Object.fromEntries(steps.map((s) => [s.key, s.count]))

describe('computeFunnel', () => {
  it('expõe as etapas na ordem, com os rótulos em português', () => {
    expect([...FUNNEL_STEPS]).toEqual(['checkout', 'paid', 'link_opened', 'password_set', 'onboarding', 'first_workout'])
    expect(FUNNEL_STEPS.map((k) => FUNNEL_STEP_LABELS[k])).toEqual([
      'Checkout iniciado',
      'Pagou',
      'Abriu o link',
      'Criou a senha',
      'Fez o onboarding',
      'Primeiro treino',
    ])
    const { steps } = computeFunnel([], new Set(), new Set(), SINCE)
    expect(steps.map((s) => s.label)).toEqual(FUNNEL_STEPS.map((k) => FUNNEL_STEP_LABELS[k]))
    expect(steps.every((s) => s.count === 0)).toBe(true)
  })

  it('dois intents do mesmo e-mail contam 1 checkout (ignora caixa e espaços)', () => {
    const { steps } = computeFunnel(
      [intent(), intent({ email: ' ANA@example.com ' }), intent({ email: 'bia@example.com' })],
      new Set(),
      new Set(),
      SINCE,
    )
    expect(counts(steps).checkout).toBe(2)
  })

  it('conta pagou se qualquer intent da pessoa foi pago, uma vez só', () => {
    const { steps } = computeFunnel(
      [
        intent({ status: 'rejected' }),
        intent({ status: 'paid', paid_at: '2026-10-10T12:05:00.000Z', user_id: 'u1' }),
        intent({ status: 'paid', paid_at: '2026-10-11T12:05:00.000Z', user_id: 'u1' }),
      ],
      new Set(),
      new Set(),
      SINCE,
    )
    expect(counts(steps)).toMatchObject({ checkout: 1, paid: 1 })
  })

  it('conta link aberto, senha criada, onboarding e primeiro treino só de quem é conta nova, em cascata', () => {
    const sent = { access_email_sent_at: '2026-10-10T12:06:00.000Z' }
    const intents = [
      intent({
        email: 'a@x.com',
        status: 'paid',
        user_id: 'ua',
        ...sent,
        link_opened_at: '2026-10-10T13:00:00.000Z',
        password_set_at: '2026-10-10T13:05:00.000Z',
      }),
      intent({ email: 'b@x.com', status: 'paid', user_id: 'ub', ...sent, link_opened_at: '2026-10-10T13:00:00.000Z' }),
      intent({ email: 'c@x.com', status: 'paid', user_id: 'uc', ...sent }),
      // não pagou: mesmo com user_id nos conjuntos, não entra
      intent({ email: 'd@x.com', status: 'pending', user_id: 'ud' }),
    ]
    const { steps, returning } = computeFunnel(intents, new Set(['ua', 'ub', 'ud']), new Set(['ua', 'ub', 'ud']), SINCE)
    expect(counts(steps)).toEqual({
      checkout: 4,
      paid: 3,
      link_opened: 2,
      password_set: 1,
      onboarding: 1,
      first_workout: 1,
    })
    expect(returning).toBe(0)
  })

  it('quem já tinha conta (sem e-mail de acesso) entra em "returning" e não conta nas etapas de conta nova', () => {
    const { steps, returning, paidWithoutPassword } = computeFunnel(
      [intent({ email: 'renova@x.com', status: 'paid', user_id: 'ur', paid_at: '2026-10-12T10:00:00.000Z' })],
      new Set(['ur']),
      new Set(['ur']),
      SINCE,
    )
    expect(counts(steps)).toEqual({
      checkout: 1,
      paid: 1,
      link_opened: 0,
      password_set: 0,
      onboarding: 0,
      first_workout: 0,
    })
    expect(returning).toBe(1)
    expect(paidWithoutPassword).toEqual([])
  })

  it('uma pessoa é conta nova se qualquer intent pago dela teve e-mail de acesso', () => {
    const { steps, returning } = computeFunnel(
      [
        intent({ email: 'a@x.com', status: 'paid', user_id: 'ua' }),
        intent({ email: 'a@x.com', status: 'paid', user_id: 'ua', access_email_sent_at: '2026-10-11T10:00:00.000Z' }),
      ],
      new Set(),
      new Set(),
      SINCE,
    )
    expect(returning).toBe(0)
    expect(counts(steps).paid).toBe(1)
  })

  it('as etapas são aninhadas: senha sem link aberto não conta, onboarding sem senha não conta', () => {
    const sent = { access_email_sent_at: '2026-10-10T12:06:00.000Z' }
    const { steps } = computeFunnel(
      [
        intent({ email: 'a@x.com', status: 'paid', user_id: 'ua', ...sent, password_set_at: '2026-10-10T13:05:00.000Z' }),
        intent({ email: 'b@x.com', status: 'paid', user_id: 'ub', ...sent, link_opened_at: '2026-10-10T13:00:00.000Z' }),
      ],
      new Set(['ua', 'ub']),
      new Set(['ua', 'ub']),
      SINCE,
    )
    expect(counts(steps)).toEqual({
      checkout: 2,
      paid: 2,
      link_opened: 1,
      password_set: 0,
      onboarding: 0,
      first_workout: 0,
    })
  })

  it('ignora intents anteriores ao período', () => {
    const { steps, paidWithoutPassword } = computeFunnel(
      [intent({ created_at: '2026-09-30T23:59:59.000Z', status: 'paid', paid_at: '2026-09-30T23:59:59.000Z' })],
      new Set(),
      new Set(),
      SINCE,
    )
    expect(counts(steps).checkout).toBe(0)
    expect(paidWithoutPassword).toEqual([])
  })

  it('lista quem pagou e não criou a senha, uma linha por pessoa, mais recente primeiro', () => {
    const sent = { access_email_sent_at: '2026-10-01T10:00:00.000Z' }
    const older = intent({ email: 'velha@x.com', status: 'paid', paid_at: '2026-10-05T10:00:00.000Z', ...sent })
    const newer = intent({ email: 'nova@x.com', status: 'paid', paid_at: '2026-10-12T10:00:00.000Z', ...sent })
    const duplicate = intent({ email: 'nova@x.com', status: 'paid', paid_at: '2026-10-13T10:00:00.000Z', ...sent })
    const done = intent({
      email: 'ok@x.com',
      status: 'paid',
      ...sent,
      paid_at: '2026-10-06T10:00:00.000Z',
      password_set_at: '2026-10-06T11:00:00.000Z',
    })
    // criou a senha em outro intent da mesma pessoa: também não entra
    const doneElsewhere = [
      intent({ email: 'dois@x.com', status: 'paid', paid_at: '2026-10-07T10:00:00.000Z', ...sent }),
      intent({
        email: 'dois@x.com',
        status: 'paid',
        ...sent,
        paid_at: '2026-10-08T10:00:00.000Z',
        password_set_at: '2026-10-08T11:00:00.000Z',
      }),
    ]
    const pending = intent({ email: 'pendente@x.com', status: 'pending' })
    // renovação / conta que já existia: nunca recebeu link, não entra na lista
    const renewal = intent({ email: 'renova@x.com', status: 'paid', user_id: 'ur', paid_at: '2026-10-14T10:00:00.000Z' })

    const { paidWithoutPassword } = computeFunnel(
      [older, newer, duplicate, done, ...doneElsewhere, pending, renewal],
      new Set(),
      new Set(),
      SINCE,
    )
    expect(paidWithoutPassword.map((i) => i.email)).toEqual(['nova@x.com', 'velha@x.com'])
    expect(paidWithoutPassword[0]).toBe(duplicate)
  })

  it('agrupa origem vazia em "Direto/desconhecido" e conta pessoas por origem', () => {
    const { bySource } = computeFunnel(
      [
        intent({ email: 'a@x.com', utm_source: 'instagram', status: 'paid' }),
        intent({ email: 'a@x.com', utm_source: 'instagram' }),
        intent({ email: 'b@x.com', utm_source: ' Instagram ' }),
        intent({ email: 'c@x.com', utm_source: null, status: 'paid' }),
        intent({ email: 'd@x.com', utm_source: '   ' }),
        intent({ email: 'f@x.com', utm_source: null }),
        intent({ email: 'e@x.com', utm_source: 'google' }),
      ],
      new Set(),
      new Set(),
      SINCE,
    )
    expect(UNKNOWN_SOURCE).toBe('Direto/desconhecido')
    expect(bySource).toEqual([
      { source: 'Direto/desconhecido', checkout: 3, paid: 1 },
      { source: 'instagram', checkout: 2, paid: 1 },
      { source: 'google', checkout: 1, paid: 0 },
    ])
  })

  it('atribui cada pessoa à origem do primeiro checkout dela', () => {
    const { bySource } = computeFunnel(
      [
        intent({ email: 'a@x.com', utm_source: 'google', created_at: '2026-10-12T10:00:00.000Z', status: 'paid' }),
        intent({ email: 'a@x.com', utm_source: 'instagram', created_at: '2026-10-10T10:00:00.000Z' }),
      ],
      new Set(),
      new Set(),
      SINCE,
    )
    expect(bySource).toEqual([{ source: 'instagram', checkout: 1, paid: 1 }])
  })
})

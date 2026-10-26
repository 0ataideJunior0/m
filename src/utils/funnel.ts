import { supabase } from '../lib/supabase'
import type { PurchaseIntent } from '../types'

export const FUNNEL_STEPS = ['checkout', 'paid', 'link_opened', 'password_set', 'onboarding', 'first_workout'] as const

export type FunnelStepKey = (typeof FUNNEL_STEPS)[number]

export const FUNNEL_STEP_LABELS: Record<FunnelStepKey, string> = {
  checkout: 'Checkout iniciado',
  paid: 'Pagou',
  link_opened: 'Abriu o link',
  password_set: 'Criou a senha',
  onboarding: 'Fez o onboarding',
  first_workout: 'Primeiro treino',
}

export const UNKNOWN_SOURCE = 'Direto/desconhecido'

export interface FunnelStep {
  key: FunnelStepKey
  label: string
  count: number
}

export interface FunnelSourceRow {
  source: string
  checkout: number
  paid: number
}

export interface FunnelResult {
  steps: FunnelStep[]
  bySource: FunnelSourceRow[]
  paidWithoutPassword: PurchaseIntent[]
}

export interface FunnelData {
  intents: PurchaseIntent[]
  onboardedUserIds: Set<string>
  firstWorkoutUserIds: Set<string>
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const normalizeSource = (source: string | null) => source?.trim().toLowerCase() || UNKNOWN_SOURCE

const byTime = (a: string | null, b: string | null) => new Date(a ?? 0).getTime() - new Date(b ?? 0).getTime()

/**
 * Conta pessoas (e-mails distintos), não tentativas: quem abriu 3 checkouts
 * conta 1 vez. Onboarding e primeiro treino só valem para quem pagou e já tem
 * conta (user_id).
 */
export function computeFunnel(
  intents: PurchaseIntent[],
  onboardedUserIds: Set<string>,
  firstWorkoutUserIds: Set<string>,
  since: Date,
): FunnelResult {
  const people = new Map<string, PurchaseIntent[]>()
  for (const intent of intents) {
    if (new Date(intent.created_at).getTime() < since.getTime()) continue
    const key = normalizeEmail(intent.email)
    const list = people.get(key)
    if (list) list.push(intent)
    else people.set(key, [intent])
  }

  const totals: Record<FunnelStepKey, number> = {
    checkout: 0,
    paid: 0,
    link_opened: 0,
    password_set: 0,
    onboarding: 0,
    first_workout: 0,
  }
  const sources = new Map<string, FunnelSourceRow>()
  const paidWithoutPassword: PurchaseIntent[] = []

  for (const list of people.values()) {
    const paidIntents = list.filter((i) => i.status === 'paid')
    const paid = paidIntents.length > 0
    const passwordSet = paidIntents.some((i) => i.password_set_at)
    const userIds = paidIntents.map((i) => i.user_id).filter((id): id is string => !!id)

    totals.checkout += 1
    if (paid) totals.paid += 1
    if (paidIntents.some((i) => i.link_opened_at)) totals.link_opened += 1
    if (passwordSet) totals.password_set += 1
    if (userIds.some((id) => onboardedUserIds.has(id))) totals.onboarding += 1
    if (userIds.some((id) => firstWorkoutUserIds.has(id))) totals.first_workout += 1

    // Uma origem por pessoa (a do primeiro checkout), para a tabela fechar com o total.
    const first = [...list].sort((a, b) => byTime(a.created_at, b.created_at))[0]
    const source = normalizeSource(first.utm_source)
    const row = sources.get(source) ?? { source, checkout: 0, paid: 0 }
    row.checkout += 1
    if (paid) row.paid += 1
    sources.set(source, row)

    if (paid && !passwordSet) {
      paidWithoutPassword.push([...paidIntents].sort((a, b) => byTime(b.paid_at, a.paid_at))[0])
    }
  }

  paidWithoutPassword.sort((a, b) => byTime(b.paid_at, a.paid_at))

  return {
    steps: FUNNEL_STEPS.map((key) => ({ key, label: FUNNEL_STEP_LABELS[key], count: totals[key] })),
    bySource: [...sources.values()].sort((a, b) => b.checkout - a.checkout || b.paid - a.paid),
    paidWithoutPassword,
  }
}

const PAGE_SIZE = 1000
const ID_CHUNK = 100

/** Lê todas as páginas: o PostgREST corta cada resposta em 1000 linhas. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

/** Intents do período (só admin lê, via RLS) e, de quem pagou, onboarding e treinos. */
export async function loadFunnelData(since: Date): Promise<FunnelData> {
  const intents = await fetchAll<PurchaseIntent>((from, to) =>
    supabase
      .from('purchase_intents')
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  )

  const paidUserIds = [
    ...new Set(intents.filter((i) => i.status === 'paid' && i.user_id).map((i) => i.user_id as string)),
  ]

  const onboardedUserIds = new Set<string>()
  const firstWorkoutUserIds = new Set<string>()

  for (let start = 0; start < paidUserIds.length; start += ID_CHUNK) {
    const ids = paidUserIds.slice(start, start + ID_CHUNK)

    const profiles = await fetchAll<{ id: string }>((from, to) =>
      supabase.from('profiles').select('id').in('id', ids).not('onboarding_completed_at', 'is', null).range(from, to),
    )
    for (const p of profiles) onboardedUserIds.add(p.id)

    const completions = await fetchAll<{ user_id: string }>((from, to) =>
      supabase
        .from('workout_completions')
        .select('user_id')
        .in('user_id', ids)
        .order('user_id', { ascending: true })
        .order('completed_at', { ascending: true })
        .range(from, to),
    )
    for (const c of completions) firstWorkoutUserIds.add(c.user_id)
  }

  return { intents, onboardedUserIds, firstWorkoutUserIds }
}

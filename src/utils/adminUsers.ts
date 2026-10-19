import { supabase } from '../lib/supabase'
import { SubscriptionSource } from '../types'

export interface UserAccess {
  /** Se a aluna consegue usar o app agora (mesma regra de has_active_subscription). */
  active: boolean
  /** Fim do período pago (ou próxima cobrança no cartão), mesmo se já venceu. */
  until: string | null
  source: SubscriptionSource | null
}

export interface AdminUserSummary {
  id: string
  email: string
  username: string | null
  created_at: string
  completedDays: number
  access: UserAccess
}

interface SubscriptionRow {
  user_id: string
  status: string
  source: SubscriptionSource
  next_payment_date: string | null
}

const GRACE_MS = 3 * 24 * 60 * 60 * 1000

// Espelho de grantsAccess (api/_lib/prepaid.ts) e da função SQL
// has_active_subscription(): manter as três iguais.
const hasActiveAccess = (sub: SubscriptionRow, now = Date.now()): boolean => {
  const end = sub.next_payment_date ? new Date(sub.next_payment_date).getTime() : null
  if (sub.status === 'authorized') return end === null || end > now - GRACE_MS
  if (sub.status === 'cancelled') return end !== null && end > now
  return false
}

const toAccess = (sub: SubscriptionRow | undefined): UserAccess =>
  sub
    ? { active: hasActiveAccess(sub), until: sub.next_payment_date, source: sub.source }
    : { active: false, until: null, source: null }

export const listNonAdminUsers = async (): Promise<AdminUserSummary[]> => {
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, username, created_at')
    .eq('is_admin', false)
    .order('created_at', { ascending: false })

  if (profilesError) throw profilesError
  const rows = profiles || []
  if (rows.length === 0) return []

  const ids = rows.map((p: any) => p.id)
  const { data: progress, error: progressError } = await supabase
    .from('user_progress')
    .select('user_id, completion_count')
    .in('user_id', ids)

  if (progressError) throw progressError

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('subscriptions')
    .select('user_id, status, source, next_payment_date')
    .in('user_id', ids)

  if (subscriptionsError) throw subscriptionsError

  const counts = new Map<string, number>()
  for (const row of progress || []) {
    counts.set(row.user_id, (counts.get(row.user_id) || 0) + (row.completion_count || 0))
  }

  const subsByUser = new Map<string, SubscriptionRow>()
  for (const row of (subscriptions || []) as SubscriptionRow[]) subsByUser.set(row.user_id, row)

  return rows.map((p: any) => ({
    id: p.id,
    email: p.email,
    username: p.username,
    created_at: p.created_at,
    completedDays: counts.get(p.id) || 0,
    access: toAccess(subsByUser.get(p.id)),
  }))
}

/** Libera N meses de acesso pra aluna (ex.: pagou em dinheiro). Só admin. */
export const grantAccess = async (
  userId: string,
  months: number,
  note?: string
): Promise<{ accessUntil: string | null; error: string | null }> => {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { accessUntil: null, error: 'Sessão inválida' }

  try {
    const response = await fetch('/api/admin-grant-access', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, months, note }),
    })
    const body = await response.json()
    if (!response.ok) return { accessUntil: null, error: body?.error || 'Erro ao liberar acesso' }
    return { accessUntil: body.accessUntil, error: null }
  } catch {
    // Rede caiu, ou a rota /api não existe (ex.: `npm run dev` só sobe o Vite, sem as funções).
    return { accessUntil: null, error: 'Não foi possível falar com o servidor. Tente de novo.' }
  }
}

export interface UserProfileSummary {
  id: string
  email: string
  username: string | null
}

/** Usada pra identificar de quem é o treino pessoal sendo editado — não
 *  reaproveita `getProfile` (utils/profile.ts) porque aquela não traz email
 *  e é usada pelo fluxo de autenticação, sem relação com o painel admin. */
export const getUserProfileSummary = async (userId: string): Promise<UserProfileSummary | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, username')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data as UserProfileSummary
}

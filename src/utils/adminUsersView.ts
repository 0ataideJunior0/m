import type { AdminUserSummary, UserAccess } from './adminUsers'

/** A partir de quantos dias antes do fim um acesso pré-pago aparece como "vencendo". */
export const EXPIRING_DAYS = 7

const MS_PER_DAY = 24 * 60 * 60 * 1000

export type AccessKind = 'active' | 'expiring' | 'expired' | 'none'
export type UserFilter = 'all' | 'active' | 'expiring' | 'expired' | 'none'

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

export function classifyAccess(access: UserAccess, now: Date = new Date()): { kind: AccessKind; label: string } {
  if (!access.until && !access.active) return { kind: 'none', label: 'Sem acesso' }

  if (!access.active) {
    return { kind: 'expired', label: access.until ? `Vencida em ${formatDate(access.until)}` : 'Sem acesso' }
  }

  // Cartão renova sozinho: a data é a próxima cobrança, não um fim de acesso.
  if (access.source === 'preapproval') {
    return { kind: 'active', label: access.until ? `Cartão · renova ${formatDate(access.until)}` : 'Cartão ativo' }
  }

  if (!access.until) return { kind: 'active', label: 'Ativa' }

  const daysLeft = Math.ceil((new Date(access.until).getTime() - now.getTime()) / MS_PER_DAY)
  if (daysLeft <= 0) return { kind: 'expiring', label: 'Venceu, em período de folga' }
  if (daysLeft <= EXPIRING_DAYS) {
    return { kind: 'expiring', label: daysLeft === 1 ? 'Vence amanhã' : `Vence em ${daysLeft} dias` }
  }
  return { kind: 'active', label: `Ativa até ${formatDate(access.until)}` }
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

const matchesFilter = (kind: AccessKind, filter: UserFilter) =>
  filter === 'all' || kind === filter || (filter === 'active' && kind === 'expiring')

export function filterUsers(
  users: AdminUserSummary[],
  filter: UserFilter,
  query: string,
  now: Date = new Date()
): AdminUserSummary[] {
  const q = normalize(query)
  const result = users.filter((u) => {
    if (!matchesFilter(classifyAccess(u.access, now).kind, filter)) return false
    if (!q) return true
    return normalize(`${u.username ?? ''} ${u.email}`).includes(q)
  })

  if (filter === 'expiring') {
    result.sort((a, b) => new Date(a.access.until ?? 0).getTime() - new Date(b.access.until ?? 0).getTime())
  }
  return result
}

export function countByFilter(users: AdminUserSummary[], now: Date = new Date()): Record<UserFilter, number> {
  const counts: Record<UserFilter, number> = { all: users.length, active: 0, expiring: 0, expired: 0, none: 0 }
  for (const u of users) {
    const kind = classifyAccess(u.access, now).kind
    counts[kind]++
    if (kind === 'expiring') counts.active++
  }
  return counts
}

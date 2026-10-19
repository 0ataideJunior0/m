import { describe, it, expect } from 'vitest'
import { classifyAccess, filterUsers, countByFilter } from '../utils/adminUsersView'
import type { AdminUserSummary, UserAccess } from '../utils/adminUsers'

const NOW = new Date('2026-10-19T12:00:00.000Z')
const inDays = (n: number) => new Date(NOW.getTime() + n * 86400000).toISOString()

const user = (over: Partial<AdminUserSummary> & { access?: UserAccess } = {}): AdminUserSummary => ({
  id: 'u1',
  email: 'ana@example.com',
  username: 'Ana Souza',
  created_at: '2026-01-01T00:00:00.000Z',
  completedDays: 3,
  access: { active: false, until: null, source: null },
  ...over,
})

describe('classifyAccess', () => {
  it('sem linha de assinatura: sem acesso', () => {
    expect(classifyAccess({ active: false, until: null, source: null }, NOW)).toEqual({
      kind: 'none',
      label: 'Sem acesso',
    })
  })

  it('pré-pago com mais de 7 dias: ativa até a data', () => {
    expect(classifyAccess({ active: true, until: inDays(20), source: 'manual' }, NOW)).toEqual({
      kind: 'active',
      label: 'Ativa até 08/11/2026',
    })
  })

  it('pré-pago acabando em até 7 dias: vencendo, com os dias restantes', () => {
    expect(classifyAccess({ active: true, until: inDays(3), source: 'pix' }, NOW)).toEqual({
      kind: 'expiring',
      label: 'Vence em 3 dias',
    })
    expect(classifyAccess({ active: true, until: inDays(1), source: 'pix' }, NOW).label).toBe('Vence amanhã')
  })

  it('dentro da folga de 3 dias depois de vencer: ainda entra, mas aparece como vencendo hoje', () => {
    expect(classifyAccess({ active: true, until: inDays(-1), source: 'pix' }, NOW)).toEqual({
      kind: 'expiring',
      label: 'Venceu, em período de folga',
    })
  })

  it('cartão renova sozinho: nunca aparece como vencendo', () => {
    expect(classifyAccess({ active: true, until: inDays(2), source: 'preapproval' }, NOW)).toEqual({
      kind: 'active',
      label: 'Cartão · renova 21/10/2026',
    })
  })

  it('acesso que acabou: vencida em', () => {
    expect(classifyAccess({ active: false, until: inDays(-10), source: 'pix' }, NOW)).toEqual({
      kind: 'expired',
      label: 'Vencida em 09/10/2026',
    })
  })
})

describe('filterUsers', () => {
  const ana = user({ id: 'u1', access: { active: true, until: inDays(20), source: 'manual' } })
  const bia = user({ id: 'u2', email: 'bia@example.com', username: null, access: { active: true, until: inDays(2), source: 'pix' } })
  const carla = user({ id: 'u3', email: 'carla@example.com', username: 'Carla', access: { active: false, until: inDays(-5), source: 'pix' } })
  const dani = user({ id: 'u4', email: 'dani@example.com', username: 'Dani' })
  const all = [ana, bia, carla, dani]

  it('filtra por situação', () => {
    expect(filterUsers(all, 'active', '', NOW).map((u) => u.id)).toEqual(['u1', 'u2'])
    expect(filterUsers(all, 'expiring', '', NOW).map((u) => u.id)).toEqual(['u2'])
    expect(filterUsers(all, 'expired', '', NOW).map((u) => u.id)).toEqual(['u3'])
    expect(filterUsers(all, 'none', '', NOW).map((u) => u.id)).toEqual(['u4'])
    expect(filterUsers(all, 'all', '', NOW)).toHaveLength(4)
  })

  it('busca por nome ou e-mail, sem diferenciar maiúsculas nem acentos', () => {
    expect(filterUsers(all, 'all', 'SOUZA', NOW).map((u) => u.id)).toEqual(['u1'])
    expect(filterUsers(all, 'all', 'bia@', NOW).map((u) => u.id)).toEqual(['u2'])
    expect(filterUsers([user({ username: 'Lívia' })], 'all', 'livia', NOW)).toHaveLength(1)
  })

  it('a aba Vencendo mostra primeiro quem vence antes', () => {
    const eva = user({ id: 'u5', access: { active: true, until: inDays(6), source: 'manual' } })
    expect(filterUsers([eva, bia], 'expiring', '', NOW).map((u) => u.id)).toEqual(['u2', 'u5'])
  })

  it('conta quantas há em cada situação', () => {
    expect(countByFilter(all, NOW)).toEqual({ all: 4, active: 2, expiring: 1, expired: 1, none: 1 })
  })
})

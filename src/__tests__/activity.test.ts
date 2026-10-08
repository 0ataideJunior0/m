import { describe, it, expect } from 'vitest'
import {
  Completion,
  countByDay,
  buildHeatmap,
  computeStreaks,
  weekCount,
  longestWeekStreak,
  favoritePrograms,
  hasEarlyBird,
  buildAchievements,
} from '../utils/activity'

// 2026-10-08 é uma quinta-feira.
const TODAY = new Date(2026, 9, 8, 15, 0)

const at = (month: number, day: number, hour = 12, programName: string | null = 'Avançado'): Completion => ({
  completedAt: new Date(2026, month - 1, day, hour).toISOString(),
  programName,
})

describe('countByDay', () => {
  it('agrupa por dia local e soma treinos do mesmo dia', () => {
    const counts = countByDay([at(10, 7), at(10, 7, 18), at(10, 5)])
    expect(counts.get('2026-10-07')).toBe(2)
    expect(counts.get('2026-10-05')).toBe(1)
    expect(counts.size).toBe(2)
  })
})

describe('computeStreaks', () => {
  it('conta dias consecutivos terminando hoje', () => {
    const counts = countByDay([at(10, 6), at(10, 7), at(10, 8)])
    expect(computeStreaks(counts, TODAY).current).toBe(3)
  })

  it('mantém a sequência viva quando o último treino foi ontem', () => {
    const counts = countByDay([at(10, 6), at(10, 7)])
    expect(computeStreaks(counts, TODAY).current).toBe(2)
  })

  it('zera quando o último treino foi há mais de um dia', () => {
    const counts = countByDay([at(10, 5), at(10, 6)])
    expect(computeStreaks(counts, TODAY).current).toBe(0)
  })

  it('calcula o recorde histórico, mesmo que não seja a sequência atual', () => {
    const counts = countByDay([at(9, 1), at(9, 2), at(9, 3), at(9, 4), at(10, 8)])
    const { current, record } = computeStreaks(counts, TODAY)
    expect(current).toBe(1)
    expect(record).toBe(4)
  })

  it('atravessa virada de mês', () => {
    const counts = countByDay([at(9, 29), at(9, 30), at(10, 1)])
    expect(computeStreaks(counts, new Date(2026, 9, 1, 10)).record).toBe(3)
  })

  it('sem treinos, tudo zero', () => {
    expect(computeStreaks(new Map(), TODAY)).toEqual({ current: 0, record: 0 })
  })
})

describe('weekCount', () => {
  it('conta treinos da semana corrente (segunda a domingo)', () => {
    // segunda 5, quarta 7 e hoje (quinta 8) estão na semana; domingo 4 não.
    const counts = countByDay([at(10, 4), at(10, 5), at(10, 7), at(10, 8)])
    expect(weekCount(counts, TODAY)).toBe(3)
  })
})

describe('longestWeekStreak', () => {
  it('conta semanas seguidas com ao menos um treino', () => {
    const counts = countByDay([at(9, 7), at(9, 15), at(9, 23), at(10, 1)])
    expect(longestWeekStreak(counts)).toBe(4)
  })

  it('uma semana vazia quebra a sequência', () => {
    const counts = countByDay([at(9, 7), at(9, 23), at(10, 1)])
    expect(longestWeekStreak(counts)).toBe(2)
  })
})

describe('buildHeatmap', () => {
  it('monta colunas de segunda a domingo terminando na semana de hoje', () => {
    const counts = countByDay([at(10, 8), at(10, 8, 18), at(10, 6)])
    const weeks = buildHeatmap(counts, TODAY, 18)

    expect(weeks).toHaveLength(18)
    weeks.forEach((w) => expect(w.days).toHaveLength(7))

    const last = weeks[17]
    expect(last.days[0].date).toBe('2026-10-05')
    expect(last.days[1].count).toBe(1) // terça 6
    expect(last.days[3].count).toBe(2) // quinta 8
    expect(last.days[3].isToday).toBe(true)
    expect(last.days[4].future).toBe(true) // sexta 9
  })

  it('só rotula o mês na coluna em que ele começa', () => {
    const weeks = buildHeatmap(new Map(), TODAY, 18)
    const labels = weeks.map((w) => w.label).filter(Boolean)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels[labels.length - 1]).toBe('out')
  })
})

describe('favoritePrograms', () => {
  it('ordena por quantidade e agrupa sem programa como treino personalizado', () => {
    const favs = favoritePrograms([
      at(10, 1, 12, 'Iniciante'),
      at(10, 2, 12, 'Avançado'),
      at(10, 3, 12, 'Avançado'),
      at(10, 4, 12, null),
    ])
    expect(favs).toEqual([
      { name: 'Avançado', count: 2 },
      { name: 'Iniciante', count: 1 },
      { name: 'Treino personalizado', count: 1 },
    ])
  })
})

describe('hasEarlyBird', () => {
  it('é verdadeiro só com treino antes das 7h locais', () => {
    expect(hasEarlyBird([at(10, 1, 6)])).toBe(true)
    expect(hasEarlyBird([at(10, 1, 7), at(10, 2, 19)])).toBe(false)
  })
})

describe('buildAchievements', () => {
  const base = { total: 0, record: 0, weekStreak: 0, earlyBird: false }
  const byId = (list: ReturnType<typeof buildAchievements>, id: string) => list.find((a) => a.id === id)!

  it('desbloqueia por limiar e mostra progresso nas bloqueadas', () => {
    const list = buildAchievements({ ...base, total: 12, record: 7, weekStreak: 2 })
    expect(byId(list, 'first').unlocked).toBe(true)
    expect(byId(list, 'ten').unlocked).toBe(true)
    expect(byId(list, 'fifty').unlocked).toBe(false)
    expect(byId(list, 'fifty').hint).toBe('12 de 50')
    expect(byId(list, 'streak30').hint).toBe('Recorde: 7')
    expect(byId(list, 'weeks4').unlocked).toBe(false)
  })

  it('madrugadora depende de ter treinado antes das 7h', () => {
    expect(byId(buildAchievements({ ...base, total: 1 }), 'early').unlocked).toBe(false)
    expect(byId(buildAchievements({ ...base, total: 1, earlyBird: true }), 'early').unlocked).toBe(true)
  })
})

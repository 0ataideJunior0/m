import { supabase } from '../lib/supabase'

export const WEEKLY_GOAL = 5
export const HEATMAP_WEEKS = 18
export const PERSONAL_PROGRAM_LABEL = 'Treino personalizado'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export interface Completion {
  completedAt: string
  /** Nulo para treino pessoal ou treino apagado depois de concluído. */
  programName: string | null
}

export interface HeatmapDay {
  date: string
  count: number
  future: boolean
  isToday: boolean
}

export interface HeatmapWeek {
  label: string
  days: HeatmapDay[]
}

export type AchievementIcon = 'sparkles' | 'trophy' | 'medal' | 'calendar' | 'sunrise' | 'flame'

export interface Achievement {
  id: string
  icon: AchievementIcon
  title: string
  unlocked: boolean
  hint: string
}

const pad = (n: number) => String(n).padStart(2, '0')

// Dia local, não UTC: quem treina às 22h em Brasília não pode cair no dia seguinte.
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const parseKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))

export const countByDay = (completions: Completion[]): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const c of completions) {
    const key = dayKey(new Date(c.completedAt))
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return counts
}

export const computeStreaks = (counts: Map<string, number>, today: Date) => {
  const keys = [...counts.keys()].sort()

  let record = 0
  let run = 0
  let prev: Date | null = null
  for (const key of keys) {
    const date = parseKey(key)
    run = prev && dayKey(addDays(prev, 1)) === key ? run + 1 : 1
    if (run > record) record = run
    prev = date
  }

  // Treinar hoje ainda não é obrigatório: a sequência só quebra se ontem também passou em branco.
  let cursor = counts.has(dayKey(today)) ? today : addDays(today, -1)
  let current = 0
  while (counts.has(dayKey(cursor))) {
    current++
    cursor = addDays(cursor, -1)
  }

  return { current, record }
}

export const weekCount = (counts: Map<string, number>, today: Date): number => {
  const monday = mondayOf(today)
  let total = 0
  for (let i = 0; i < 7; i++) total += counts.get(dayKey(addDays(monday, i))) || 0
  return total
}

export const longestWeekStreak = (counts: Map<string, number>): number => {
  const weekKeys = [...new Set([...counts.keys()].map((k) => dayKey(mondayOf(parseKey(k)))))].sort()

  let best = 0
  let run = 0
  let prev: Date | null = null
  for (const key of weekKeys) {
    run = prev && dayKey(addDays(prev, 7)) === key ? run + 1 : 1
    if (run > best) best = run
    prev = parseKey(key)
  }
  return best
}

export const buildHeatmap = (counts: Map<string, number>, today: Date, weeks = HEATMAP_WEEKS): HeatmapWeek[] => {
  const todayKey = dayKey(today)
  const start = addDays(mondayOf(today), -(weeks - 1) * 7)

  let lastMonth = -1
  return Array.from({ length: weeks }, (_, w) => {
    const monday = addDays(start, w * 7)
    const label = monday.getMonth() !== lastMonth ? MONTHS[monday.getMonth()] : ''
    lastMonth = monday.getMonth()

    const days = Array.from({ length: 7 }, (_, d) => {
      const date = addDays(monday, d)
      const key = dayKey(date)
      return { date: key, count: counts.get(key) || 0, future: key > todayKey, isToday: key === todayKey }
    })
    return { label, days }
  })
}

export const favoritePrograms = (completions: Completion[]): { name: string; count: number }[] => {
  const counts = new Map<string, number>()
  for (const c of completions) {
    const name = c.programName || PERSONAL_PROGRAM_LABEL
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export const hasEarlyBird = (completions: Completion[]): boolean =>
  completions.some((c) => new Date(c.completedAt).getHours() < 7)

export const buildAchievements = (stats: {
  total: number
  record: number
  weekStreak: number
  earlyBird: boolean
}): Achievement[] => {
  const { total, record, weekStreak, earlyBird } = stats
  const make = (id: string, icon: AchievementIcon, title: string, unlocked: boolean, hint: string): Achievement => ({
    id,
    icon,
    title,
    unlocked,
    hint: unlocked ? 'Desbloqueada' : hint,
  })

  return [
    make('first', 'sparkles', 'Primeiro treino', total >= 1, 'Conclua um treino'),
    make('ten', 'trophy', '10 treinos', total >= 10, `${total} de 10`),
    make('weeks4', 'calendar', '4 semanas seguidas', weekStreak >= 4, `${weekStreak} de 4 semanas`),
    make('fifty', 'medal', '50 treinos', total >= 50, `${total} de 50`),
    make('early', 'sunrise', 'Madrugadora', earlyBird, 'Treine antes das 7h'),
    make('streak30', 'flame', '30 dias seguidos', record >= 30, `Recorde: ${record}`),
  ]
}

interface CompletionRow {
  completed_at: string
  workout: { program: { name: string } | null } | null
}

export const getCompletions = async (userId: string): Promise<Completion[]> => {
  try {
    const { data, error } = await supabase
      .from('workout_completions')
      .select('completed_at, workout:workouts(program:programs(name))')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(5000)

    if (error) throw error
    return ((data || []) as unknown as CompletionRow[]).map((row) => ({
      completedAt: row.completed_at,
      programName: row.workout?.program?.name ?? null,
    }))
  } catch (error) {
    console.error('Error fetching completions:', error)
    return []
  }
}

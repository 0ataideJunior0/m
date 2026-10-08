// Uma sessão de treino iniciada neste aparelho. Fica só no localStorage: é um
// estado transitório (ninguém precisa dele em outro celular) e, se a sessão
// ficasse no servidor, um treino abandonado travaria a conta em todo lugar.
export const ACTIVE_WORKOUT_TTL_MS = 12 * 60 * 60 * 1000

export interface ActiveWorkout {
  workoutId: string
  title: string
  /** Rota do treino, pra levar a pessoa de volta a ele. */
  path: string
  startedAt: number
}

export const activeWorkoutKey = (userId: string) => `musa_active_workout_${userId}`

const isActiveWorkout = (value: unknown): value is ActiveWorkout => {
  const v = value as Partial<ActiveWorkout> | null
  return (
    !!v &&
    typeof v.workoutId === 'string' &&
    typeof v.title === 'string' &&
    typeof v.path === 'string' &&
    typeof v.startedAt === 'number'
  )
}

export const getActiveWorkout = (userId: string, now = Date.now()): ActiveWorkout | null => {
  try {
    const raw = localStorage.getItem(activeWorkoutKey(userId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isActiveWorkout(parsed)) return null
    // Sem prazo, esquecer um treino aberto impediria iniciar qualquer outro.
    if (now - parsed.startedAt > ACTIVE_WORKOUT_TTL_MS) {
      localStorage.removeItem(activeWorkoutKey(userId))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export const startActiveWorkout = (
  userId: string,
  info: Omit<ActiveWorkout, 'startedAt'>,
  now = Date.now()
): ActiveWorkout => {
  const active: ActiveWorkout = { ...info, startedAt: now }
  try {
    localStorage.setItem(activeWorkoutKey(userId), JSON.stringify(active))
  } catch {
    // Sem storage (modo privado, cota cheia) a sessão vale só enquanto a tela estiver aberta.
  }
  return active
}

export const clearActiveWorkout = (userId: string): void => {
  try {
    localStorage.removeItem(activeWorkoutKey(userId))
  } catch {}
}

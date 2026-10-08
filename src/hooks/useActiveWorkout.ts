import { useCallback, useEffect, useState } from 'react'
import {
  ActiveWorkout,
  activeWorkoutKey,
  getActiveWorkout,
  startActiveWorkout,
  clearActiveWorkout,
} from '../utils/activeWorkout'

/** Treino em andamento da usuária neste aparelho. Compartilhado entre
 *  WorkoutDay e MyWorkout: só um treino pode estar iniciado por vez. */
export function useActiveWorkout(userId: string | undefined) {
  const [active, setActive] = useState<ActiveWorkout | null>(() => (userId ? getActiveWorkout(userId) : null))

  useEffect(() => {
    setActive(userId ? getActiveWorkout(userId) : null)
  }, [userId])

  // Outra aba iniciando ou concluindo um treino também vale aqui.
  useEffect(() => {
    if (!userId) return
    const onStorage = (e: StorageEvent) => {
      if (e.key === activeWorkoutKey(userId)) setActive(getActiveWorkout(userId))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [userId])

  const start = useCallback(
    (info: Omit<ActiveWorkout, 'startedAt'>) => {
      if (!userId) return
      setActive(startActiveWorkout(userId, info))
    },
    [userId]
  )

  const clear = useCallback(() => {
    if (!userId) return
    clearActiveWorkout(userId)
    setActive(null)
  }, [userId])

  return { active, start, clear }
}

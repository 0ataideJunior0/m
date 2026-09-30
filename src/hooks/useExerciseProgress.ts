import { useEffect, useMemo, useRef, useState } from 'react'
import { Exercise } from '../types'
import { getExerciseKey } from '../utils/exerciseKeys'
import { loadLocalProgress, saveLocalProgress, mergeServerLocal } from '../utils/exerciseProgress'
import { fetchExerciseProgress, upsertExerciseProgress } from '../utils/exerciseProgressRemote'

type ExerciseProgressState = Record<string, { completed: boolean; ts: number }>

function useExerciseProgressState(userId: string | undefined, workoutId: string | undefined) {
  const [state, setState] = useState<ExerciseProgressState>({})
  useEffect(() => {
    if (!userId || !workoutId) return
    const local = loadLocalProgress(userId, workoutId)
    setState(local)
    ;(async () => {
      const remote = await fetchExerciseProgress(userId, workoutId)
      setState(s => {
        const merged = mergeServerLocal(remote, s)
        saveLocalProgress(userId, workoutId, merged)
        return merged
      })
    })()
  }, [userId, workoutId])
  return { state, setState }
}

function toggleExerciseFactory(
  userId: string | undefined,
  workoutId: string | undefined,
  exProgress: ExerciseProgressState,
  setExProgress: (v: any) => void,
  pendingRef: React.MutableRefObject<{ key: string; completed: boolean } | null>,
  debounceRef: React.MutableRefObject<any>,
) {
  return (exercise: Exercise, index: number) => {
    if (!userId || !workoutId) return
    const key = getExerciseKey(exercise, index)
    const next = !exProgress[key]?.completed
    const ts = Date.now()
    const updated = { ...exProgress, [key]: { completed: next, ts } }
    setExProgress(updated)
    saveLocalProgress(userId, workoutId, updated)
    pendingRef.current = { key, completed: next }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const p = pendingRef.current
      if (!p) return
      try {
        await upsertExerciseProgress(userId, workoutId, p.key, p.completed)
        pendingRef.current = null
      } catch (e) {
        // retry simples
        setTimeout(async () => {
          try {
            await upsertExerciseProgress(userId, workoutId, p.key, p.completed)
            pendingRef.current = null
          } catch {}
        }, 2000)
      }
    }, 300)
  }
}

/** Progresso de checklist de exercício (workout_id-escopado, funciona tanto pra
 *  treino de catálogo quanto pra treino pessoal). Compartilhado entre
 *  WorkoutDay e MyWorkout. */
export function useExerciseProgress(userId: string | undefined, workoutId: string | undefined) {
  const { state: exProgress, setState: setExProgress } = useExerciseProgressState(userId, workoutId)
  const pendingRef = useRef<{ key: string; completed: boolean } | null>(null)
  const debounceRef = useRef<any>(null)
  const toggleExercise = useMemo(
    () => toggleExerciseFactory(userId, workoutId, exProgress, setExProgress, pendingRef, debounceRef),
    [userId, workoutId, exProgress]
  )
  return { exProgress, toggleExercise }
}

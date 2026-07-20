import { supabase } from '../lib/supabase'

export async function fetchExerciseProgress(userId: string, workoutId: string): Promise<Record<string, boolean>> {
  try {
    const { data, error } = await supabase
      .from('user_exercise_progress')
      .select('exercise_key, completed')
      .eq('user_id', userId)
      .eq('workout_id', workoutId)
    if (error) throw error
    const out: Record<string, boolean> = {}
    ;(data || []).forEach((row: any) => {
      out[row.exercise_key] = !!row.completed
    })
    return out
  } catch {
    return {}
  }
}

export async function upsertExerciseProgress(
  userId: string,
  workoutId: string,
  exercise_key: string,
  completed: boolean
) {
  const now = new Date().toISOString()
  const payload = {
    user_id: userId,
    workout_id: workoutId,
    exercise_key,
    completed,
    completed_at: completed ? now : null,
    updated_at: now,
  }
  const { error } = await supabase
    .from('user_exercise_progress')
    .upsert(payload, { onConflict: 'user_id,workout_id,exercise_key' })
  if (error) throw error
}


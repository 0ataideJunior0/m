import { supabase } from '../lib/supabase'
import { Workout, Exercise } from '../types'

export const listWorkoutsAdmin = async (): Promise<Workout[]> => {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .order('day_number', { ascending: true })

  if (error) throw error
  return (data || []) as Workout[]
}

export interface WorkoutUpdatePayload {
  title: string
  video_url: string
  exercises: Exercise[]
}

export const updateWorkoutAdmin = async (day: number, payload: WorkoutUpdatePayload): Promise<void> => {
  const { error } = await supabase
    .from('workouts')
    .update(payload)
    .eq('day_number', day)

  if (error) throw error
}

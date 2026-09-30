import { supabase } from '../lib/supabase'
import { Workout, Exercise, Program } from '../types'

export const listProgramsAdmin = async (): Promise<Program[]> => {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data || []) as Program[]
}

export const listWorkoutsForProgramAdmin = async (programId: string): Promise<Workout[]> => {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('program_id', programId)
    .order('weekday', { ascending: true })

  if (error) throw error
  return (data || []) as Workout[]
}

export interface WorkoutUpdatePayload {
  title: string
  video_url: string
  exercises: Exercise[]
}

export const updateWorkoutAdmin = async (workoutId: string, payload: WorkoutUpdatePayload): Promise<void> => {
  const { error } = await supabase
    .from('workouts')
    .update(payload)
    .eq('id', workoutId)

  if (error) throw error
}

export const createWorkoutAdmin = async (
  programId: string,
  weekday: number,
  payload: WorkoutUpdatePayload
): Promise<Workout> => {
  const { data, error } = await supabase
    .from('workouts')
    .insert({ program_id: programId, weekday, ...payload })
    .select()
    .single()

  if (error) throw error
  return data as Workout
}

export const getUserWorkout = async (userId: string): Promise<Workout | null> => {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as Workout | null
}

export const saveUserWorkoutAdmin = async (
  userId: string,
  workoutId: string | null,
  payload: WorkoutUpdatePayload
): Promise<Workout> => {
  if (workoutId) {
    const { data, error } = await supabase
      .from('workouts')
      .update(payload)
      .eq('id', workoutId)
      .select()
      .single()

    if (error) throw error
    return data as Workout
  }

  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, ...payload })
    .select()
    .single()

  if (error) throw error
  return data as Workout
}

export const deleteUserWorkoutAdmin = async (workoutId: string): Promise<void> => {
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', workoutId)

  if (error) throw error
}

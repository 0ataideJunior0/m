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

/** Semana pessoal da aluna: um treino por dia da semana que tiver treino. */
export const listUserWeekAdmin = async (userId: string): Promise<Workout[]> => {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .order('weekday', { ascending: true })

  if (error) throw error
  return (data || []) as Workout[]
}

export const getUserWorkoutForDay = async (userId: string, weekday: number): Promise<Workout | null> => {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .eq('weekday', weekday)
    .maybeSingle()

  if (error) throw error
  return data as Workout | null
}

export const saveUserWorkoutAdmin = async (
  userId: string,
  weekday: number,
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
    .insert({ user_id: userId, weekday, ...payload })
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

/**
 * Copia os 7 dias de um programa do catálogo pra semana pessoal da aluna.
 * Dia que já existe é atualizado (não recriado), pra não apagar o progresso
 * dela naquele treino; dia que o programa não tem vira descanso.
 */
export const copyProgramToUserAdmin = async (userId: string, programId: string): Promise<void> => {
  const [source, current] = await Promise.all([listWorkoutsForProgramAdmin(programId), listUserWeekAdmin(userId)])
  const currentByDay = new Map(current.map((w) => [w.weekday, w]))

  for (let weekday = 1; weekday <= 7; weekday++) {
    const from = source.find((w) => w.weekday === weekday)
    const existing = currentByDay.get(weekday)
    if (from) {
      const payload = { title: from.title, video_url: from.video_url || '', exercises: from.exercises || [] }
      await saveUserWorkoutAdmin(userId, weekday, existing?.id ?? null, payload)
    } else if (existing) {
      await deleteUserWorkoutAdmin(existing.id)
    }
  }
}

export const getHideCatalogAdmin = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('personal_plans')
    .select('hide_catalog')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return !!data?.hide_catalog
}

export const setHideCatalogAdmin = async (userId: string, hideCatalog: boolean): Promise<void> => {
  const { error } = await supabase
    .from('personal_plans')
    .upsert({ user_id: userId, hide_catalog: hideCatalog, updated_at: new Date().toISOString() })

  if (error) throw error
}

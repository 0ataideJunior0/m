import { supabase } from '../lib/supabase'
import { Workout, UserProgress, Program } from '../types'

const normalizeWorkout = (data: any): Workout => {
  const normalizeVideo = (ex: any) => {
    return (
      ex?.video ??
      ex?.video_url ??
      ex?.videoUrl ??
      ex?.url_video ??
      null
    )
  }

  const exercisesRaw = data.exercises
  const exercisesArr: any[] =
    typeof exercisesRaw === 'string'
      ? JSON.parse(exercisesRaw)
      : Array.isArray(exercisesRaw)
        ? exercisesRaw
        : []

  const exercises = exercisesArr.map((ex: any) => ({
    exercise: String(ex.exercise ?? ''),
    reps: String(ex.reps ?? ''),
    sets: ex.sets ? String(ex.sets) : undefined,
    note: ex.note ? String(ex.note) : undefined,
    group: ex.group ? String(ex.group) : undefined,
    type: ex.type as any,
    video: normalizeVideo(ex) || undefined,
  }))

  return {
    ...data,
    exercises,
  } as Workout
}

export const getPrograms = async (): Promise<Program[]> => {
  try {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching programs:', error)
    return []
  }
}

export const getProgramBySlug = async (slug: string): Promise<Program | null> => {
  try {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching program:', error)
    return null
  }
}

export const getWorkoutsForProgram = async (programId: string): Promise<Workout[]> => {
  try {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('program_id', programId)
      .order('weekday', { ascending: true })

    if (error) throw error
    return (data || []).map(normalizeWorkout)
  } catch (error) {
    console.error('Error fetching workouts for program:', error)
    return []
  }
}

export const getWorkoutByProgramAndWeekday = async (programId: string, weekday: number): Promise<Workout | null> => {
  try {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('program_id', programId)
      .eq('weekday', weekday)
      .single()

    if (error) throw error
    return normalizeWorkout(data)
  } catch (error) {
    console.error('Error fetching workout:', error)
    return null
  }
}

export const getUserProgress = async (userId: string): Promise<UserProgress[]> => {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*, workout:workouts(title, weekday, program_id)')
      .eq('user_id', userId)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching user progress:', error)
    return []
  }
}

export const markWorkoutComplete = async (userId: string, workoutId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: userId,
        workout_id: workoutId,
        completed: true,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,workout_id' })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error marking workout complete:', error)
    return false
  }
}

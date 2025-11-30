import { supabase } from '../lib/supabase'
import { Workout, UserProgress } from '../types'

export const getWorkoutByDay = async (dayNumber: number): Promise<Workout | null> => {
  try {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('day_number', dayNumber)
      .single()

    if (error) throw error
    // Normalize exercises structure and video field
    const normalizeVideo = (ex: any) => {
      return (
        ex?.video ??
        ex?.video_url ??
        ex?.videoUrl ??
        ex?.url_video ??
        null
      )
    }

    const exercisesRaw = (data as any).exercises
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
      ...(data as any),
      exercises,
    } as Workout
  } catch (error) {
    console.error('Error fetching workout:', error)
    return null
  }
}

export const getUserProgress = async (userId: string): Promise<UserProgress[]> => {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .order('day_number', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching user progress:', error)
    return []
  }
}

export const markDayComplete = async (userId: string, dayNumber: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: userId,
        day_number: dayNumber,
        completed: true,
        completed_at: new Date().toISOString(),
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error marking day complete:', error)
    return false
  }
}

export const getCurrentDay = (progress: UserProgress[]): number => {
  if (progress.length === 0) return 1
  
  const completedDays = progress.filter(p => p.completed).length
  return Math.min(completedDays + 1, 20)
}

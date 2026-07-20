export interface User {
  id: string
  email: string
  username?: string
  created_at: string
  updated_at: string
}

export interface UserProgress {
  id: string
  user_id: string
  workout_id: string
  completed: boolean
  completed_at: string | null
  created_at: string
  workout?: {
    title: string
    weekday: number
    program_id: string
  } | null
}

export interface Program {
  id: string
  slug: string
  name: string
  sort_order: number
  created_at: string
}

export interface Workout {
  id: string
  program_id: string
  weekday: number
  title: string
  exercises: Exercise[]
  video_url: string
  created_at: string
}

export interface Exercise {
  exercise: string
  reps: string
  sets?: string
  note?: string
  group?: string
  type?: 'warmup' | 'drop_set' | 'core' | 'normal'
  video?: string
}

export interface AuthError {
  message: string
  code?: string
}

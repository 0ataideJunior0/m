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
  day_number: number
  completed: boolean
  completed_at: string | null
  created_at: string
}

export interface Workout {
  id: string
  day_number: number
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
}

export interface AuthError {
  message: string
  code?: string
}

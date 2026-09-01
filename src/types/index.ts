export type Sex = 'feminino' | 'masculino'
export type Goal = 'emagrecer' | 'ganhar_musculo' | 'manter'

export interface User {
  id: string
  email: string
  username?: string
  age?: number | null
  sex?: Sex | null
  goal?: Goal | null
  heightCm?: number | null
  weightKg?: number | null
  onboardingCompletedAt: string | null
  created_at: string
  updated_at: string
}

export interface UserProgress {
  id: string
  user_id: string
  workout_id: string
  completed: boolean
  completion_count: number
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

export type SubscriptionStatus = 'pending' | 'authorized' | 'paused' | 'cancelled'

export type SubscriptionSource = 'preapproval' | 'pix'

export interface Subscription {
  id: string
  user_id: string
  /** Nulo quando a linha veio de um pagamento Pix avulso, não de uma assinatura. */
  preapproval_id: string | null
  /** Nulo quando a linha veio de uma assinatura no cartão. */
  payment_id: string | null
  source: SubscriptionSource
  status: SubscriptionStatus
  /**
   * No cartão: quando o Mercado Pago vai cobrar de novo.
   * No Pix: quando o acesso pago acaba. Nos dois casos é a data até quando o
   * acesso vale, que é o que has_active_subscription() consulta.
   */
  next_payment_date: string | null
  created_at: string
  updated_at: string
}

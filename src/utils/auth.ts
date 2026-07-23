import { supabase } from '../lib/supabase'
import { User } from '../types'
import { getProfile } from './profile'

const buildUser = async (authUser: {
  id: string
  email?: string
  created_at: string
  updated_at?: string
}): Promise<User> => {
  const profile = await getProfile(authUser.id)
  return {
    id: authUser.id,
    email: authUser.email!,
    username: profile?.username ?? undefined,
    age: profile?.age ?? null,
    sex: profile?.sex ?? null,
    goal: profile?.goal ?? null,
    heightCm: profile?.height_cm ?? null,
    weightKg: profile?.weight_kg ?? null,
    onboardingCompletedAt: profile?.onboarding_completed_at ?? null,
    created_at: authUser.created_at,
    updated_at: authUser.updated_at || authUser.created_at,
  }
}

export const signUp = async (
  email: string,
  password: string
): Promise<{ user: User | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) throw error

    if (data.user) {
      const user = await buildUser(data.user)
      return { user, error: null }
    }

    return { user: null, error: null }
  } catch (error) {
    return { user: null, error: error as Error }
  }
}

export const signIn = async (email: string, password: string): Promise<{ user: User | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    if (data.user) {
      const user = await buildUser(data.user)
      return { user, error: null }
    }

    return { user: null, error: null }
  } catch (error) {
    return { user: null, error: error as Error }
  }
}

export const signOut = async (): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { error: null }
  } catch (error) {
    return { error: error as Error }
  }
}

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      return await buildUser(user)
    }

    return null
  } catch (error) {
    return null
  }
}

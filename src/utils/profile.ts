import { supabase } from '../lib/supabase'
import { Sex, Goal } from '../types'

export const getIsAdmin = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()

  if (error || !data) return false
  return !!data.is_admin
}

export interface ProfileRow {
  username: string | null
  age: number | null
  sex: Sex | null
  goal: Goal | null
  height_cm: number | null
  weight_kg: number | null
  onboarding_completed_at: string | null
}

export const getProfile = async (userId: string): Promise<ProfileRow | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('username, age, sex, goal, height_cm, weight_kg, onboarding_completed_at')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data as ProfileRow
}

export interface ProfileUpdateFields {
  username: string
  age: number
  sex: Sex
  goal: Goal
  height_cm: number
  weight_kg: number
  onboarding_completed_at: string
}

export const updateProfileFields = async (
  userId: string,
  fields: Partial<ProfileUpdateFields>
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase.from('profiles').update(fields).eq('id', userId)
    if (error) throw error
    return { error: null }
  } catch (error) {
    return { error: error as Error }
  }
}

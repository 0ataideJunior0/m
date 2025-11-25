import { supabase } from '../lib/supabase'
import { User } from '../types'

export const signUp = async (
  email: string,
  password: string,
  username?: string
): Promise<{ user: User | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: username ? { username } : undefined,
      },
    })

    if (error) throw error

    if (data.user) {
      const user: User = {
        id: data.user.id,
        email: data.user.email!,
        username: (data.user.user_metadata as Record<string, unknown>)?.username as string | undefined,
        created_at: data.user.created_at,
        updated_at: data.user.updated_at || data.user.created_at,
      }
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
      const user: User = {
        id: data.user.id,
        email: data.user.email!,
        username: (data.user.user_metadata as Record<string, unknown>)?.username as string | undefined,
        created_at: data.user.created_at,
        updated_at: data.user.updated_at || data.user.created_at,
      }
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
      return {
        id: user.id,
        email: user.email!,
        username: (user.user_metadata as Record<string, unknown>)?.username as string | undefined,
        created_at: user.created_at,
        updated_at: user.updated_at || user.created_at,
      }
    }
    
    return null
  } catch (error) {
    return null
  }
}

import { create } from 'zustand'
import { User } from '../types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isAdmin: boolean
  needsOnboarding: boolean
  setUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
  setIsAdmin: (isAdmin: boolean) => void
  setNeedsOnboarding: (needsOnboarding: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isAdmin: false,
  needsOnboarding: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  setNeedsOnboarding: (needsOnboarding) => set({ needsOnboarding }),
  logout: () => set({ user: null, isAuthenticated: false, isAdmin: false, needsOnboarding: false }),
}))

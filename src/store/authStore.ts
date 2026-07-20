import { create } from 'zustand'
import { User } from '../types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isAdmin: boolean
  setUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
  setIsAdmin: (isAdmin: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isAdmin: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  logout: () => set({ user: null, isAuthenticated: false, isAdmin: false }),
}))

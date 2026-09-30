import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function RequireOnboarding({ children }: { children: JSX.Element }) {
  const { isAuthenticated, needsOnboarding, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-border-card border-t-accent animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}

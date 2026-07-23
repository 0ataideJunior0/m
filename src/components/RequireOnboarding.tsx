import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function RequireOnboarding({ children }: { children: JSX.Element }) {
  const { needsOnboarding, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-purple-600 animate-spin" />
      </div>
    )
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}

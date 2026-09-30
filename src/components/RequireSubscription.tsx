import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Spinner from './ui/Spinner'

export default function RequireSubscription({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isAdmin, hasActiveSubscription, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin && !hasActiveSubscription) {
    return <Navigate to="/subscribe" replace />
  }

  return children
}

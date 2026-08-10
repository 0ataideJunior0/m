import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Spinner from './ui/Spinner'

export default function RequireSubscription({ children }: { children: JSX.Element }) {
  const { isAdmin, hasActiveSubscription, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAdmin && !hasActiveSubscription) {
    return <Navigate to="/subscribe" replace />
  }

  return children
}

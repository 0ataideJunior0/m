import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Spinner from './ui/Spinner'

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuthStore()

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

  return children
}

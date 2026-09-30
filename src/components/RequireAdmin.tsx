import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function RequireAdmin({ children }: { children: JSX.Element }) {
  const { isAdmin, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-border-card border-t-accent animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/home" replace />
  }

  return children
}

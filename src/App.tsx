import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { getCurrentUser } from './utils/auth'
import Login from './pages/Login'
import Register from './pages/Register'
import WorkoutDay from './pages/WorkoutDay'
import Progress from './pages/Progress'
import Profile from './pages/Profile'
import Home from './pages/Home'
import HIIT from './pages/HIIT'
import ForgotPassword from './pages/ForgotPassword'
import ResetConfirm from './pages/ResetConfirm'
import ResetPassword from './pages/ResetPassword'
import PageTransition from './components/PageTransition'
import { persistCurrentSession, tryRestoreSession, clearPersistedSession } from './utils/authPersist'

function App() {
  const { setUser, setIsLoading } = useAuthStore()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser()
        if (user) {
          let username = user.username
          if (!username) {
            try {
              const stored = localStorage.getItem('musa_username') || ''
              username = stored || undefined
            } catch {}
          }
          setUser({ ...user, username })
          await persistCurrentSession()
        } else {
          const restored = await tryRestoreSession()
          if (restored) {
            const u = await getCurrentUser()
            if (u) {
              setUser(u)
              await persistCurrentSession()
            } else {
              setUser(null)
            }
          } else {
            setUser(null)
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [setUser, setIsLoading])

  useEffect(() => {
    let timer: any
    const INACTIVITY_MS = 30 * 60 * 1000
    const reset = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        try {
          await (await import('./utils/auth')).signOut()
          clearPersistedSession()
        } finally {
          useAuthStore.getState().logout()
        }
      }, INACTIVITY_MS)
    }
    const events = ['mousemove','keydown','touchstart','click'] as const
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      if (timer) clearTimeout(timer)
    }
  }, [])

  return (
    <BrowserRouter>
      <PageTransition />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/reset-confirm" element={<ResetConfirm />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/home" element={<Home />} />
        <Route path="/hiit" element={<HIIT />} />
        <Route path="/workout/:day" element={<WorkoutDay />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

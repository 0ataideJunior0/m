import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, Suspense, lazy } from 'react'
import { useAuthStore } from './store/authStore'
import { getCurrentUser } from './utils/auth'
import { getIsAdmin } from './utils/profile'
import PageTransition from './components/PageTransition'
import { persistCurrentSession, tryRestoreSession, clearPersistedSession } from './utils/authPersist'
import RequireAdmin from './components/RequireAdmin'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const WorkoutDay = lazy(() => import('./pages/WorkoutDay'))
const Progress = lazy(() => import('./pages/Progress'))
const Profile = lazy(() => import('./pages/Profile'))
const Home = lazy(() => import('./pages/Home'))
const HIIT = lazy(() => import('./pages/HIIT'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetConfirm = lazy(() => import('./pages/ResetConfirm'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const AdminWorkoutList = lazy(() => import('./pages/admin/AdminWorkoutList'))
const AdminWorkoutEdit = lazy(() => import('./pages/admin/AdminWorkoutEdit'))

function App() {
  const { setUser, setIsLoading, setIsAdmin } = useAuthStore()

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
          setIsAdmin(await getIsAdmin(user.id))
          await persistCurrentSession()
        } else {
          const restored = await tryRestoreSession()
          if (restored) {
            const u = await getCurrentUser()
            if (u) {
              setUser(u)
              setIsAdmin(await getIsAdmin(u.id))
              await persistCurrentSession()
            } else {
              setUser(null)
              setIsAdmin(false)
            }
          } else {
            setUser(null)
            setIsAdmin(false)
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setUser(null)
        setIsAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [setUser, setIsLoading, setIsAdmin])

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
      <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center"><div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-purple-600 animate-spin" /></div>}>
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
          <Route path="/admin/workouts" element={<RequireAdmin><AdminWorkoutList /></RequireAdmin>} />
          <Route path="/admin/workouts/:day" element={<RequireAdmin><AdminWorkoutEdit /></RequireAdmin>} />
          <Route path="/" element={<Navigate to="/home" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App

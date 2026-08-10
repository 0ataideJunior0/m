import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useRef, Suspense, lazy } from 'react'
import { useAuthStore } from './store/authStore'
import { getCurrentUser } from './utils/auth'
import { getIsAdmin } from './utils/profile'
import { getHasActiveSubscription } from './utils/subscription'
import PageTransition from './components/PageTransition'
import ThemeInit from './components/ThemeInit'
import Layout from './components/Layout'
import RequireAdmin from './components/RequireAdmin'
import RequireOnboarding from './components/RequireOnboarding'
import RequireSubscription from './components/RequireSubscription'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const WorkoutDay = lazy(() => import('./pages/WorkoutDay'))
const ProgramDays = lazy(() => import('./pages/ProgramDays'))
const Profile = lazy(() => import('./pages/Profile'))
const Home = lazy(() => import('./pages/Home'))
const HIIT = lazy(() => import('./pages/HIIT'))
const Subscribe = lazy(() => import('./pages/Subscribe'))
const MySubscription = lazy(() => import('./pages/MySubscription'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetConfirm = lazy(() => import('./pages/ResetConfirm'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminProgramList = lazy(() => import('./pages/admin/AdminProgramList'))
const AdminWorkoutList = lazy(() => import('./pages/admin/AdminWorkoutList'))
const AdminWorkoutEdit = lazy(() => import('./pages/admin/AdminWorkoutEdit'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))

// Limpeza one-shot de chaves órfãs deixadas por mecanismos removidos:
// - musa_auth_enc: cache de sessão cifrado (utils/authPersist.ts, removido
//   na Fase 3 — o Supabase já persiste sessão nativamente via
//   persistSession/autoRefreshToken, e a "criptografia" derivava a chave do
//   próprio refresh token que estava protegendo, sem adicionar garantia)
// - csrf_token: token de CSRF que nenhum servidor validava (utils/security.ts,
//   removido na Fase 3 — o Supabase autentica por Bearer token, não por
//   cookie, então CSRF não se aplica a essa arquitetura)
function cleanupOrphanedStorage() {
  try { localStorage.removeItem('musa_auth_enc') } catch {}
  try { sessionStorage.removeItem('csrf_token') } catch {}
}

function App() {
  const { setUser, setIsLoading, setIsAdmin, setNeedsOnboarding, setHasActiveSubscription } = useAuthStore()
  const lastResetAt = useRef(0)

  useEffect(() => {
    cleanupOrphanedStorage()

    const checkAuth = async () => {
      try {
        const user = await getCurrentUser()
        if (user) {
          setUser(user)
          setIsAdmin(await getIsAdmin(user.id))
          setNeedsOnboarding(!user.onboardingCompletedAt)
          setHasActiveSubscription(await getHasActiveSubscription(user.id))
        } else {
          setUser(null)
          setIsAdmin(false)
          setNeedsOnboarding(false)
          setHasActiveSubscription(false)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setUser(null)
        setIsAdmin(false)
        setNeedsOnboarding(false)
        setHasActiveSubscription(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [setUser, setIsLoading, setIsAdmin, setNeedsOnboarding, setHasActiveSubscription])

  useEffect(() => {
    let timer: any
    const INACTIVITY_MS = 30 * 60 * 1000
    const RESET_THROTTLE_MS = 30 * 1000
    const reset = () => {
      const now = Date.now()
      if (now - lastResetAt.current < RESET_THROTTLE_MS) return
      lastResetAt.current = now
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        try {
          await (await import('./utils/auth')).signOut()
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
      <ThemeInit />
      <PageTransition />
      <Layout>
        <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center"><div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-purple-600 animate-spin" /></div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot" element={<ForgotPassword />} />
            <Route path="/reset-confirm" element={<ResetConfirm />} />
            <Route path="/reset" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/profile" element={<RequireOnboarding><Profile /></RequireOnboarding>} />
            <Route path="/subscribe" element={<RequireOnboarding><Subscribe /></RequireOnboarding>} />
            <Route path="/minha-assinatura" element={<RequireOnboarding><MySubscription /></RequireOnboarding>} />
            <Route path="/home" element={<RequireOnboarding><RequireSubscription><Home /></RequireSubscription></RequireOnboarding>} />
            <Route path="/hiit" element={<RequireOnboarding><RequireSubscription><HIIT /></RequireSubscription></RequireOnboarding>} />
            <Route path="/program/:slug" element={<RequireOnboarding><RequireSubscription><ProgramDays /></RequireSubscription></RequireOnboarding>} />
            <Route path="/program/:slug/day/:weekday" element={<RequireOnboarding><RequireSubscription><WorkoutDay /></RequireSubscription></RequireOnboarding>} />
            <Route path="/admin" element={<RequireOnboarding><RequireAdmin><AdminDashboard /></RequireAdmin></RequireOnboarding>} />
            <Route path="/admin/programs" element={<RequireOnboarding><RequireAdmin><AdminProgramList /></RequireAdmin></RequireOnboarding>} />
            <Route path="/admin/programs/:slug" element={<RequireOnboarding><RequireAdmin><AdminWorkoutList /></RequireAdmin></RequireOnboarding>} />
            <Route path="/admin/programs/:slug/day/:weekday" element={<RequireOnboarding><RequireAdmin><AdminWorkoutEdit /></RequireAdmin></RequireOnboarding>} />
            <Route path="/admin/users" element={<RequireOnboarding><RequireAdmin><AdminUsers /></RequireAdmin></RequireOnboarding>} />
            <Route path="/" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  )
}

export default App

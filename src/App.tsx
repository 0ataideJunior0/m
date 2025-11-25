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
import PageTransition from './components/PageTransition'

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
        } else {
          setUser(null)
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

  return (
    <BrowserRouter>
      <PageTransition />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/home" element={<Home />} />
        <Route path="/workout/:day" element={<WorkoutDay />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

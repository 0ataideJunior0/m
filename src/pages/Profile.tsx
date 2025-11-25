import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getUserProgress } from '../utils/workouts'
import { UserProgress } from '../types'
import { ChevronLeft, Trophy, Calendar, Ribbon, Sparkles, Target } from 'lucide-react'
import { signOut } from '../utils/auth'

export default function Profile() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const [progress, setProgress] = useState<UserProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [clicked, setClicked] = useState(false)
  const [offsetY, setOffsetY] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    load()
  }, [isAuthenticated])

  const load = async () => {
    if (!user) return
    try {
      const data = await getUserProgress(user.id)
      setProgress(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0
      setOffsetY(Math.min(12, y * 0.06))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const completedDays = progress.filter(p => p.completed).length
  const remainingDays = Math.max(20 - completedDays, 0)
  const progressPct = Math.round((completedDays / 20) * 100)

  const firstAchievementDate = useMemo(() => {
    const done = progress.filter(p => p.completed && p.completed_at)
    if (done.length === 0) return null
    const sorted = [...done].sort((a, b) => new Date(a.completed_at as string).getTime() - new Date(b.completed_at as string).getTime())
    return new Date(sorted[0].completed_at as string)
  }, [progress])

  const timeUsingApp = useMemo(() => {
    if (!user) return '—'
    const created = new Date(user.created_at)
    const now = new Date()
    const diffMs = now.getTime() - created.getTime()
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (days > 0) return `${days} dia${days > 1 ? 's' : ''}`
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    return `${hours} hora${hours !== 1 ? 's' : ''}`
  }, [user])

  const displayName = useMemo(() => {
    const name = (user?.username || user?.email.split('@')[0] || '').trim()
    return name || 'Usuária Musa'
  }, [user])

  const initials = useMemo(() => {
    const name = (user?.username || '').trim()
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean)
      const first = parts[0]?.[0] || ''
      const second = parts[1]?.[0] || (user?.email?.[0] || '')
      return (first + second).toUpperCase()
    }
    const prefix = user?.email?.split('@')[0] || ''
    return prefix.slice(0, 2).toUpperCase()
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-purple-200 rounded-full mx-auto mb-4"></div>
          <div className="h-4 bg-purple-200 rounded w-32 mx-auto mb-2"></div>
          <div className="h-4 bg-purple-200 rounded w-24 mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 animate-fade-in">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center mb-4">
          <button onClick={() => navigate(-1)} className="mr-3 p-2 rounded-lg hover:bg-black/5">
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Meu Perfil</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 text-center animate-slide-up" style={{ transform: `translateY(${offsetY}px)` }}>
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full mx-auto mb-4 bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center shadow-md">
            <span className="text-white text-2xl md:text-3xl font-bold">{initials}</span>
          </div>
          <div className="font-bold text-xl text-gray-900 mb-1">{displayName}</div>
          <div className="text-gray-600">{user?.email}</div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 animate-slide-up">
          <div className="flex items-center mb-2">
            <Trophy className="w-5 h-5 text-pink-500 mr-2" />
            <span className="text-lg font-bold text-gray-900">Suas Conquistas</span>
          </div>
          <p className="text-sm text-gray-600 mb-6">Acompanhe seu progresso no desafio de 20 dias</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl p-6 text-center bg-purple-50 transition-transform duration-300 hover:scale-[1.02]">
              <Calendar className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <div className="text-4xl font-bold text-gray-900">{completedDays}</div>
              <div className="text-gray-600 text-sm">Dias Completos</div>
            </div>

            <div className="rounded-xl p-6 text-center bg-pink-50 transition-transform duration-300 hover:scale-[1.02]">
              <Ribbon className="w-6 h-6 text-pink-400 mx-auto mb-2" />
              <div className="text-4xl font-bold text-gray-900">{remainingDays}</div>
              <div className="text-gray-600 text-sm">Dias Restantes</div>
            </div>

            <div className="rounded-xl p-6 text-center bg-green-50 transition-transform duration-300 hover:scale-[1.02]">
              <Sparkles className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <div className="text-4xl font-bold text-gray-900">{progressPct}%</div>
              <div className="text-gray-600 text-sm">Progresso</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 animate-slide-up">
          <div className="flex items-center mb-4">
            <Trophy className="w-5 h-5 text-pink-500 mr-2" />
            <span className="text-lg font-bold text-gray-900">Badges Conquistadas</span>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl p-4 bg-gray-50 flex items-center transition-colors duration-300 hover:bg-gray-100">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 flex items-center justify-center mr-3">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">Primeira Conquista</div>
                <div className="text-sm text-gray-600">
                  {firstAchievementDate ? firstAchievementDate.toLocaleDateString() : 'Ainda não conquistada'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-24 animate-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Tempo de uso do aplicativo</div>
              <div className="text-lg font-semibold text-gray-900">{timeUsingApp}</div>
            </div>
            <button
              onClick={() => navigate('/progress')}
              className="px-5 py-3 rounded-full bg-white border border-gray-300 shadow-sm text-blue-700 hover:bg-blue-50 transition-transform duration-300 hover:scale-[1.03] active:scale-95"
            >
              Ver Cronograma Completo
            </button>
          </div>
        </div>

        <div className="fixed left-0 right-0 bottom-0 bg-transparent p-4">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={async () => {
                setClicked(true)
                await signOut()
                useAuthStore.getState().logout()
                navigate('/login')
              }}
              className="w-full bg-red-500 text-white py-4 rounded-full shadow-lg hover:bg-red-600 font-medium transition-transform duration-300 hover:scale-[1.02] active:scale-95"
            >
              {clicked ? 'Saindo...' : 'Sair da Conta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


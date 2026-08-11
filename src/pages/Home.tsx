import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getPrograms } from '../utils/workouts'
import { Trophy, Flame } from 'lucide-react'
import { Program } from '../types'

export default function Home() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading } = useAuthStore()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [logoSrc, setLogoSrc] = useState('/logo.png')
  const logoCandidates = useMemo(() => ['/logo.png', '/logo.svg', '/logo.webp', '/logo.jpg', '/logo.ico'], [])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login')
      return
    }
    if (isAuthenticated && user) {
      load()
    }
  }, [isAuthenticated, isLoading, user])

  const load = async () => {
    if (!user) return
    try {
      const data = await getPrograms()
      setPrograms(data)
    } finally {
      setLoading(false)
    }
  }

  const displayName = useMemo(() => {
    const name = (user?.username || user?.email.split('@')[0] || '').trim()
    return name || 'Usuária Musa'
  }, [user])

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-purple-200 dark:bg-purple-900/40 rounded-full mx-auto mb-4"></div>
          <div className="h-4 bg-purple-200 dark:bg-purple-900/40 rounded w-32 mx-auto mb-2"></div>
          <div className="h-4 bg-purple-200 dark:bg-purple-900/40 rounded w-24 mx-auto"></div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg">
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-24">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <img
              src={logoSrc}
              alt="Logo Musa Fit"
              className="w-12 h-12 mr-3 rounded-full shadow-md object-contain"
              onError={() => {
                const i = logoCandidates.indexOf(logoSrc)
                const next = logoCandidates[i + 1]
                if (next) setLogoSrc(next)
              }}
            />
            <div>
              <div className="text-2xl font-bold text-purple-800 dark:text-purple-300">Musa Fit</div>
              <div className="text-sm text-text-muted">Olá, {displayName}!</div>
            </div>
          </div>
        </div>

        <div id="treinos" className="bg-surface rounded-2xl shadow-lg p-6 mb-6">
          <div className="text-xl font-bold text-text mb-4">Treinos</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {programs.map((program) => (
              <button
                key={program.id}
                onClick={() => navigate(`/program/${program.slug}`)}
                style={{ backgroundImage: `url(/programs/${program.slug}.jpg)` }}
                className="relative aspect-[16/10] rounded-2xl shadow-md overflow-hidden text-left hover:shadow-lg transition transform hover:scale-[1.01] bg-cover bg-center bg-purple-900"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="text-white font-extrabold uppercase leading-tight text-2xl md:text-3xl">Treino</div>
                  <div className="text-white font-extrabold uppercase leading-tight text-2xl md:text-3xl">{program.name}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center mb-2">
            <Flame className="w-5 h-5 text-red-500 mr-2" />
            <div className="text-xl font-bold text-text">HIIT Opcional • Gordura + Abdômen</div>
          </div>
          <p className="text-text-muted">30 minutos no formato 40s ON / 20s OFF. Ideal para quem deseja acelerar a queima de gordura.</p>
          <button
            onClick={() => navigate('/hiit')}
            className="mt-4 w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 rounded-xl shadow-md hover:from-red-600 hover:to-pink-600 transition transform hover:scale-[1.01] active:scale-95"
          >
            Ver Treino HIIT Opcional
          </button>
        </div>

        {/* Planos Alimentares */}
        <div className="bg-surface rounded-2xl shadow-lg p-6 mb-6">
          <div className="text-xl font-bold text-text mb-4">Planos Alimentares</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/planos-ganho')}
              style={{ backgroundImage: 'url(/programs/ganhodemassa.jpg)' }}
              className="relative aspect-[16/10] rounded-2xl shadow-md overflow-hidden text-right hover:shadow-lg transition transform hover:scale-[1.01] bg-cover bg-center bg-purple-900"
            >
              <div className="absolute inset-0 bg-gradient-to-l from-black/85 via-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="text-white font-extrabold uppercase leading-tight text-2xl md:text-3xl">Ganho de</div>
                <div className="text-white font-extrabold uppercase leading-tight text-2xl md:text-3xl">Massa</div>
              </div>
            </button>

            <button
              onClick={() => navigate('/planos-perda')}
              style={{ backgroundImage: 'url(/programs/perdadegordura.png)' }}
              className="relative aspect-[16/10] rounded-2xl shadow-md overflow-hidden text-left hover:shadow-lg transition transform hover:scale-[1.01] bg-cover bg-center bg-purple-900"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="text-white font-extrabold uppercase leading-tight text-2xl md:text-3xl">Perda de</div>
                <div className="text-white font-extrabold uppercase leading-tight text-2xl md:text-3xl">Gordura</div>
              </div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => navigate('/profile')}
            className="bg-surface rounded-2xl shadow-md p-5 hover:shadow-lg transition text-center flex items-center justify-center space-x-2"
          >
            <Trophy className="w-5 h-5 text-text-muted" />
            <span className="font-medium text-text">Meu Perfil</span>
          </button>
        </div>
      </div>
    </div>
  )
}

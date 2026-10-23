import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getPrograms, getMyWeek, getMyPlan } from '../utils/workouts'
import { WEEKDAY_NAMES, todayWeekday } from '../utils/weekdays'
import { Trophy, Flame, Dumbbell, ChefHat } from 'lucide-react'
import { Program, Workout } from '../types'
import PixExpiryBanner from '../components/PixExpiryBanner'
import AmbientGlow from '../components/ui/AmbientGlow'

export default function Home() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading } = useAuthStore()
  const [programs, setPrograms] = useState<Program[]>([])
  const [myWeek, setMyWeek] = useState<Workout[]>([])
  const [hideCatalog, setHideCatalog] = useState(false)
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
      const [data, week, plan] = await Promise.all([getPrograms(), getMyWeek(user.id), getMyPlan(user.id)])
      setPrograms(data)
      setMyWeek(week)
      setHideCatalog(plan.hideCatalog)
    } finally {
      setLoading(false)
    }
  }

  const today = todayWeekday()
  const todayWorkout = myWeek.find((w) => w.weekday === today) || null
  // A admin pode esconder o catálogo pra quem tem semana própria; sem semana, o catálogo sempre aparece.
  const showCatalog = !(hideCatalog && myWeek.length > 0)

  const displayName = useMemo(() => {
    const name = (user?.username || user?.email.split('@')[0] || '').trim()
    return name || 'Usuária MusaFit'
  }, [user])

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-border-card rounded-full mx-auto mb-4"></div>
          <div className="h-4 bg-border-card rounded w-32 mx-auto mb-2"></div>
          <div className="h-4 bg-border-card rounded w-24 mx-auto"></div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) return null

  return (
    <div className="min-h-screen bg-bg relative overflow-hidden">
      <AmbientGlow className="w-80 h-80 -top-24 -left-24" />
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-24">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <img
              src={logoSrc}
              alt="Logo MusaFit"
              className="w-12 h-12 mr-3 rounded-full shadow-md object-contain"
              onError={() => {
                const i = logoCandidates.indexOf(logoSrc)
                const next = logoCandidates[i + 1]
                if (next) setLogoSrc(next)
              }}
            />
            <div>
              <div className="text-2xl font-extrabold tracking-tight text-text-strong">
                Musa<span className="font-accent">Fit</span>
              </div>
              <div className="text-sm text-text-muted">Olá, {displayName}!</div>
            </div>
          </div>
        </div>

        <PixExpiryBanner />

        {myWeek.length > 0 && (
          <div className="bg-surface border border-border-card rounded-3xl shadow-lg p-6 mb-6">
            <div className="flex items-center mb-2">
              <Dumbbell className="w-5 h-5 text-accent mr-2" />
              <div className="text-xl font-extrabold tracking-tight text-text-strong">Sua semana personalizada</div>
            </div>
            <p className="text-text-muted mb-4">
              {todayWorkout
                ? `Hoje (${WEEKDAY_NAMES[today - 1].toLowerCase()}): ${todayWorkout.title}`
                : 'Hoje é dia de descanso.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {todayWorkout && (
                <button
                  onClick={() => navigate(`/meu-treino/dia/${today}`)}
                  className="brand-gradient flex-1 py-3 rounded-xl shadow-cta hover:shadow-cta-hover hover:opacity-90 transition transform hover:scale-[1.01] active:scale-95"
                >
                  Treino de hoje
                </button>
              )}
              <button
                onClick={() => navigate('/meu-treino')}
                className={
                  todayWorkout
                    ? 'flex-1 py-3 rounded-xl border border-border bg-surface text-text font-medium hover:bg-surface-hover transition'
                    : 'brand-gradient flex-1 py-3 rounded-xl shadow-cta hover:shadow-cta-hover hover:opacity-90 transition transform hover:scale-[1.01] active:scale-95'
                }
              >
                Ver minha semana
              </button>
            </div>
          </div>
        )}

        {showCatalog && (
          <div id="treinos" className="bg-surface border border-border-card rounded-3xl shadow-lg p-6 mb-6">
            <div className="text-xl font-extrabold tracking-tight text-text-strong mb-4">Treinos</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {programs.map((program) => (
                <button
                  key={program.id}
                  onClick={() => navigate(`/program/${program.slug}`)}
                  style={{ backgroundImage: `url(/programs/${program.slug}.webp)` }}
                  className="relative aspect-[16/10] rounded-2xl shadow-md overflow-hidden text-left hover:shadow-lg transition transform hover:scale-[1.01] bg-cover bg-center bg-[#1A1423]"
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
        )}

        <div className="bg-surface border border-border-card rounded-3xl shadow-lg p-6 mb-6">
          <div className="flex items-center mb-2">
            <Flame className="w-5 h-5 text-red-500 mr-2" />
            <div className="text-xl font-extrabold tracking-tight text-text-strong">HIIT • Gordura + Abdômen</div>
          </div>
          <p className="text-text-muted mb-4">30 minutos no formato 40s ON / 20s OFF. Ideal para quem deseja acelerar a queima de gordura.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/hiit')}
              aria-label="Ver Treino HIIT"
              style={{ backgroundImage: 'url(/programs/hiit.webp)' }}
              className="relative aspect-[16/10] rounded-2xl shadow-md overflow-hidden text-left hover:shadow-lg transition transform hover:scale-[1.01] bg-cover bg-center bg-[#1A1423]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="text-white font-extrabold uppercase leading-tight text-2xl md:text-3xl">Treino</div>
                <div className="text-white font-extrabold uppercase leading-tight text-2xl md:text-3xl">HIIT</div>
              </div>
            </button>
          </div>
        </div>

        {/* Receitas da Musa */}
        <div className="bg-surface border border-border-card rounded-3xl shadow-lg p-6 mb-6">
          <div className="flex items-center mb-2">
            <ChefHat className="w-5 h-5 text-accent mr-2" />
            <div className="text-xl font-extrabold tracking-tight text-text-strong">Receitas da Musa</div>
          </div>
          <p className="text-text-muted mb-4">Receitas práticas com macros e vídeo do preparo.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/receitas')}
              aria-label="Ver receitas"
              style={{ backgroundImage: 'url(/programs/receitas.webp)' }}
              className="relative aspect-[16/10] rounded-2xl shadow-md overflow-hidden text-left hover:shadow-lg transition transform hover:scale-[1.01] bg-cover bg-center bg-[#1A1423]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="text-white font-extrabold uppercase leading-tight text-2xl md:text-3xl">Receitas</div>
                <div className="text-white font-extrabold uppercase leading-tight text-2xl md:text-3xl">da Musa</div>
              </div>
            </button>
          </div>
        </div>

        {/* Planos Alimentares */}
        <div className="bg-surface border border-border-card rounded-3xl shadow-lg p-6 mb-6">
          <div className="text-xl font-extrabold tracking-tight text-text-strong mb-4">Planos Alimentares</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/planos-ganho')}
              style={{ backgroundImage: 'url(/programs/ganhodemassa.webp)' }}
              className="relative aspect-[16/10] rounded-2xl shadow-md overflow-hidden text-right hover:shadow-lg transition transform hover:scale-[1.01] bg-cover bg-center bg-[#1A1423]"
            >
              <div className="absolute inset-0 bg-gradient-to-l from-black/85 via-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="text-white font-extrabold uppercase leading-tight text-2xl md:text-3xl">Ganho de</div>
                <div className="text-white font-extrabold uppercase leading-tight text-2xl md:text-3xl">Massa</div>
              </div>
            </button>

            <button
              onClick={() => navigate('/planos-perda')}
              style={{ backgroundImage: 'url(/programs/perdadegordura.webp)' }}
              className="relative aspect-[16/10] rounded-2xl shadow-md overflow-hidden text-left hover:shadow-lg transition transform hover:scale-[1.01] bg-cover bg-center bg-[#1A1423]"
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
            className="bg-surface border border-border-card rounded-3xl shadow-md p-5 hover:shadow-lg transition text-center flex items-center justify-center space-x-2"
          >
            <Trophy className="w-5 h-5 text-text-muted" />
            <span className="font-medium text-text">Meu Perfil</span>
          </button>
        </div>
      </div>
    </div>
  )
}

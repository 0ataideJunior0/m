import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getUserProgress, getCurrentDay, getWorkoutByDay } from '../utils/workouts'
import { Dumbbell, Trophy, Calendar, TrendingUp, Flame, Eye, X, Download } from 'lucide-react'
import { UserProgress, Workout } from '../types'
import { getSignedPlanUrl } from '../utils/plans'
import { trackEvent } from '../utils/analytics'

export default function Home() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading } = useAuthStore()
  const [progress, setProgress] = useState<UserProgress[]>([])
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalUrl, setModalUrl] = useState<string | null>(null)
  const [opening, setOpening] = useState<'mass_gain' | 'fat_loss' | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [modalTitle, setModalTitle] = useState<string>('')
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
      const userProgress = await getUserProgress(user.id)
      setProgress(userProgress)
      const day = getCurrentDay(userProgress)
      const w = await getWorkoutByDay(day)
      setWorkout(w)
    } finally {
      setLoading(false)
    }
  }

  const displayName = useMemo(() => {
    const name = (user?.username || user?.email.split('@')[0] || '').trim()
    return name || 'Usuária Musa'
  }, [user])

  const TOTAL_DAYS = 30
  const completedDays = progress.filter(p => p.completed).length
  const currentDay = getCurrentDay(progress)
  const remainingDays = Math.max(TOTAL_DAYS - completedDays, 0)
  const progressPct = Math.round((completedDays / TOTAL_DAYS) * 100)

  if (isLoading || loading) {
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

  if (!isAuthenticated || !user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
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
              <div className="text-2xl font-bold text-purple-800">Musa Fit</div>
              <div className="text-sm text-gray-600">Olá, {displayName}!</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold text-gray-900">Seu Progresso</div>
            <div className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 flex items-center">
              <Trophy className="w-4 h-4 mr-1" />
              <span className="font-semibold">{completedDays}/{TOTAL_DAYS}</span>
            </div>
          </div>
          <div className="text-sm text-gray-600 mt-1">{completedDays} de {TOTAL_DAYS} dias concluídos</div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Progresso</span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full h-3 bg-pink-100 rounded-full">
              <div className="h-3 bg-purple-500 rounded-full transition-all" style={{ width: `${progressPct}%` }}></div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-6 mt-6">
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-gray-700" />
              <div>
                <div className="text-sm text-gray-600">Dia Atual</div>
                <div className="text-xl font-bold text-purple-700">{currentDay <= TOTAL_DAYS ? currentDay : TOTAL_DAYS}</div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <TrendingUp className="w-5 h-5 text-gray-700" />
              <div>
                <div className="text-sm text-gray-600">Dias Restantes</div>
                <div className="text-xl font-bold text-pink-600">{remainingDays}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="text-xl font-bold text-gray-900 mb-1">Treino de Hoje</div>
          <div className="text-sm text-gray-600">Dia {currentDay}: {workout?.title?.replace(/^T-[A-E]:\s*/, '') || 'Treino do Dia'}</div>
          <p className="text-gray-700 mt-4">{workout?.exercises?.[0]?.note || 'Fortalecimento do corpo com exercícios focados.'}</p>
          <button
            onClick={() => {
              trackEvent('StartWorkout', { day: currentDay })
              navigate(`/workout/${currentDay}`)
            }}
            className="mt-6 w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 rounded-xl shadow-md hover:from-purple-700 hover:to-pink-600 transition transform hover:scale-[1.01] active:scale-95"
          >
            Iniciar Treino do Dia {currentDay}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center mb-2">
            <Flame className="w-5 h-5 text-red-500 mr-2" />
            <div className="text-xl font-bold text-gray-900">HIIT Opcional • Gordura + Abdômen</div>
          </div>
          <p className="text-gray-700">30 minutos no formato 40s ON / 20s OFF. Ideal para quem deseja acelerar a queima de gordura.</p>
          <button
            onClick={() => navigate('/hiit')}
            className="mt-4 w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 rounded-xl shadow-md hover:from-red-600 hover:to-pink-600 transition transform hover:scale-[1.01] active:scale-95"
          >
            Ver Treino HIIT Opcional
          </button>
        </div>

        {/* Planos Alimentares */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="text-xl font-bold text-gray-900 mb-2">Planos Alimentares (PDF)</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-md p-5 hover:shadow-lg transition transform hover:scale-[1.01] min-h-[140px]">
              <div className="text-lg md:text-xl font-semibold text-gray-900 mb-1">Ganho de Massa Muscular</div>
              <p className="text-sm text-gray-600 mb-4">Plano com foco em hipertrofia e superávit calórico.</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      setOpening('mass_gain')
                      const { url, meta } = await getSignedPlanUrl('mass_gain', 900)
                      setModalTitle(meta.title)
                      setModalUrl(url)
                      setPreviewLoading(true)
                    } catch (e: any) {
                      const msg = typeof e?.message === 'string' ? e.message : 'Erro ao gerar link seguro'
                      alert(`Pré-visualização indisponível no momento. ${msg}`)
                    } finally {
                      setOpening(null)
                    }
                  }}
                  className="ui-hover bg-white border border-gray-300 text-gray-900 px-4 py-2 rounded-lg flex items-center"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {opening === 'mass_gain' ? 'Abrindo...' : 'Visualizar'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md p-5 hover:shadow-lg transition transform hover:scale-[1.01] min-h-[140px]">
              <div className="text-lg md:text-xl font-semibold text-gray-900 mb-1">Perda de Gordura</div>
              <p className="text-sm text-gray-600 mb-4">Plano com foco em déficit calórico e definição.</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      setOpening('fat_loss')
                      const { url, meta } = await getSignedPlanUrl('fat_loss', 900)
                      setModalTitle(meta.title)
                      setModalUrl(url)
                      setPreviewLoading(true)
                    } catch (e: any) {
                      const msg = typeof e?.message === 'string' ? e.message : 'Erro ao gerar link seguro'
                      alert(`Pré-visualização indisponível no momento. ${msg}`)
                    } finally {
                      setOpening(null)
                    }
                  }}
                  className="ui-hover bg-white border border-gray-300 text-gray-900 px-4 py-2 rounded-lg flex items-center"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {opening === 'fat_loss' ? 'Abrindo...' : 'Visualizar'}
                </button>
              </div>
            </div>
          </div>
          
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/progress')}
            className="bg-white rounded-2xl shadow-md p-5 hover:shadow-lg transition text-center flex items-center justify-center space-x-2"
          >
            <Calendar className="w-5 h-5 text-gray-700" />
            <span className="font-medium text-gray-900">Ver Cronograma</span>
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="bg-white rounded-2xl shadow-md p-5 hover:shadow-lg transition text-center flex items-center justify-center space-x-2"
          >
            <Trophy className="w-5 h-5 text-gray-700" />
            <span className="font-medium text-gray-900">Meu Perfil</span>
          </button>
        </div>
      </div>
      {modalUrl && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col">
          <div className="bg-white/95 p-3 flex items-center justify-between">
            <div className="font-semibold text-gray-900">{modalTitle || 'Visualização do PDF'}</div>
            <div className="flex items-center gap-2">
              <a
                href={modalUrl}
                download
                rel="noopener"
                className="ui-hover bg-gradient-to-r from-purple-600 to-pink-500 text-white px-3 py-2 rounded-md flex items-center"
              >
                <Download className="w-4 h-4 mr-1" />
                Baixar
              </a>
              <button
                onClick={() => { setModalUrl(null); setPreviewLoading(false); }}
                className="ui-hover bg-white border border-gray-300 text-gray-900 px-3 py-2 rounded-md flex items-center"
                aria-label="Fechar"
              >
                <X className="w-4 h-4 mr-1" />
                Fechar
              </button>
            </div>
          </div>
          <div className="flex-1 bg-white">
            {previewLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-purple-600 animate-spin"></div>
              </div>
            )}
            <iframe
              src={modalUrl}
              title="Visualização do PDF"
              className="w-full h-full"
              onLoad={() => setPreviewLoading(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

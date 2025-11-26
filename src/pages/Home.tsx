import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getUserProgress, getCurrentDay, getWorkoutByDay } from '../utils/workouts'
import { Dumbbell, Share2, Trophy, Calendar, TrendingUp, Flame, FileDown, Eye } from 'lucide-react'
import { UserProgress, Workout } from '../types'
import { getSignedPlanUrl } from '../utils/plans'

export default function Home() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading } = useAuthStore()
  const [progress, setProgress] = useState<UserProgress[]>([])
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [loading, setLoading] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<'mass_gain' | 'fat_loss' | null>(null)

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

  const completedDays = progress.filter(p => p.completed).length
  const currentDay = getCurrentDay(progress)
  const remainingDays = Math.max(20 - completedDays, 0)
  const progressPct = Math.round((completedDays / 20) * 100)

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
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center shadow-md mr-3">
              <Dumbbell className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-800">Musa Fit</div>
              <div className="text-sm text-gray-600">Olá, {displayName}!</div>
            </div>
          </div>
          <button className="p-2 rounded-lg hover:bg-black/5 transition" aria-label="Compartilhar">
            <Share2 className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold text-gray-900">Seu Progresso</div>
            <div className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 flex items-center">
              <Trophy className="w-4 h-4 mr-1" />
              <span className="font-semibold">{completedDays}/20</span>
            </div>
          </div>
          <div className="text-sm text-gray-600 mt-1">{completedDays} de 20 dias concluídos</div>
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
                <div className="text-xl font-bold text-purple-700">{currentDay <= 20 ? currentDay : 20}</div>
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
            onClick={() => navigate(`/workout/${currentDay}`)}
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
          <p className="text-gray-700 mb-4">Selecione o plano desejado. Download seguro com validação de acesso.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="font-semibold text-gray-900 mb-1">Ganho de Massa Muscular</div>
              <p className="text-sm text-gray-600 mb-3">Plano com foco em hipertrofia e superávit calórico.</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      setDownloading('mass_gain')
                      const { url } = await getSignedPlanUrl('mass_gain', 300)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'plano_hipertrofia.pdf'
                      a.rel = 'noopener'
                      a.click()
                      setDownloading(null)
                    } catch (e: any) {
                      setDownloading(null)
                      const msg = typeof e?.message === 'string' ? e.message : 'Erro ao gerar link seguro'
                      alert(`Não foi possível baixar o plano. ${msg}`)
                    }
                  }}
                  className="ui-hover bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-2 rounded-lg flex items-center"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  {downloading === 'mass_gain' ? 'Baixando...' : 'Baixar PDF'}
                </button>
                <button
                  onClick={async () => {
                    try {
                      const { url } = await getSignedPlanUrl('mass_gain', 600)
                      const w = window.open(url, '_blank', 'noopener')
                      if (!w) setPreviewUrl(url)
                      else setPreviewUrl(null)
                    } catch (e: any) {
                      const msg = typeof e?.message === 'string' ? e.message : 'Erro ao gerar link seguro'
                      alert(`Pré-visualização indisponível no momento. ${msg}`)
                    }
                  }}
                  className="ui-hover bg-white border border-gray-300 text-gray-900 px-4 py-2 rounded-lg flex items-center"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Visualizar
                </button>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-4">
              <div className="font-semibold text-gray-900 mb-1">Perda de Gordura</div>
              <p className="text-sm text-gray-600 mb-3">Plano com foco em déficit calórico e definição.</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      setDownloading('fat_loss')
                      const { url } = await getSignedPlanUrl('fat_loss', 300)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'plano_perda_gordura.pdf'
                      a.rel = 'noopener'
                      a.click()
                      setDownloading(null)
                    } catch (e: any) {
                      setDownloading(null)
                      const msg = typeof e?.message === 'string' ? e.message : 'Erro ao gerar link seguro'
                      alert(`Não foi possível baixar o plano. ${msg}`)
                    }
                  }}
                  className="ui-hover bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-lg flex items-center"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  {downloading === 'fat_loss' ? 'Baixando...' : 'Baixar PDF'}
                </button>
                <button
                  onClick={async () => {
                    try {
                      const { url } = await getSignedPlanUrl('fat_loss', 600)
                      const w = window.open(url, '_blank', 'noopener')
                      if (!w) setPreviewUrl(url)
                      else setPreviewUrl(null)
                    } catch (e: any) {
                      const msg = typeof e?.message === 'string' ? e.message : 'Erro ao gerar link seguro'
                      alert(`Pré-visualização indisponível no momento. ${msg}`)
                    }
                  }}
                  className="ui-hover bg-white border border-gray-300 text-gray-900 px-4 py-2 rounded-lg flex items-center"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Visualizar
                </button>
              </div>
            </div>
          </div>

          {previewUrl && (
            <div className="mt-6">
              <div className="text-sm text-gray-600 mb-2">Pré-visualização (pode não funcionar em todos os navegadores). Se necessário, use o botão de download.</div>
              <div className="aspect-[4/5] bg-gray-100 rounded-lg overflow-hidden">
                <iframe src={previewUrl} title="Pré-visualização do PDF" className="w-full h-full" />
              </div>
              <div className="mt-3">
                <button onClick={() => setPreviewUrl(null)} className="ui-hover bg-white border border-gray-300 text-gray-900 px-4 py-2 rounded-lg">Fechar Pré-visualização</button>
              </div>
            </div>
          )}
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
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getUserProgress } from '../utils/workouts'
import { updateProfileFields } from '../utils/profile'
import { Goal, Sex, UserProgress } from '../types'
import { ChevronLeft, Trophy, Calendar, Sparkles, Target, Shield, Sun, Moon, Pencil } from 'lucide-react'
import { trackEvent } from '../utils/analytics'
import { signOut } from '../utils/auth'
import { useTheme } from '../hooks/useTheme'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import FormField from '../components/ui/FormField'
import Input from '../components/ui/Input'
import ChoiceGroup from '../components/ui/ChoiceGroup'

const SEX_LABELS: Record<Sex, string> = { feminino: 'Feminino', masculino: 'Masculino' }
const GOAL_LABELS: Record<Goal, string> = { emagrecer: 'Emagrecer', ganhar_musculo: 'Ganhar músculo', manter: 'Manter' }
const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'feminino', label: 'Feminino' },
  { value: 'masculino', label: 'Masculino' },
]
const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'emagrecer', label: 'Emagrecer' },
  { value: 'ganhar_musculo', label: 'Ganhar músculo' },
  { value: 'manter', label: 'Manter' },
]

export default function Profile() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isAdmin, setUser } = useAuthStore()
  const { theme, toggleTheme } = useTheme()
  const [progress, setProgress] = useState<UserProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [clicked, setClicked] = useState(false)
  const [offsetY, setOffsetY] = useState(0)

  const [activeModal, setActiveModal] = useState<'personal' | 'goal' | 'measures' | null>(null)
  const [savingModal, setSavingModal] = useState(false)
  const [nomeEdit, setNomeEdit] = useState('')
  const [idadeEdit, setIdadeEdit] = useState('')
  const [sexoEdit, setSexoEdit] = useState<Sex | null>(null)
  const [objetivoEdit, setObjetivoEdit] = useState<Goal | null>(null)
  const [alturaEdit, setAlturaEdit] = useState('')
  const [pesoEdit, setPesoEdit] = useState('')

  const openPersonalModal = () => {
    setNomeEdit(user?.username || '')
    setIdadeEdit(user?.age ? String(user.age) : '')
    setSexoEdit(user?.sex ?? null)
    setActiveModal('personal')
  }

  const openGoalModal = () => {
    setObjetivoEdit(user?.goal ?? null)
    setActiveModal('goal')
  }

  const openMeasuresModal = () => {
    setAlturaEdit(user?.heightCm ? String(user.heightCm) : '')
    setPesoEdit(user?.weightKg ? String(user.weightKg) : '')
    setActiveModal('measures')
  }

  const savePersonal = async () => {
    if (!user) return
    setSavingModal(true)
    try {
      const age = parseInt(idadeEdit, 10)
      const { error } = await updateProfileFields(user.id, {
        username: nomeEdit.trim(),
        age,
        sex: sexoEdit as Sex,
      })
      if (!error) {
        setUser({ ...user, username: nomeEdit.trim(), age, sex: sexoEdit })
        setActiveModal(null)
      }
    } finally {
      setSavingModal(false)
    }
  }

  const saveGoal = async () => {
    if (!user || !objetivoEdit) return
    setSavingModal(true)
    try {
      const { error } = await updateProfileFields(user.id, { goal: objetivoEdit })
      if (!error) {
        setUser({ ...user, goal: objetivoEdit })
        setActiveModal(null)
      }
    } finally {
      setSavingModal(false)
    }
  }

  const saveMeasures = async () => {
    if (!user) return
    setSavingModal(true)
    try {
      const height_cm = parseInt(alturaEdit, 10)
      const weight_kg = parseFloat(pesoEdit)
      const { error } = await updateProfileFields(user.id, { height_cm, weight_kg })
      if (!error) {
        setUser({ ...user, heightCm: height_cm, weightKg: weight_kg })
        setActiveModal(null)
      }
    } finally {
      setSavingModal(false)
    }
  }

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

  const CONSISTENCY_TARGET = 30
  const completedDays = progress.filter(p => p.completed).length

  useEffect(() => {
    try {
      const last = parseInt(localStorage.getItem('musa_last_completed') || '0')
      if (completedDays > last) {
        const el = document.getElementById('progress-bar-fill')
        if (el) {
          el.classList.add('ui-shimmer')
          setTimeout(() => el.classList.remove('ui-shimmer'), 1200)
        }
        localStorage.setItem('musa_last_completed', String(completedDays))
        trackEvent('DayCompleted', { completedDays })
      }
    } catch {}
  }, [completedDays])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        load()
      }
    }
    const id = setInterval(() => load(), 30000)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

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
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-40">
        <div className="flex items-center mb-4">
          <button onClick={() => navigate(-1)} className="mr-3 p-2 rounded-lg hover:bg-black/5">
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex-1">Meu Perfil</h1>
          <button
            onClick={toggleTheme}
            aria-label="Alternar tema claro/escuro"
            className="p-2 rounded-lg hover:bg-black/5"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-gray-800" /> : <Moon className="w-5 h-5 text-gray-800" />}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 text-center animate-slide-up" style={{ transform: `translateY(${offsetY}px)` }}>
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full mx-auto mb-4 bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center shadow-md">
            <span className="text-white text-2xl md:text-3xl font-bold">{initials}</span>
          </div>
          <div className="font-bold text-xl text-gray-900 mb-1">{displayName}</div>
          <div className="text-gray-600">{user?.email}</div>
        </div>

        {/* Progresso geral */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 animate-slide-up" aria-labelledby="progress-title">
          <div className="flex items-center mb-2">
            <Trophy className="w-5 h-5 text-pink-500 mr-2" />
            <span id="progress-title" className="text-lg font-bold text-gray-900">Seu progresso</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">Acompanhe seus treinos concluídos e conquistas</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl p-6 text-center bg-purple-50 transition-transform duration-300 hover:scale-[1.02]">
              <Calendar className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <div id="progress-bar-fill" className="text-4xl font-bold text-gray-900">{completedDays}</div>
              <div className="text-gray-600 text-sm">Treinos Concluídos</div>
            </div>

            <div className="rounded-xl p-6 text-center bg-green-50 transition-transform duration-300 hover:scale-[1.02]">
              <Sparkles className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <div className="text-4xl font-bold text-gray-900">{timeUsingApp}</div>
              <div className="text-gray-600 text-sm">Usando o Musa Fit</div>
            </div>
          </div>
        </div>

        {/* Conquistas por categorias */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 animate-slide-up">
          <div className="flex items-center mb-2">
            <Trophy className="w-5 h-5 text-pink-500 mr-2" />
            <span className="text-lg font-bold text-gray-900">Conquistas</span>
          </div>
          <p className="text-sm text-gray-600 mb-6">Categorias: Frequência, Desempenho, Consistência</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'Frequência', target: 10 },
              { name: 'Desempenho', target: 20 },
              { name: 'Consistência', target: CONSISTENCY_TARGET },
            ].map((c) => {
              const partial = Math.min(completedDays, c.target)
              const pct = Math.round((partial / c.target) * 100)
              return (
                <button key={c.name} className="rounded-xl p-4 bg-gray-50 text-left hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" aria-label={`Detalhes da conquista ${c.name}`}
                  onClick={() => alert(`${c.name}: ${pct}% concluído`) }>
                  <div className="flex items-center mb-2">
                    <Target className="w-5 h-5 text-purple-600 mr-2" />
                    <span className="font-medium text-gray-900">{c.name}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">{partial}/{c.target}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Dados pessoais */}
        <Card className="mb-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-bold text-gray-900 dark:text-text">Dados pessoais</span>
            <Button variant="secondary" size="icon" onClick={openPersonalModal} aria-label="Editar dados pessoais">
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-600 dark:text-text-muted">Nome</div>
              <div className="font-medium text-gray-900 dark:text-text truncate">{user?.username || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-text-muted">Idade</div>
              <div className="font-medium text-gray-900 dark:text-text">{user?.age ?? '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-text-muted">Sexo</div>
              <div className="font-medium text-gray-900 dark:text-text">{user?.sex ? SEX_LABELS[user.sex] : '—'}</div>
            </div>
          </div>
        </Card>

        {/* Objetivo */}
        <Card className="mb-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-bold text-gray-900 dark:text-text">Objetivo</span>
            <Button variant="secondary" size="icon" onClick={openGoalModal} aria-label="Editar objetivo">
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-center font-medium text-gray-900 dark:text-text">
            {user?.goal ? GOAL_LABELS[user.goal] : '—'}
          </div>
        </Card>

        {/* Medidas */}
        <Card className="mb-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-bold text-gray-900 dark:text-text">Medidas</span>
            <Button variant="secondary" size="icon" onClick={openMeasuresModal} aria-label="Editar medidas">
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-600 dark:text-text-muted">Altura</div>
              <div className="font-medium text-gray-900 dark:text-text">{user?.heightCm ? `${user.heightCm} cm` : '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-text-muted">Peso</div>
              <div className="font-medium text-gray-900 dark:text-text">{user?.weightKg ? `${user.weightKg} kg` : '—'}</div>
            </div>
          </div>
        </Card>

        <Modal
          open={activeModal === 'personal'}
          onClose={() => setActiveModal(null)}
          title="Editar dados pessoais"
          footer={
            <Button variant="primary" className="w-full" onClick={savePersonal} isLoading={savingModal}>
              Salvar
            </Button>
          }
        >
          <div className="p-6 space-y-4">
            <FormField label="Nome" htmlFor="edit-nome">
              <Input id="edit-nome" type="text" value={nomeEdit} onChange={(e) => setNomeEdit(e.target.value)} />
            </FormField>
            <FormField label="Idade" htmlFor="edit-idade">
              <Input id="edit-idade" type="number" inputMode="numeric" value={idadeEdit} onChange={(e) => setIdadeEdit(e.target.value)} />
            </FormField>
            <ChoiceGroup label="Sexo" name="edit-sexo" options={SEX_OPTIONS} value={sexoEdit} onChange={(v) => setSexoEdit(v as Sex)} />
          </div>
        </Modal>

        <Modal
          open={activeModal === 'goal'}
          onClose={() => setActiveModal(null)}
          title="Editar objetivo"
          footer={
            <Button variant="primary" className="w-full" onClick={saveGoal} isLoading={savingModal}>
              Salvar
            </Button>
          }
        >
          <div className="p-6">
            <ChoiceGroup label="Objetivo" name="edit-objetivo" options={GOAL_OPTIONS} value={objetivoEdit} onChange={(v) => setObjetivoEdit(v as Goal)} />
          </div>
        </Modal>

        <Modal
          open={activeModal === 'measures'}
          onClose={() => setActiveModal(null)}
          title="Editar medidas"
          footer={
            <Button variant="primary" className="w-full" onClick={saveMeasures} isLoading={savingModal}>
              Salvar
            </Button>
          }
        >
          <div className="p-6 space-y-4">
            <FormField label="Altura (cm)" htmlFor="edit-altura">
              <Input id="edit-altura" type="number" inputMode="numeric" value={alturaEdit} onChange={(e) => setAlturaEdit(e.target.value)} />
            </FormField>
            <FormField label="Peso (kg)" htmlFor="edit-peso">
              <Input id="edit-peso" type="number" inputMode="decimal" step="0.1" value={pesoEdit} onChange={(e) => setPesoEdit(e.target.value)} />
            </FormField>
          </div>
        </Modal>

        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="w-full bg-white rounded-2xl shadow-lg p-4 mb-6 flex items-center justify-center text-purple-700 hover:bg-purple-50 font-medium"
          >
            <Shield className="w-5 h-5 mr-2" /> Painel Admin
          </button>
        )}

        <div className="fixed left-0 right-0 bottom-16 bg-transparent p-4">
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

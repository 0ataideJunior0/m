import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { updateProfileFields, ProfileUpdateFields } from '../utils/profile'
import { Goal, Sex } from '../types'
import { ChevronLeft, ChevronRight, Flame, Shield, Sun, Moon, Pencil, CreditCard } from 'lucide-react'
import { trackEvent } from '../utils/analytics'
import { signOut } from '../utils/auth'
import {
  Completion,
  WEEKLY_GOAL,
  getCompletions,
  countByDay,
  computeStreaks,
  weekCount,
  longestWeekStreak,
  buildHeatmap,
  favoritePrograms,
  hasEarlyBird,
  buildAchievements,
} from '../utils/activity'
import { useTheme } from '../hooks/useTheme'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import FormField from '../components/ui/FormField'
import Input from '../components/ui/Input'
import ChoiceGroup from '../components/ui/ChoiceGroup'
import Toast from '../components/ui/Toast'
import AmbientGlow from '../components/ui/AmbientGlow'
import ActivityHeatmap from '../components/profile/ActivityHeatmap'
import AchievementsGrid from '../components/profile/AchievementsGrid'
import { useToast } from '../hooks/useToast'

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

const RING_LENGTH = 2 * Math.PI * 30

const cardClass = 'bg-surface border border-border-card rounded-3xl shadow-sm'

export default function Profile() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isAdmin, setUser } = useAuthStore()
  const { theme, toggleTheme } = useTheme()
  const [completions, setCompletions] = useState<Completion[]>([])
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const { toast, show: showToast, dismiss: dismissToast } = useToast()

  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nomeEdit, setNomeEdit] = useState('')
  const [idadeEdit, setIdadeEdit] = useState('')
  const [sexoEdit, setSexoEdit] = useState<Sex | null>(null)
  const [objetivoEdit, setObjetivoEdit] = useState<Goal | null>(null)
  const [alturaEdit, setAlturaEdit] = useState('')
  const [pesoEdit, setPesoEdit] = useState('')

  const openEdit = () => {
    setNomeEdit(user?.username || '')
    setIdadeEdit(user?.age ? String(user.age) : '')
    setSexoEdit(user?.sex ?? null)
    setObjetivoEdit(user?.goal ?? null)
    setAlturaEdit(user?.heightCm ? String(user.heightCm) : '')
    setPesoEdit(user?.weightKg ? String(user.weightKg) : '')
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!user) return
    const age = parseInt(idadeEdit, 10)
    const height = parseInt(alturaEdit, 10)
    const weight = parseFloat(pesoEdit.replace(',', '.'))

    const fields: Partial<ProfileUpdateFields> = {}
    if (nomeEdit.trim()) fields.username = nomeEdit.trim()
    if (!isNaN(age)) fields.age = age
    if (sexoEdit) fields.sex = sexoEdit
    if (objetivoEdit) fields.goal = objetivoEdit
    if (!isNaN(height)) fields.height_cm = height
    if (!isNaN(weight)) fields.weight_kg = weight

    setSaving(true)
    try {
      const { error } = await updateProfileFields(user.id, fields)
      if (error) {
        showToast('Não foi possível salvar. Confira os valores informados.')
        return
      }
      setUser({
        ...user,
        username: fields.username ?? user.username,
        age: fields.age ?? user.age,
        sex: fields.sex ?? user.sex,
        goal: fields.goal ?? user.goal,
        heightCm: fields.height_cm ?? user.heightCm,
        weightKg: fields.weight_kg ?? user.weightKg,
      })
      setEditOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const load = async () => {
    if (!user) return
    try {
      setCompletions(await getCompletions(user.id))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    load()
  }, [isAuthenticated])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [user?.id])

  const stats = useMemo(() => {
    const today = new Date()
    const counts = countByDay(completions)
    const { current, record } = computeStreaks(counts, today)
    const total = completions.length
    return {
      total,
      current,
      record,
      weekDone: weekCount(counts, today),
      heatmap: buildHeatmap(counts, today),
      favorites: favoritePrograms(completions).slice(0, 3),
      achievements: buildAchievements({
        total,
        record,
        weekStreak: longestWeekStreak(counts),
        earlyBird: hasEarlyBird(completions),
      }),
    }
  }, [completions])

  useEffect(() => {
    if (loading) return
    try {
      const last = parseInt(localStorage.getItem('musa_last_completed') || '0')
      if (stats.total > last) {
        localStorage.setItem('musa_last_completed', String(stats.total))
        trackEvent('DayCompleted', { completedDays: stats.total })
      }
    } catch {}
  }, [stats.total, loading])

  const displayName = useMemo(() => {
    const name = (user?.username || user?.email.split('@')[0] || '').trim()
    return name || 'Usuária MusaFit'
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

  const memberSince = useMemo(
    () => (user ? new Date(user.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : ''),
    [user]
  )

  if (loading) {
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

  const remaining = Math.max(0, WEEKLY_GOAL - stats.weekDone)
  const goalText = remaining === 0 ? 'Meta batida!' : remaining === 1 ? 'Falta 1 treino' : `Faltam ${remaining} treinos`
  const ringDash = Math.min(stats.weekDone / WEEKLY_GOAL, 1) * RING_LENGTH
  const topFavorite = Math.max(stats.favorites[0]?.count ?? 0, 1)

  const dataRows: { label: string; value: string }[] = [
    { label: 'Idade', value: user?.age ? `${user.age} anos` : '—' },
    { label: 'Altura', value: user?.heightCm ? `${user.heightCm} cm` : '—' },
    { label: 'Peso', value: user?.weightKg ? `${user.weightKg} kg` : '—' },
    { label: 'Objetivo', value: user?.goal ? GOAL_LABELS[user.goal] : '—' },
  ]

  return (
    <div className="min-h-screen bg-bg animate-fade-in relative overflow-hidden">
      <AmbientGlow className="w-80 h-80 -top-24 -right-24" />
      <div className="relative max-w-2xl mx-auto px-4 pt-5 pb-28 flex flex-col gap-4">
        <header className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} aria-label="Voltar" className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-surface-hover">
            <ChevronLeft className="w-6 h-6 text-text" />
          </button>
          <h1 className="flex-1 text-2xl md:text-3xl font-extrabold tracking-tight text-text-strong">
            Meu <span className="font-accent">perfil</span>
          </h1>
          <button
            onClick={toggleTheme}
            aria-label="Alternar tema claro/escuro"
            className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-surface-hover"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-text" /> : <Moon className="w-5 h-5 text-text" />}
          </button>
        </header>

        <section
          aria-label="Cartão de membro"
          className="relative overflow-hidden rounded-3xl p-6 bg-[#211A2C] dark:bg-[#1A1423] border border-[#211A2C] dark:border-[#44355A] text-[#F7E1D7] shadow-xl"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{ backgroundImage: 'radial-gradient(#DD98AF 1px, transparent 1px)', backgroundSize: '16px 16px' }}
          />
          <div aria-hidden="true" className="absolute -right-16 -bottom-24 w-52 h-52 rounded-full bg-accent opacity-[0.18] blur-3xl pointer-events-none" />
          <div className="relative flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 shrink-0 rounded-full brand-gradient flex items-center justify-center text-xl font-extrabold shadow-md">
                {initials}
              </div>
              <div className="min-w-0 flex flex-col gap-1">
                <span className="text-xl font-extrabold tracking-tight text-white truncate">{displayName}</span>
                <span className="text-sm opacity-70">
                  Musa desde <span className="font-serif italic text-accent">{memberSince}</span>
                </span>
              </div>
            </div>
            {user?.goal && (
              <span className="self-start inline-flex px-3.5 py-1.5 rounded-full bg-[#211A2C] border border-accent/30 text-accent text-[11px] font-bold tracking-wider uppercase">
                Objetivo · {GOAL_LABELS[user.goal].toLowerCase()}
              </span>
            )}
            <div className="grid grid-cols-3 border-t border-[#44355A] pt-4">
              {[
                { value: stats.total, label: 'treinos' },
                { value: stats.current, label: 'dias seguidos' },
                { value: stats.record, label: 'recorde' },
              ].map((item, i) => (
                <div key={item.label} className={`flex flex-col gap-0.5 ${i > 0 ? 'pl-3.5 border-l border-[#44355A]' : ''}`}>
                  <span className="text-2xl font-extrabold tracking-tight text-white">{item.value}</span>
                  <span className="text-xs opacity-70">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <section aria-label="Sequência atual" className={`${cardClass} p-4 flex flex-col gap-2.5`}>
            <span className="w-10 h-10 rounded-2xl bg-accent text-on-accent flex items-center justify-center shadow-md">
              <Flame className="w-5 h-5" aria-hidden="true" />
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl leading-none font-extrabold tracking-tight text-text-strong">{stats.current}</span>
              <span className="text-sm font-bold text-text-strong">{stats.current === 1 ? 'dia' : 'dias'}</span>
            </div>
            <span className="text-[13px] leading-snug text-text-muted">Sequência atual · recorde de {stats.record}</span>
          </section>

          <section aria-label="Meta da semana" className={`${cardClass} p-4 flex flex-col gap-2.5`}>
            <div className="relative w-16 h-16">
              <svg width="64" height="64" viewBox="0 0 72 72" aria-hidden="true" className="-rotate-90">
                <circle cx="36" cy="36" r="30" fill="none" strokeWidth="8" className="stroke-surface-hover" />
                <circle
                  cx="36"
                  cy="36"
                  r="30"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className="stroke-accent"
                  strokeDasharray={`${ringDash} ${RING_LENGTH}`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[15px] font-extrabold text-text-strong">
                {stats.weekDone}/{WEEKLY_GOAL}
              </span>
            </div>
            <span className="text-sm font-extrabold text-text-strong">Meta da semana</span>
            <span className="text-[13px] leading-snug text-text-muted">{goalText}</span>
          </section>
        </div>

        <ActivityHeatmap weeks={stats.heatmap} />

        <section aria-label="Programa favorito" className={`${cardClass} p-5 flex flex-col gap-4`}>
          <h2 className="text-xl font-extrabold tracking-tight text-text-strong">
            Seu programa <span className="font-accent">favorito</span>
          </h2>
          {stats.favorites.length === 0 ? (
            <p className="text-sm text-text-muted">Conclua um treino para ver qual programa você mais faz.</p>
          ) : (
            stats.favorites.map((fav) => (
              <div key={fav.name} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-text-strong">{fav.name}</span>
                  <span className="text-[13px] text-text-muted">{fav.count}×</span>
                </div>
                <div className="h-2 rounded-full bg-surface-hover overflow-hidden">
                  <div className="h-2 rounded-full brand-gradient" style={{ width: `${Math.round((fav.count / topFavorite) * 100)}%` }} />
                </div>
              </div>
            ))
          )}
        </section>

        <AchievementsGrid achievements={stats.achievements} />

        <section aria-label="Seus dados" className={`${cardClass} p-5`}>
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-xl font-extrabold tracking-tight text-text-strong">Seus dados</h2>
            <Button variant="secondary" size="icon" onClick={openEdit} aria-label="Editar dados">
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
          <dl>
            {dataRows.map((row, i) => (
              <div key={row.label} className={`flex justify-between py-3 ${i < dataRows.length - 1 ? 'border-b border-border' : ''}`}>
                <dt className="text-sm text-text-muted">{row.label}</dt>
                <dd className="text-sm font-bold text-text-strong">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {isAdmin ? (
          <button
            onClick={() => navigate('/admin')}
            className={`${cardClass} min-h-14 px-5 flex items-center gap-3 text-[15px] font-bold text-text-strong text-left`}
          >
            <Shield className="w-5 h-5 text-accent-text" aria-hidden="true" />
            <span className="flex-1">Painel Admin</span>
            <ChevronRight className="w-5 h-5 text-text-muted" aria-hidden="true" />
          </button>
        ) : (
          <button
            onClick={() => navigate('/minha-assinatura')}
            className={`${cardClass} min-h-14 px-5 flex items-center gap-3 text-[15px] font-bold text-text-strong text-left`}
          >
            <CreditCard className="w-5 h-5 text-accent-text" aria-hidden="true" />
            <span className="flex-1">Minha assinatura</span>
            <ChevronRight className="w-5 h-5 text-text-muted" aria-hidden="true" />
          </button>
        )}

        <button
          onClick={async () => {
            setLoggingOut(true)
            await signOut()
            useAuthStore.getState().logout()
            navigate('/login')
          }}
          className="min-h-11 text-sm font-bold text-red-700 dark:text-red-400"
        >
          {loggingOut ? 'Saindo...' : 'Sair da conta'}
        </button>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar dados"
        footer={
          <Button variant="primary" className="w-full" onClick={saveEdit} isLoading={saving}>
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
          <FormField label="Altura (cm)" htmlFor="edit-altura">
            <Input id="edit-altura" type="number" inputMode="numeric" value={alturaEdit} onChange={(e) => setAlturaEdit(e.target.value)} />
          </FormField>
          <FormField label="Peso (kg)" htmlFor="edit-peso">
            <Input id="edit-peso" type="number" inputMode="decimal" step="0.1" value={pesoEdit} onChange={(e) => setPesoEdit(e.target.value)} />
          </FormField>
          <ChoiceGroup label="Objetivo" name="edit-objetivo" options={GOAL_OPTIONS} value={objetivoEdit} onChange={(v) => setObjetivoEdit(v as Goal)} />
        </div>
      </Modal>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

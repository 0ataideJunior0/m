import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Copy, Moon } from 'lucide-react'
import {
  copyProgramToUserAdmin,
  getHideCatalogAdmin,
  listProgramsAdmin,
  listUserWeekAdmin,
  setHideCatalogAdmin,
} from '../../utils/adminWorkouts'
import { getUserProfileSummary, UserProfileSummary } from '../../utils/adminUsers'
import { Program, Workout } from '../../types'
import { WEEKDAYS, WEEKDAY_NAMES, WEEKDAY_SHORT } from '../../utils/weekdays'
import { cn } from '../../lib/utils'
import { useToast } from '../../hooks/useToast'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Toast from '../../components/ui/Toast'

export default function AdminUserWeek() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { toast, show: showToast, dismiss: dismissToast } = useToast()

  const [profile, setProfile] = useState<UserProfileSummary | null>(null)
  const [week, setWeek] = useState<Workout[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [hideCatalog, setHideCatalog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingHide, setSavingHide] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyFrom, setCopyFrom] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    load()
  }, [userId])

  const load = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const summary = await getUserProfileSummary(userId)
      if (!summary) {
        navigate('/admin/users')
        return
      }
      setProfile(summary)
      const [days, progs, hide] = await Promise.all([
        listUserWeekAdmin(userId),
        listProgramsAdmin(),
        getHideCatalogAdmin(userId).catch(() => false),
      ])
      setWeek(days)
      setPrograms(progs)
      setHideCatalog(hide)
    } catch (error) {
      console.error('Error loading personal week:', error)
      showToast('Não foi possível carregar a semana.')
    } finally {
      setLoading(false)
    }
  }

  const toggleHide = async () => {
    if (!userId) return
    const next = !hideCatalog
    setHideCatalog(next)
    setSavingHide(true)
    try {
      await setHideCatalogAdmin(userId, next)
      showToast(next ? 'Programas do catálogo escondidos.' : 'Programas do catálogo visíveis.', 'success')
    } catch (error: any) {
      setHideCatalog(!next)
      showToast(`Erro ao salvar. ${error?.message || ''}`)
    } finally {
      setSavingHide(false)
    }
  }

  const confirmCopy = async () => {
    if (!userId || !copyFrom) return
    setCopying(true)
    try {
      await copyProgramToUserAdmin(userId, copyFrom)
      setWeek(await listUserWeekAdmin(userId))
      setCopyOpen(false)
      showToast(`Semana copiada de ${programs.find((p) => p.id === copyFrom)?.name}. Agora é só ajustar.`, 'success')
    } catch (error: any) {
      showToast(`Erro ao copiar o programa. ${error?.message || ''}`)
    } finally {
      setCopying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-border-card border-t-accent animate-spin" />
      </div>
    )
  }

  const name = profile?.username || profile?.email || 'aluna'
  const byDay = new Map(week.map((w) => [w.weekday, w]))
  const trainingDays = week.length
  const selectedProgram = programs.find((p) => p.id === copyFrom)

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <PageHeader title={`Semana de ${name}`} onBack={() => navigate('/admin/users')} className="mb-1" />
        <p className="text-sm text-text-muted ml-[3.25rem] mb-6">
          {trainingDays === 0
            ? 'Ainda sem treinos. Copie um programa ou monte dia a dia.'
            : `${trainingDays} ${trainingDays === 1 ? 'dia de treino' : 'dias de treino'} · ${7 - trainingDays} de descanso`}
        </p>

        <section className="bg-surface border border-border-card rounded-3xl shadow-sm p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <h2 id="hide-catalog-label" className="font-extrabold text-text-strong">
                Esconder os programas do catálogo
              </h2>
              <p className="text-sm text-text-muted mt-0.5">
                {hideCatalog
                  ? `${name} vê só a semana dela na tela inicial.`
                  : `${name} vê a semana dela e também os programas do catálogo.`}
                {hideCatalog && trainingDays === 0 && ' Só vale quando a semana tiver pelo menos um treino.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={hideCatalog}
              aria-labelledby="hide-catalog-label"
              disabled={savingHide}
              onClick={toggleHide}
              className={cn(
                'relative shrink-0 w-12 h-7 rounded-full transition focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2 disabled:opacity-60',
                hideCatalog ? 'bg-accent' : 'bg-border'
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  hideCatalog && 'translate-x-5'
                )}
              />
            </button>
          </div>
        </section>

        <div className="flex items-end justify-between mb-3 px-1">
          <h2 className="text-lg font-extrabold tracking-tight text-text-strong">Dias da semana</h2>
          <Button variant="secondary" size="sm" onClick={() => setCopyOpen(true)}>
            <Copy className="w-4 h-4 mr-1.5" /> Copiar de um programa
          </Button>
        </div>

        <ol className="flex flex-col gap-2">
          {WEEKDAYS.map((day) => {
            const workout = byDay.get(day)
            const count = workout?.exercises?.length || 0
            return (
              <li key={day}>
                <Link
                  to={`/admin/users/${userId}/workout/day/${day}`}
                  aria-label={`${WEEKDAY_NAMES[day - 1]}: ${workout ? workout.title : 'descanso'}`}
                  className="flex items-center gap-3 bg-surface border border-border-card rounded-2xl shadow-sm p-3 pl-4 hover:bg-surface-hover transition focus:outline-none focus:ring-2 focus:ring-focus-ring"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-sm font-extrabold',
                      workout ? 'bg-accent/15 text-accent-text' : 'bg-surface-sunken text-text-muted'
                    )}
                  >
                    {WEEKDAY_SHORT[day - 1]}
                  </span>
                  <span className="flex-1 min-w-0">
                    {workout ? (
                      <>
                        <span className="block font-bold text-text-strong truncate">{workout.title || 'Sem título'}</span>
                        <span className="block text-xs text-text-muted">
                          {count} {count === 1 ? 'exercício' : 'exercícios'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center font-bold text-text-muted">
                          <Moon aria-hidden="true" className="w-4 h-4 mr-1.5" /> Descanso
                        </span>
                        <span className="block text-xs text-accent-text font-bold">+ Montar treino</span>
                      </>
                    )}
                  </span>
                  <ChevronRight aria-hidden="true" className="w-5 h-5 text-text-muted shrink-0" />
                </Link>
              </li>
            )
          })}
        </ol>
      </div>

      <Modal
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        title="Copiar de um programa"
        size="card"
        footer={
          <Button className="w-full" onClick={confirmCopy} isLoading={copying} disabled={!copyFrom}>
            {selectedProgram ? `Copiar ${selectedProgram.name}` : 'Escolha um programa'}
          </Button>
        }
      >
        <div className="p-5 space-y-4">
          <p className="text-sm text-text-muted">
            Os 7 dias do programa vão para a semana de {name}. Depois é só ajustar o que quiser, dia por dia.
          </p>
          <div role="radiogroup" aria-label="Programa" className="flex flex-col gap-2">
            {programs.map((p) => {
              const selected = copyFrom === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCopyFrom(p.id)}
                  className={cn(
                    'min-h-12 px-4 rounded-2xl text-left font-bold transition focus:outline-none focus:ring-2 focus:ring-focus-ring',
                    selected ? 'brand-gradient shadow-md' : 'bg-surface border border-border text-text hover:bg-surface-hover'
                  )}
                >
                  {p.name}
                </button>
              )
            })}
          </div>
          {trainingDays > 0 && (
            <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
              A semana atual de {name} ({trainingDays} {trainingDays === 1 ? 'dia' : 'dias'}) será substituída. Dias sem treino no
              programa viram descanso.
            </p>
          )}
        </div>
      </Modal>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

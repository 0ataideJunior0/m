import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getProgramBySlug, getWorkoutByProgramAndWeekday, markWorkoutComplete } from '../utils/workouts'
import { Workout as WorkoutType, Program } from '../types'
import { ArrowLeft } from 'lucide-react'
import ExerciseItem from '../components/ExerciseItem'
import ExerciseVideoModal from '../components/ExerciseVideoModal'
import { getExerciseKey } from '../utils/exerciseKeys'
import { clearLocalProgress } from '../utils/exerciseProgress'
import { resetExerciseProgress } from '../utils/exerciseProgressRemote'
import { useExerciseProgress } from '../hooks/useExerciseProgress'
import { useExerciseVideoModal } from '../hooks/useExerciseVideoModal'
import Toast from '../components/ui/Toast'
import WorkoutActionBar, { WorkoutSessionStatus } from '../components/WorkoutActionBar'
import { useActiveWorkout } from '../hooks/useActiveWorkout'

const WEEKDAY_NAMES = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']

export default function WorkoutDay() {
  const { slug, weekday } = useParams<{ slug: string; weekday: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated } = useAuthStore()
  const { active, start, clear: clearActive } = useActiveWorkout(user?.id)

  const [program, setProgram] = useState<Program | null>(null)
  const [workout, setWorkout] = useState<WorkoutType | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  const weekdayNumber = parseInt(weekday || '1')
  const weekdayLabel = WEEKDAY_NAMES[weekdayNumber - 1] || 'Dia'

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    loadWorkoutAndProgress()
  }, [isAuthenticated, slug, weekday, navigate])

  const loadWorkoutAndProgress = async () => {
    if (!user || !slug) return

    try {
      const prog = await getProgramBySlug(slug)
      setProgram(prog)
      if (!prog) return

      const workoutData = await getWorkoutByProgramAndWeekday(prog.id, weekdayNumber)
      setWorkout(workoutData)
    } catch (error) {
      console.error('Error loading workout:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteWorkout = async () => {
    if (!user || !workout || !slug) return

    setCompleting(true)
    try {
      const success = await markWorkoutComplete(user.id, workout.id)
      if (success) {
        const resetOk = await resetExerciseProgress(user.id, workout.id)
        if (!resetOk) {
          console.error('Workout marked complete but exercise checklist reset failed for workout', workout.id)
        }
        clearLocalProgress(user.id, workout.id)
        clearActive()
        navigate(`/program/${slug}`)
      }
    } catch (error) {
      console.error('Error completing workout:', error)
    } finally {
      setCompleting(false)
    }
  }

  const { exProgress, toggleExercise } = useExerciseProgress(user?.id, workout?.id)

  const sessionStatus: WorkoutSessionStatus = !active ? 'idle' : active.workoutId === workout?.id ? 'active' : 'blocked'

  const handleStartWorkout = () => {
    if (!workout || active) return
    start({ workoutId: workout.id, title: workout.title, path: location.pathname })
  }
  const lastActionRef = useRef<{ key: string; prev: boolean } | null>(null)
  const {
    videoUrl, videoTitle, modalOpen, videoLoading, videoDialogRef,
    toast, dismissToast, openExerciseVideo, closeVideoModal, onVideoLoaded,
  } = useExerciseVideoModal(workout)

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

  if (!workout) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-text-strong mb-2">Treino não encontrado</h2>
          <button
            onClick={() => navigate('/home')}
            className="text-accent-text hover:opacity-80"
          >
            Voltar à Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-28">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate(`/program/${slug}`)}
            className="mr-4 p-2 rounded-lg hover:bg-surface-hover transition"
          >
            <ArrowLeft className="w-6 h-6 text-text" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-text-strong leading-tight break-words">
              {workout.title}
            </h1>
            <p className="text-text-muted">{weekdayLabel} • {program?.name}</p>
          </div>
        </div>


        {/* Progresso exercícios */}
        {workout.exercises?.length ? (
          <div className="bg-surface border border-border-card rounded-3xl shadow-lg p-6 mb-6">
            {(() => {
              const total = workout.exercises.length
              const done = workout.exercises.reduce((acc, ex, i) => {
                const k = getExerciseKey(ex, i)
                return acc + (exProgress[k]?.completed ? 1 : 0)
              }, 0)
              const pct = Math.round((done / total) * 100)
              return (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xl font-extrabold tracking-tight text-text-strong">Progresso dos exercícios</div>
                    <div className="text-sm text-text-muted">{done}/{total}</div>
                  </div>
                  <div className="w-full bg-border rounded-full h-2">
                    <div className="bg-accent h-2 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                  </div>
                </>
              )
            })()}
          </div>
        ) : null}

        {/* Exercises */}
        <div className="bg-surface border border-border-card rounded-3xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-extrabold tracking-tight text-text-strong mb-6">Exercícios</h2>
          <div className="space-y-4">
            {(() => {
              const ordered = [...workout.exercises]
              const warmupItems = ordered.filter((ex) => ex.type === 'warmup')
              const others = ordered.filter((ex) => ex.type !== 'warmup')
              const finalOrder = [...warmupItems, ...others]

              const cards: JSX.Element[] = []
              for (let i = 0; i < finalOrder.length; i++) {
                const ex = finalOrder[i]
                if (ex.group) {
                  const g = ex.group
                  // Carrega o índice em finalOrder junto de cada item. A chave do
                  // exercício precisa do índice GLOBAL — usar o índice local ao
                  // grupo (0, 1) fazia dois bi-sets de mesmo rótulo produzirem
                  // chaves idênticas.
                  const groupItems: { exercise: typeof ex; globalIndex: number }[] = [
                    { exercise: ex, globalIndex: i },
                  ]
                  let j = i + 1
                  while (j < finalOrder.length && finalOrder[j].group === g) {
                    groupItems.push({ exercise: finalOrder[j], globalIndex: j })
                    j++
                  }
                  cards.push(
                    <div key={`group-${g}-${i}`} className="border border-accent/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-accent-text font-medium">Bi-set</span>
                        <span className="text-xs text-text-muted">Grupo {g}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groupItems.map(({ exercise, globalIndex }) => {
                          const k = getExerciseKey(exercise, globalIndex)
                          const completed = !!exProgress[k]?.completed
                          return (
                            <div key={`pair-${g}-${globalIndex}`} className="bg-accent/5 rounded-md p-3">
                              <ExerciseItem
                                exercise={exercise}
                                isCompleted={completed}
                                onToggle={() => {
                                  const k = getExerciseKey(exercise, globalIndex)
                                  lastActionRef.current = { key: k, prev: !!exProgress[k]?.completed }
                                  toggleExercise(exercise, globalIndex)
                                }}
                                hasVideo={!!(exercise.video || workout.video_url)}
                                onWatchVideo={() => openExerciseVideo(exercise)}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                  i = j - 1
                  continue
                }

                cards.push(
                  <div key={`single-${i}`} className="p-1">
                    <ExerciseItem
                      exercise={ex}
                      isCompleted={!!exProgress[getExerciseKey(ex, i)]?.completed}
                      onToggle={() => {
                        const k = getExerciseKey(ex, i)
                        lastActionRef.current = { key: k, prev: !!exProgress[k]?.completed }
                        toggleExercise(ex, i)
                      }}
                      hasVideo={!!(ex.video || workout.video_url)}
                      onWatchVideo={() => openExerciseVideo(ex)}
                    />
                  </div>
                )
              }

              return cards
            })()}
          </div>
        </div>

        <ExerciseVideoModal
          open={modalOpen}
          videoUrl={videoUrl}
          videoTitle={videoTitle}
          videoLoading={videoLoading}
          onVideoLoaded={onVideoLoaded}
          onClose={closeVideoModal}
          dialogRef={videoDialogRef}
        />

        <WorkoutActionBar
          status={sessionStatus}
          onStart={handleStartWorkout}
          onComplete={handleCompleteWorkout}
          completing={completing}
          blockedTitle={active?.title}
          onGoToActive={active ? () => navigate(active.path) : undefined}
        />
      </div>
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

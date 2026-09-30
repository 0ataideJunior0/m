import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getMyWorkout, markWorkoutComplete } from '../utils/workouts'
import { Workout as WorkoutType } from '../types'
import { Check, ArrowLeft } from 'lucide-react'
import ExerciseItem from '../components/ExerciseItem'
import ExerciseVideoModal from '../components/ExerciseVideoModal'
import { getExerciseKey } from '../utils/exerciseKeys'
import { clearLocalProgress } from '../utils/exerciseProgress'
import { resetExerciseProgress } from '../utils/exerciseProgressRemote'
import { useExerciseProgress } from '../hooks/useExerciseProgress'
import { useExerciseVideoModal } from '../hooks/useExerciseVideoModal'
import Toast from '../components/ui/Toast'

export default function MyWorkout() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()

  const [workout, setWorkout] = useState<WorkoutType | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    loadWorkout()
  }, [isAuthenticated])

  const loadWorkout = async () => {
    if (!user) return

    try {
      const workoutData = await getMyWorkout(user.id)
      setWorkout(workoutData)
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteWorkout = async () => {
    if (!user || !workout) return

    setCompleting(true)
    try {
      const success = await markWorkoutComplete(user.id, workout.id)
      if (success) {
        const resetOk = await resetExerciseProgress(user.id, workout.id)
        if (!resetOk) {
          console.error('Workout marked complete but exercise checklist reset failed for workout', workout.id)
        }
        clearLocalProgress(user.id, workout.id)
        navigate('/home')
      }
    } catch (error) {
      console.error('Error completing workout:', error)
    } finally {
      setCompleting(false)
    }
  }

  const { exProgress, toggleExercise } = useExerciseProgress(user?.id, workout?.id)
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
          <h2 className="text-2xl font-extrabold tracking-tight text-text-strong mb-2">Nenhum treino pessoal por aqui</h2>
          <p className="text-text-muted mb-4">Sua treinadora ainda não montou um treino personalizado pra você.</p>
          <button onClick={() => navigate('/home')} className="text-accent-text hover:opacity-80">
            Voltar à Home
          </button>
        </div>
      </div>
    )
  }

  // Sem agrupamento de bi-set aqui — é uma lista curada à mão pela admin,
  // então renderiza em lista simples. Só mantém aquecimento primeiro.
  const ordered = [...workout.exercises]
  const warmupItems = ordered.filter((ex) => ex.type === 'warmup')
  const others = ordered.filter((ex) => ex.type !== 'warmup')
  const finalOrder = [...warmupItems, ...others]

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-28">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate('/home')}
            className="mr-4 p-2 rounded-lg hover:bg-surface-hover transition"
          >
            <ArrowLeft className="w-6 h-6 text-text" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-text-strong leading-tight break-words">
              {workout.title}
            </h1>
            <p className="text-text-muted">Treino personalizado</p>
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
            {finalOrder.map((ex, i) => (
              <div key={`exercise-${i}`} className="p-1">
                <ExerciseItem
                  exercise={ex}
                  isCompleted={!!exProgress[getExerciseKey(ex, i)]?.completed}
                  onToggle={() => toggleExercise(ex, i)}
                  hasVideo={!!(ex.video || workout.video_url)}
                  onWatchVideo={() => openExerciseVideo(ex)}
                />
              </div>
            ))}
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

        {/* Complete Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={handleCompleteWorkout}
              disabled={completing}
              className="w-full brand-gradient py-4 px-6 rounded-full shadow-cta hover:shadow-cta-hover hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-lg flex items-center justify-center"
            >
              {completing ? (
                'Marcando...'
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Marcar como Concluído
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

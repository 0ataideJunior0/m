import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getWorkoutByDay, markDayComplete, getUserProgress } from '../utils/workouts'
import { Workout as WorkoutType, UserProgress } from '../types'
import { Check, ArrowLeft, Play } from 'lucide-react'

export default function WorkoutDay() {
  const { day } = useParams<{ day: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  
  const [workout, setWorkout] = useState<WorkoutType | null>(null)
  const [progress, setProgress] = useState<UserProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  const dayNumber = parseInt(day || '1')

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    loadWorkoutAndProgress()
  }, [isAuthenticated, day, navigate])

  const loadWorkoutAndProgress = async () => {
    if (!user) return

    try {
      const [workoutData, userProgress] = await Promise.all([
        getWorkoutByDay(dayNumber),
        getUserProgress(user.id)
      ])
      
      setWorkout(workoutData)
      setProgress(userProgress)
    } catch (error) {
      console.error('Error loading workout:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteWorkout = async () => {
    if (!user || !workout) return

    setCompleting(true)
    try {
      const success = await markDayComplete(user.id, dayNumber)
      if (success) {
        navigate('/home')
      }
    } catch (error) {
      console.error('Error completing workout:', error)
    } finally {
      setCompleting(false)
    }
  }

  const isDayCompleted = progress.some(p => p.day_number === dayNumber && p.completed)

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

  if (!workout) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Treino não encontrado</h2>
          <button
            onClick={() => navigate('/home')}
            className="text-purple-600 hover:text-purple-700"
          >
            Voltar à Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate('/home')}
            className="mr-4 p-2 rounded-lg hover:bg-white/50 transition"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{workout.title}</h1>
            <p className="text-gray-600">Dia {dayNumber} do desafio</p>
          </div>
        </div>

        {/* Video */}
        {workout.video_url && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Play className="w-5 h-5 mr-2" />
              Vídeo do Treino
            </h2>
            <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Play className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Vídeo do treino</p>
                <p className="text-sm text-gray-400 mt-1">{workout.video_url}</p>
              </div>
            </div>
          </div>
        )}

        {/* Exercises */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Exercícios</h2>
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
                  const groupItems: typeof workout.exercises = [ex]
                  let j = i + 1
                  while (j < finalOrder.length && finalOrder[j].group === g) {
                    groupItems.push(finalOrder[j])
                    j++
                  }
                  cards.push(
                    <div key={`group-${g}-${i}`} className="border border-purple-300 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-purple-700 font-medium">Bi-set</span>
                        <span className="text-xs text-purple-600">Grupo {g}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groupItems.map((exercise, idx) => (
                          <div key={`pair-${g}-${idx}`} className="bg-purple-50 rounded-md p-3">
                            <h3 className="font-medium text-gray-900">{exercise.exercise}</h3>
                            <p className="text-gray-600 text-sm">
                              {exercise.sets ? `${exercise.sets} séries` : ''}
                              {exercise.sets && exercise.reps ? ' • ' : ''}
                              {exercise.reps}
                            </p>
                            {exercise.note && (
                              <p className="text-xs text-purple-700 mt-1">{exercise.note}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                  i = j - 1
                  continue
                }

                const isWarmup = ex.type === 'warmup'
                const isDrop = ex.type === 'drop_set'
                cards.push(
                  <div key={`single-${i}`} className={`border rounded-lg p-4 ${isWarmup ? 'border-yellow-300 bg-yellow-50' : isDrop ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{ex.exercise}</h3>
                        <p className="text-gray-600 text-sm">
                          {ex.sets ? `${ex.sets} séries` : ''}
                          {ex.sets && ex.reps ? ' • ' : ''}
                          {ex.reps}
                        </p>
                        {ex.note && (
                          <p className={`${isDrop ? 'text-red-700' : isWarmup ? 'text-yellow-700' : 'text-gray-600'} text-xs mt-1`}>{ex.note}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }

              return cards
            })()}
          </div>
        </div>

        {/* Complete Button */}
        {!isDayCompleted && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
            <div className="max-w-4xl mx-auto">
              <button
                onClick={handleCompleteWorkout}
                disabled={completing}
                className="w-full bg-purple-600 text-white py-4 px-6 rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-lg flex items-center justify-center"
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
        )}

        {isDayCompleted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Check className="w-6 h-6 text-green-600 mr-2" />
              <span className="text-green-800 font-medium">Treino concluído!</span>
            </div>
            <p className="text-green-600 text-sm">
              Parabéns! Você completou o dia {dayNumber} do desafio.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

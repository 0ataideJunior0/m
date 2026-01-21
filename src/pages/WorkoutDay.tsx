import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getWorkoutByDay, markDayComplete, getUserProgress } from '../utils/workouts'
import { Workout as WorkoutType, UserProgress } from '../types'
import { Check, ArrowLeft, Play, X } from 'lucide-react'
import ExerciseItem from '../components/ExerciseItem'
import { getExerciseKey } from '../utils/exerciseKeys'
import { loadLocalProgress, saveLocalProgress, mergeServerLocal } from '../utils/exerciseProgress'
import { fetchExerciseProgress, upsertExerciseProgress } from '../utils/exerciseProgressRemote'

export default function WorkoutDay() {
  const { day } = useParams<{ day: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  
  const [workout, setWorkout] = useState<WorkoutType | null>(null)
  const [progress, setProgress] = useState<UserProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoTitle, setVideoTitle] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [videoLoading, setVideoLoading] = useState(false)
  const videoCache = useState<Map<string, string>>(() => new Map())[0]

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
      // Prefetch first exercise video if available
      if (workoutData?.exercises?.[0]?.video) {
        const url = resolveVideoUrl(workoutData.exercises[0].video)
        videoCache.set(workoutData.exercises[0].exercise, url)
      }
    } catch (error) {
      console.error('Error loading workout:', error)
    } finally {
      setLoading(false)
    }
  }

  const resolveVideoUrl = (raw: string): string => {
    const conn = (navigator as any).connection?.effectiveType as string | undefined
    const isYouTube = /youtube\.com|youtu\.be/.test(raw)
    if (isYouTube) {
      const quality = conn?.includes('2g') ? 'small' : conn?.includes('3g') ? 'medium' : 'hd1080'
      const base = raw.replace('watch?v=', 'embed/').replace('shorts/', 'embed/')
      const sep = base.includes('?') ? '&' : '?'
      return `${base}${sep}rel=0&modestbranding=1&controls=1&vq=${quality}`
    }
    return raw
  }

  const openExerciseVideo = openExerciseVideoFactory(
    workout,
    videoCache,
    setVideoTitle,
    setVideoUrl,
    setModalOpen,
    setVideoLoading,
    resolveVideoUrl,
  )

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
  const { state: exProgress, setState: setExProgress } = useExerciseProgressState(user?.id, dayNumber)
  const pendingRef = useRef<{ key: string; completed: boolean } | null>(null)
  const debounceRef = useRef<any>(null)
  const toggleExercise = useMemo(
    () => toggleExerciseFactory(user?.id, dayNumber, exProgress, setExProgress, pendingRef, debounceRef),
    [user?.id, dayNumber, exProgress]
  )
  const lastActionRef = useRef<{ key: string; prev: boolean } | null>(null)

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
        

        {/* Video geral do treino */}
        {workout.video_url && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Play className="w-5 h-5 mr-2" />
              Vídeo do Treino
            </h2>
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <iframe
                src={resolveVideoUrl(workout.video_url)}
                title="Vídeo do treino"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              />
            </div>
          </div>
        )}

        {/* Progresso exercícios */}
        {workout.exercises?.length ? (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
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
                    <div className="text-xl font-bold text-gray-900">Progresso dos exercícios</div>
                    <div className="text-sm text-gray-600">{done}/{total}</div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                  </div>
                  {/* {lastActionRef.current && (
                    <div className="mt-3">
                      <button
                        onClick={() => {
                          const la = lastActionRef.current
                          if (!la || !user?.id) return
                          const updated = { ...exProgress, [la.key]: { completed: la.prev, ts: Date.now() } }
                          setExProgress(updated)
                          saveLocalProgress(user.id, dayNumber, updated)
                          pendingRef.current = { key: la.key, completed: la.prev }
                        }}
                        className="text-sm px-3 py-1 rounded bg-white border border-gray-300 hover:bg-gray-50"
                      >
                        Desfazer última marcação
                      </button>
                    </div>
                  )} */}
                </>
              )
            })()}
          </div>
        ) : null}

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
                        {groupItems.map((exercise, idx) => {
                          const k = getExerciseKey(exercise, idx)
                          const completed = !!exProgress[k]?.completed
                          return (
                            <div key={`pair-${g}-${idx}`} className="bg-purple-50 rounded-md p-3">
                              <ExerciseItem
                                exercise={exercise}
                                isCompleted={completed}
                                onToggle={() => {
                                  const k = getExerciseKey(exercise, idx)
                                  lastActionRef.current = { key: k, prev: !!exProgress[k]?.completed }
                                  toggleExercise(exercise, idx)
                                }}
                              />
                              {(exercise.video || workout.video_url) ? (
                                <button
                                  onClick={() => openExerciseVideo(exercise)}
                                  className="mt-2 inline-flex items-center text-purple-700 hover:text-purple-800"
                                >
                                  <Play className="w-4 h-4 mr-1" /> Assistir vídeo
                                </button>
                              ) : (
                                <p className="mt-2 text-xs text-gray-500">Vídeo indisponível</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                  i = j - 1
                  continue
                }

                const isWarmup = ex.type === 'warmup'
                const isDrop = ex.type === 'drop_set'
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
                    />
                    {/*  video de exercício indidual {(ex.video || workout.video_url) ? (
                      <button
                        onClick={() => openExerciseVideo(ex)}
                        className="mt-2 inline-flex items-center text-purple-700 hover:text-purple-800"
                      >
                        <Play className="w-4 h-4 mr-1" /> Assistir vídeo
                      </button>
                    ) : (
                      <p className="mt-2 text-xs text-gray-500">Vídeo indisponível</p>
                    )} */}
                  </div>
                )
              }

              return cards
            })()}
          </div>
        </div>

        {/* Modal de vídeo por exercício */}
        {modalOpen && videoUrl && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col">
            <div className="bg-white/95 p-3 flex items-center justify-between">
              <div className="font-semibold text-gray-900">{videoTitle || 'Vídeo do exercício'}</div>
              <button
                onClick={() => { setModalOpen(false); setVideoLoading(false); }}
                className="ui-hover bg-white border border-gray-300 text-gray-900 px-3 py-2 rounded-md flex items-center"
                aria-label="Fechar"
              >
                <X className="w-4 h-4 mr-1" />
                Fechar
              </button>
            </div>
            <div className="flex-1 bg-black relative">
              {videoLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-purple-600 animate-spin"></div>
                </div>
              )}
              {/youtube\.com|youtu\.be|vimeo\.com/.test(videoUrl) ? (
                <iframe
                  src={videoUrl}
                  title="Vídeo do exercício"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  onLoad={() => setVideoLoading(false)}
                />
              ) : (
                <video
                  controls
                  className="w-full h-full"
                  onCanPlay={() => setVideoLoading(false)}
                >
                  <source src={videoUrl} />
                </video>
              )}
            </div>
          </div>
        )}

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

// Estado e sincronização
function useExerciseProgressState(userId: string | undefined, dayNumber: number) {
  const [state, setState] = useState<Record<string, { completed: boolean; ts: number }>>({})
  useEffect(() => {
    if (!userId) return
    const local = loadLocalProgress(userId, dayNumber)
    setState(local)
    ;(async () => {
      const remote = await fetchExerciseProgress(userId, dayNumber)
      setState(s => {
        const merged = mergeServerLocal(remote, s)
        saveLocalProgress(userId, dayNumber, merged)
        return merged
      })
    })()
  }, [userId, dayNumber])
  return { state, setState }
}

function toggleExerciseFactory(
  userId: string | undefined,
  dayNumber: number,
  exProgress: Record<string, { completed: boolean; ts: number }>,
  setExProgress: (v: any) => void,
  pendingRef: React.MutableRefObject<{ key: string; completed: boolean } | null>,
  debounceRef: React.MutableRefObject<any>,
) {
  return (exercise: WorkoutType['exercises'][number], index: number) => {
    if (!userId) return
    const key = getExerciseKey(exercise, index)
    const next = !exProgress[key]?.completed
    const ts = Date.now()
    const updated = { ...exProgress, [key]: { completed: next, ts } }
    setExProgress(updated)
    saveLocalProgress(userId, dayNumber, updated)
    pendingRef.current = { key, completed: next }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const p = pendingRef.current
      if (!p) return
      try {
        await upsertExerciseProgress(userId, dayNumber, p.key, p.completed)
        pendingRef.current = null
      } catch (e) {
        // retry simples
        setTimeout(async () => {
          try {
            await upsertExerciseProgress(userId, dayNumber, p.key, p.completed)
            pendingRef.current = null
          } catch {}
        }, 2000)
      }
    }, 300)
  }
}


function openExerciseVideoFactory(
  workout: WorkoutType | null,
  videoCache: Map<string, string>,
  setVideoTitle: (s: string) => void,
  setVideoUrl: (s: string | null) => void,
  setModalOpen: (b: boolean) => void,
  setVideoLoading: (b: boolean) => void,
  resolveVideoUrl: (raw: string) => string,
) {
  return (exercise: WorkoutType['exercises'][number]) => {
    const title = exercise.exercise
    setVideoTitle(title)
    const raw = (exercise as any).video || (exercise as any).video_url || (exercise as any).videoUrl || (exercise as any).url_video || workout?.video_url || ''
    if (!raw) {
      alert('Vídeo não disponível para este exercício.')
      return
    }
    const cached = videoCache.get(title)
    const url = cached || resolveVideoUrl(raw)
    if (!cached) videoCache.set(title, url)
    setVideoUrl(url)
    setModalOpen(true)
    setVideoLoading(true)
  }
}

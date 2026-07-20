import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getProgramBySlug, getWorkoutsForProgram, getUserProgress } from '../utils/workouts'
import { Program, Workout, UserProgress } from '../types'
import { Check, Circle, ArrowLeft } from 'lucide-react'

const WEEKDAY_NAMES = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']

export default function ProgramDays() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()

  const [program, setProgram] = useState<Program | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [progress, setProgress] = useState<UserProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    load()
  }, [isAuthenticated, slug, navigate])

  const load = async () => {
    if (!user || !slug) return

    try {
      const prog = await getProgramBySlug(slug)
      setProgram(prog)
      if (!prog) return

      const [workoutsData, userProgress] = await Promise.all([
        getWorkoutsForProgram(prog.id),
        getUserProgress(user.id),
      ])
      setWorkouts(workoutsData)
      setProgress(userProgress)
    } catch (error) {
      console.error('Error loading program days:', error)
    } finally {
      setLoading(false)
    }
  }

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

  if (!isAuthenticated || !user) return null

  if (!program) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Treino não encontrado</h2>
          <button onClick={() => navigate('/home')} className="text-purple-600 hover:text-purple-700">
            Voltar à Home
          </button>
        </div>
      </div>
    )
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const weekdayNumber = i + 1
    const workout = workouts.find(w => w.weekday === weekdayNumber) || null
    const completed = !!workout && progress.some(p => p.workout_id === workout.id && p.completed)
    return { weekdayNumber, workout, completed }
  })

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
            <h1 className="text-3xl font-bold text-gray-900">{program.name}</h1>
            <p className="text-gray-600">Escolha o dia da semana</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="space-y-4">
            {days.map((day) => (
              <div key={day.weekdayNumber} className="flex items-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 mr-4">
                  <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                    day.completed ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'
                  }`}>
                    {day.completed ? (
                      <Check className="w-6 h-6 text-white" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className={`font-medium ${day.completed ? 'text-green-700' : day.workout ? 'text-gray-900' : 'text-gray-400'}`}>
                        {WEEKDAY_NAMES[day.weekdayNumber - 1]}
                      </h4>
                      <p className={`text-sm ${day.completed ? 'text-green-600' : day.workout ? 'text-gray-600' : 'text-gray-400'}`}>
                        {day.workout ? day.workout.title : 'Em breve'}
                      </p>
                    </div>
                    {day.workout && (
                      <button
                        onClick={() => navigate(`/program/${slug}/day/${day.weekdayNumber}`)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                          day.completed
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        {day.completed ? 'Ver Treino' : 'Iniciar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

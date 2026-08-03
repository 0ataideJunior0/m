import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getProgramBySlug, getWorkoutsForProgram } from '../utils/workouts'
import { Program, Workout } from '../types'
import { ArrowLeft } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

const WEEKDAY_NAMES = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']

export default function ProgramDays() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()

  const [program, setProgram] = useState<Program | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
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

      const workoutsData = await getWorkoutsForProgram(prog.id)
      setWorkouts(workoutsData)
    } catch (error) {
      console.error('Error loading program days:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-purple-200 dark:bg-purple-900/40 rounded-md mx-auto mb-4"></div>
          <div className="h-4 bg-purple-200 dark:bg-purple-900/40 rounded-md w-32 mx-auto mb-2"></div>
          <div className="h-4 bg-purple-200 dark:bg-purple-900/40 rounded-md w-24 mx-auto"></div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) return null

  if (!program) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text mb-2">Treino não encontrado</h2>
          <button onClick={() => navigate('/home')} className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
            Voltar à Home
          </button>
        </div>
      </div>
    )
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const weekdayNumber = i + 1
    const workout = workouts.find(w => w.weekday === weekdayNumber) || null
    return { weekdayNumber, workout }
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate('/home')}
            className="mr-4 p-2 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition"
          >
            <ArrowLeft className="w-6 h-6 text-text" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-text">{program.name}</h1>
            <p className="text-text-muted">Escolha o dia da semana</p>
          </div>
        </div>

        <div className="space-y-4">
          {days.map((day) => (
            <Card key={day.weekdayNumber}>
              <h4 className="font-bold text-text">
                {WEEKDAY_NAMES[day.weekdayNumber - 1]}
              </h4>
              <p className="text-sm text-text-muted mb-4">
                {day.workout ? day.workout.title : 'Em breve'}
              </p>
              {day.workout && (
                <Button

                  className="w-full rounded-lg"
                  onClick={() => navigate(`/program/${slug}/day/${day.weekdayNumber}`)}
                >
                  Ver Treino
                </Button>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

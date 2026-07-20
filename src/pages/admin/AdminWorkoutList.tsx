import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getProgramBySlug } from '../../utils/workouts'
import { listWorkoutsForProgramAdmin } from '../../utils/adminWorkouts'
import { Program, Workout } from '../../types'

const WEEKDAY_NAMES = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']

export default function AdminWorkoutList() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [program, setProgram] = useState<Program | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [slug])

  const load = async () => {
    if (!slug) return
    try {
      const prog = await getProgramBySlug(slug)
      setProgram(prog)
      if (!prog) return
      const data = await listWorkoutsForProgramAdmin(prog.id)
      setWorkouts(data)
    } catch (error) {
      console.error('Error loading workouts:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-purple-600 animate-spin" />
      </div>
    )
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const weekdayNumber = i + 1
    const workout = workouts.find(w => w.weekday === weekdayNumber) || null
    return { weekdayNumber, workout }
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <button onClick={() => navigate('/admin/programs')} className="mr-4 p-2 rounded-lg hover:bg-white/50 transition">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{program?.name}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {days.map(({ weekdayNumber, workout }) => (
            <Link
              key={weekdayNumber}
              to={`/admin/programs/${slug}/day/${weekdayNumber}`}
              className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition block"
            >
              <div className="text-sm text-gray-500 mb-1">{WEEKDAY_NAMES[weekdayNumber - 1]}</div>
              {workout ? (
                <>
                  <div className="text-lg font-bold text-gray-900 mb-1">{workout.title}</div>
                  <div className="text-sm text-gray-600">{workout.exercises?.length || 0} exercícios</div>
                </>
              ) : (
                <div className="text-lg font-bold text-purple-600 mb-1">+ Criar treino</div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { listWorkoutsAdmin } from '../../utils/adminWorkouts'
import { Workout } from '../../types'

export default function AdminWorkoutList() {
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const data = await listWorkoutsAdmin()
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <button onClick={() => navigate('/admin')} className="mr-4 p-2 rounded-lg hover:bg-white/50 transition">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Treinos</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workouts.map((w) => (
            <Link
              key={w.day_number}
              to={`/admin/workouts/${w.day_number}`}
              className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition block"
            >
              <div className="text-sm text-gray-500 mb-1">Dia {w.day_number}</div>
              <div className="text-lg font-bold text-gray-900 mb-1">{w.title}</div>
              <div className="text-sm text-gray-600">{w.exercises?.length || 0} exercícios</div>
            </Link>
          ))}
        </div>

        {workouts.length === 0 && (
          <p className="text-gray-600 text-center mt-8">Nenhum treino encontrado.</p>
        )}
      </div>
    </div>
  )
}

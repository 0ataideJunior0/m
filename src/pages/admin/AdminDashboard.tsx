import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Dumbbell, Users } from 'lucide-react'

export default function AdminDashboard() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <button onClick={() => navigate('/profile')} className="mr-4 p-2 rounded-lg hover:bg-white/50 transition">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Painel Admin</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/admin/workouts')}
            className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl transition"
          >
            <Dumbbell className="w-8 h-8 text-purple-600 mb-3" />
            <div className="text-lg font-bold text-gray-900 mb-1">Treinos</div>
            <div className="text-sm text-gray-600">Editar título, vídeo e exercícios de cada dia</div>
          </button>

          <button
            onClick={() => navigate('/admin/users')}
            className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl transition"
          >
            <Users className="w-8 h-8 text-purple-600 mb-3" />
            <div className="text-lg font-bold text-gray-900 mb-1">Usuárias</div>
            <div className="text-sm text-gray-600">Ver cadastros e progresso</div>
          </button>
        </div>
      </div>
    </div>
  )
}

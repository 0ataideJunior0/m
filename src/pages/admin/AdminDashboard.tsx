import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Dumbbell, Users, MessageSquareX } from 'lucide-react'

export default function AdminDashboard() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <button onClick={() => navigate('/profile')} className="mr-4 p-2 rounded-lg hover:bg-surface-hover transition">
            <ArrowLeft className="w-6 h-6 text-text" />
          </button>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-strong">Painel Admin</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/admin/programs')}
            className="bg-surface border border-border-card rounded-3xl shadow-lg p-6 text-left hover:shadow-xl transition"
          >
            <Dumbbell className="w-8 h-8 text-accent mb-3" />
            <div className="text-lg font-bold text-text-strong mb-1">Treinos</div>
            <div className="text-sm text-text-muted">Editar título, vídeo e exercícios de cada dia</div>
          </button>

          <button
            onClick={() => navigate('/admin/users')}
            className="bg-surface border border-border-card rounded-3xl shadow-lg p-6 text-left hover:shadow-xl transition"
          >
            <Users className="w-8 h-8 text-accent mb-3" />
            <div className="text-lg font-bold text-text-strong mb-1">Usuárias</div>
            <div className="text-sm text-text-muted">Ver cadastros e progresso</div>
          </button>

          <button
            onClick={() => navigate('/admin/cancellations')}
            className="bg-surface border border-border-card rounded-3xl shadow-lg p-6 text-left hover:shadow-xl transition"
          >
            <MessageSquareX className="w-8 h-8 text-accent mb-3" />
            <div className="text-lg font-bold text-text-strong mb-1">Cancelamentos</div>
            <div className="text-sm text-text-muted">Motivos informados ao cancelar a assinatura</div>
          </button>
        </div>
      </div>
    </div>
  )
}

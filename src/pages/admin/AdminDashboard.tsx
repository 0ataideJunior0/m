import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChefHat, Dumbbell, Users, MessageSquareX, Filter } from 'lucide-react'
import { listNonAdminUsers } from '../../utils/adminUsers'
import { overdueCardUsers } from '../../utils/adminUsersView'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [overdueCount, setOverdueCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    listNonAdminUsers()
      .then((users) => {
        if (!cancelled) setOverdueCount(overdueCardUsers(users).length)
      })
      .catch((error) => console.error('Error checking overdue card billing:', error))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <button onClick={() => navigate('/profile')} className="mr-4 p-2 rounded-lg hover:bg-surface-hover transition">
            <ArrowLeft className="w-6 h-6 text-text" />
          </button>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-strong">Painel Admin</h1>
        </div>

        {overdueCount > 0 && (
          <button
            onClick={() => navigate('/admin/users')}
            className="w-full mb-4 flex items-center gap-2 rounded-2xl border border-red-300 dark:border-red-800 bg-red-500/10 p-4 text-left font-bold text-red-700 dark:text-red-400 hover:bg-red-500/15 transition"
          >
            <AlertTriangle aria-hidden="true" className="w-5 h-5 shrink-0" />
            {overdueCount === 1 ? '1 cobrança do cartão atrasada' : `${overdueCount} cobranças do cartão atrasadas`} — ver quem
          </button>
        )}

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
            onClick={() => navigate('/admin/recipes')}
            className="bg-surface border border-border-card rounded-3xl shadow-lg p-6 text-left hover:shadow-xl transition"
          >
            <ChefHat className="w-8 h-8 text-accent mb-3" />
            <div className="text-lg font-bold text-text-strong mb-1">Receitas</div>
            <div className="text-sm text-text-muted">Cadastrar receitas, fotos e vídeos de preparo</div>
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

          <button
            onClick={() => navigate('/admin/funnel')}
            className="bg-surface border border-border-card rounded-3xl shadow-lg p-6 text-left hover:shadow-xl transition"
          >
            <Filter className="w-8 h-8 text-accent mb-3" />
            <div className="text-lg font-bold text-text-strong mb-1">Funil</div>
            <div className="text-sm text-text-muted">Onde as compradoras param e qual origem vende</div>
          </button>
        </div>
      </div>
    </div>
  )
}

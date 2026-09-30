import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Dumbbell } from 'lucide-react'
import { listNonAdminUsers, AdminUserSummary } from '../../utils/adminUsers'

export default function AdminUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const data = await listNonAdminUsers()
      setUsers(data)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-border-card border-t-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <button onClick={() => navigate('/admin')} className="mr-4 p-2 rounded-lg hover:bg-surface-hover transition">
            <ArrowLeft className="w-6 h-6 text-text" />
          </button>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-strong">Usuárias</h1>
        </div>

        <div className="bg-surface border border-border-card rounded-3xl shadow-lg overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-sm font-medium text-text-muted">Email</th>
                <th className="px-4 py-3 text-sm font-medium text-text-muted">Username</th>
                <th className="px-4 py-3 text-sm font-medium text-text-muted">Cadastro</th>
                <th className="px-4 py-3 text-sm font-medium text-text-muted">Progresso</th>
                <th className="px-4 py-3 text-sm font-medium text-text-muted"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text">{u.email}</td>
                  <td className="px-4 py-3 text-text-muted">{u.username || '—'}</td>
                  <td className="px-4 py-3 text-text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-text-muted">{u.completedDays}/30</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      to={`/admin/users/${u.id}/workout`}
                      className="inline-flex items-center gap-1 text-accent-text hover:opacity-80 text-sm font-medium"
                    >
                      <Dumbbell className="w-4 h-4" /> Treino pessoal
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <p className="text-text-muted text-center mt-8">Nenhuma usuária cadastrada ainda.</p>
        )}
      </div>
    </div>
  )
}

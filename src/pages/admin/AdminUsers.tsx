import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Usuárias</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Username</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Cadastro</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Progresso</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 text-gray-900">{u.email}</td>
                  <td className="px-4 py-3 text-gray-700">{u.username || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-700">{u.completedDays}/30</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <p className="text-gray-600 text-center mt-8">Nenhuma usuária cadastrada ainda.</p>
        )}
      </div>
    </div>
  )
}

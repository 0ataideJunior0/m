import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getMySubscription, cancelSubscription } from '../utils/subscription'
import { Subscription } from '../types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pagamento pendente',
  authorized: 'Ativa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
}

export default function MySubscription() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    if (!user) return
    setLoading(true)
    const data = await getMySubscription(user.id)
    setSubscription(data)
    setLoading(false)
  }

  const handleCancel = async () => {
    if (!window.confirm('Tem certeza que deseja cancelar sua assinatura?')) return
    setCancelling(true)
    const { ok, error } = await cancelSubscription()
    if (!ok) {
      alert(`Erro ao cancelar assinatura. ${error || ''}`)
    } else {
      alert('Assinatura cancelada.')
      await load()
    }
    setCancelling(false)
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
          <button onClick={() => navigate('/profile')} className="mr-4 p-2 rounded-lg hover:bg-white/50 transition">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Minha assinatura</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          {subscription ? (
            <>
              <div className="mb-4">
                <div className="text-sm text-gray-500">Status</div>
                <div className="text-lg font-bold text-gray-900">{STATUS_LABELS[subscription.status] || subscription.status}</div>
              </div>
              {subscription.status === 'authorized' && subscription.next_payment_date && (
                <div className="mb-6">
                  <div className="text-sm text-gray-500">Próxima cobrança</div>
                  <div className="text-gray-900">{new Date(subscription.next_payment_date).toLocaleDateString('pt-BR')}</div>
                </div>
              )}
              {subscription.status !== 'cancelled' && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {cancelling ? 'Cancelando...' : 'Cancelar assinatura'}
                </button>
              )}
            </>
          ) : (
            <p className="text-gray-600">Nenhuma assinatura encontrada.</p>
          )}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getMySubscription, cancelSubscription } from '../utils/subscription'
import { Subscription } from '../types'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import Spinner from '../components/ui/Spinner'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'

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
  const { toast, show: showToast, dismiss: dismissToast } = useToast()

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
      showToast(`Erro ao cancelar assinatura. ${error || ''}`.trim())
    } else {
      showToast('Assinatura cancelada.', 'success')
      await load()
    }
    setCancelling(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageHeader title="Minha assinatura" onBack={() => navigate('/profile')} />

        <Card>
          {subscription ? (
            <>
              <div className="mb-4">
                <div className="text-sm text-gray-500 dark:text-text-muted">Status</div>
                <div className="text-lg font-bold text-gray-900 dark:text-text">
                  {STATUS_LABELS[subscription.status] || subscription.status}
                </div>
              </div>
              {subscription.status === 'authorized' && subscription.next_payment_date && (
                <div className="mb-6">
                  <div className="text-sm text-gray-500 dark:text-text-muted">Próxima cobrança</div>
                  <div className="text-gray-900 dark:text-text">
                    {new Date(subscription.next_payment_date).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              )}
              {subscription.status !== 'cancelled' && (
                <Button variant="danger" onClick={handleCancel} isLoading={cancelling}>
                  Cancelar assinatura
                </Button>
              )}
            </>
          ) : (
            <p className="text-gray-600 dark:text-text-muted">Nenhuma assinatura encontrada.</p>
          )}
        </Card>
      </div>
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

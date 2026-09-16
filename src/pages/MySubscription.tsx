import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getMySubscription, cancelSubscription } from '../utils/subscription'
import { Subscription } from '../types'
import { CancellationReason, CANCELLATION_REASONS_DISPLAY } from '../utils/cancellationReasons'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import Spinner from '../components/ui/Spinner'
import Toast from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import ChoiceGroup from '../components/ui/ChoiceGroup'
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
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [reason, setReason] = useState<CancellationReason | null>(null)
  const [comment, setComment] = useState('')
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

  const confirmCancel = async () => {
    if (!reason) return
    setCancelling(true)
    const { ok, error } = await cancelSubscription(reason, comment)
    if (!ok) {
      showToast(`Erro ao cancelar assinatura. ${error || ''}`.trim())
    } else {
      showToast('Assinatura cancelada.', 'success')
      setShowCancelModal(false)
      setReason(null)
      setComment('')
      await load()
    }
    setCancelling(false)
  }

  const isPix = subscription?.source === 'pix'

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
                  {isPix ? 'Acesso via Pix' : STATUS_LABELS[subscription.status] || subscription.status}
                </div>
              </div>
              {subscription.next_payment_date &&
                (subscription.status === 'authorized' ||
                  (subscription.status === 'cancelled' && new Date(subscription.next_payment_date) > new Date())) && (
                  <div className="mb-6">
                    <div className="text-sm text-gray-500 dark:text-text-muted">
                      {isPix || subscription.status === 'cancelled' ? 'Acesso liberado até' : 'Próxima cobrança'}
                    </div>
                    <div className="text-gray-900 dark:text-text">
                      {new Date(subscription.next_payment_date).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                )}
              {/* Pix não é recorrente: não há o que cancelar, e o botão de
                  cancelamento falharia (não existe preapproval no Mercado Pago).
                  O que faz sentido oferecer é renovar. */}
              {isPix ? (
                <Button onClick={() => navigate('/subscribe?renovar=1')}>Renovar acesso</Button>
              ) : (
                subscription.status !== 'cancelled' && (
                  <Button variant="danger" onClick={() => setShowCancelModal(true)}>
                    Cancelar assinatura
                  </Button>
                )
              )}
            </>
          ) : (
            <p className="text-gray-600 dark:text-text-muted">Nenhuma assinatura encontrada.</p>
          )}
        </Card>
      </div>

      <Modal open={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancelar assinatura">
        <div className="p-4 space-y-5">
          <p className="text-gray-600 dark:text-text-muted text-sm">
            Antes de ir, nos conta o motivo — isso nos ajuda a melhorar o MusaFit.
          </p>

          <ChoiceGroup
            label="Por que está cancelando?"
            name="cancel-reason"
            options={CANCELLATION_REASONS_DISPLAY.map((r) => ({ value: r.value, label: r.label }))}
            value={reason}
            onChange={(value) => setReason(value as CancellationReason)}
          />

          <div>
            <label htmlFor="cancel-comment" className="block text-sm font-medium text-gray-700 dark:text-text-muted mb-1">
              Quer contar mais? (opcional)
            </label>
            <textarea
              id="cancel-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full rounded-xl border border-gray-300 dark:border-border bg-white dark:bg-surface text-gray-900 dark:text-text p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowCancelModal(false)}>
              Voltar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={confirmCancel}
              isLoading={cancelling}
              disabled={!reason}
            >
              Confirmar cancelamento
            </Button>
          </div>
        </div>
      </Modal>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getMySubscription } from '../utils/subscription'
import { getPixExpiryWarning, formatExpiryMessage, PixExpiryWarning } from '../utils/pixExpiry'

/**
 * Aviso de vencimento do acesso pago via Pix, que não renova sozinho.
 *
 * Se cala sozinho quando não há o que avisar (assinatura no cartão, acesso
 * longe do fim, sem assinatura) — por isso quem renderiza não precisa de
 * nenhuma condição em volta.
 */
export default function PixExpiryBanner() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [warning, setWarning] = useState<PixExpiryWarning | null>(null)

  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getMySubscription(userId).then((subscription) => {
      if (!cancelled) setWarning(getPixExpiryWarning(subscription))
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (!warning) return null

  const Icon = warning.urgent ? AlertTriangle : Clock
  const tone = warning.urgent
    ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'
    : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300'

  return (
    <div
      role="status"
      className={`rounded-2xl border p-4 mb-6 flex items-start gap-3 ${tone}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium text-sm">{formatExpiryMessage(warning)}</p>
        <p className="text-sm opacity-90 mt-0.5">O pagamento via Pix não renova sozinho.</p>
      </div>
      <button
        onClick={() => navigate('/subscribe')}
        className="flex-shrink-0 text-sm font-semibold underline underline-offset-2 hover:opacity-80"
      >
        Renovar
      </button>
    </div>
  )
}

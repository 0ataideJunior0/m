import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { createSubscription, getHasActiveSubscription } from '../utils/subscription'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 45000

export default function Subscribe() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAdmin, hasActiveSubscription, setHasActiveSubscription } = useAuthStore()
  const [creating, setCreating] = useState(false)
  const [polling, setPolling] = useState(false)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const [pollKey, setPollKey] = useState(0)
  const { toast, show: showToast, dismiss: dismissToast } = useToast()

  const returnedFromCheckout = searchParams.has('preapproval_id')

  useEffect(() => {
    if (isAdmin || hasActiveSubscription) {
      navigate('/home', { replace: true })
    }
  }, [isAdmin, hasActiveSubscription, navigate])

  useEffect(() => {
    if (!returnedFromCheckout || !user) return

    setPolling(true)
    setPollTimedOut(false)
    const startedAt = Date.now()
    let interval: ReturnType<typeof setInterval>

    const check = async () => {
      const active = await getHasActiveSubscription(user.id)
      if (active) {
        setHasActiveSubscription(true)
        setPolling(false)
        clearInterval(interval)
        navigate('/home', { replace: true })
        return
      }
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setPolling(false)
        setPollTimedOut(true)
        clearInterval(interval)
      }
    }

    check()
    interval = setInterval(check, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [returnedFromCheckout, user, navigate, setHasActiveSubscription, pollKey])

  const handleSubscribe = async () => {
    setCreating(true)
    const { initPoint, error } = await createSubscription()
    if (error || !initPoint) {
      showToast(`Erro ao iniciar assinatura. ${error || ''}`.trim())
      setCreating(false)
      return
    }
    window.location.href = initPoint
  }

  if (returnedFromCheckout && (polling || pollTimedOut)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center px-4">
        <Card className="max-w-md text-center">
          {polling && (
            <>
              <Spinner className="mx-auto mb-4" />
              <p className="text-gray-700 dark:text-text-muted">Estamos confirmando seu pagamento...</p>
            </>
          )}
          {pollTimedOut && (
            <>
              <p className="text-gray-700 dark:text-text-muted mb-4">
                Isso pode levar alguns minutos. Você pode fechar esta página — o acesso será liberado automaticamente assim que confirmarmos o pagamento.
              </p>
              <Button onClick={() => setPollKey((k) => k + 1)}>Verificar novamente</Button>
            </>
          )}
        </Card>
        <Toast toast={toast} onDismiss={dismissToast} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center px-4">
      <Card className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-text mb-2">Assine o Musa Fit30</h1>
        <p className="text-gray-600 dark:text-text-muted mb-6">Acesso completo aos treinos por R$59,90/mês.</p>
        <Button className="w-full" onClick={handleSubscribe} isLoading={creating}>
          Assinar agora
        </Button>
      </Card>
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { createSubscription, getHasActiveSubscription } from '../utils/subscription'

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
      alert(`Erro ao iniciar assinatura. ${error || ''}`)
      setCreating(false)
      return
    }
    window.location.href = initPoint
  }

  if (returnedFromCheckout && (polling || pollTimedOut)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          {polling && (
            <>
              <div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-purple-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-700">Estamos confirmando seu pagamento...</p>
            </>
          )}
          {pollTimedOut && (
            <>
              <p className="text-gray-700 mb-4">
                Isso pode levar alguns minutos. Você pode fechar esta página — o acesso será liberado automaticamente assim que confirmarmos o pagamento.
              </p>
              <button
                onClick={() => setPollKey((k) => k + 1)}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
              >
                Verificar novamente
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Assine o Musa Fit30</h1>
        <p className="text-gray-600 mb-6">Acesso completo aos treinos por R$59,90/mês.</p>
        <button
          onClick={handleSubscribe}
          disabled={creating}
          className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
        >
          {creating ? 'Redirecionando...' : 'Assinar agora'}
        </button>
      </div>
    </div>
  )
}

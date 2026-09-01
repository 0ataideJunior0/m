import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Copy, QrCode, CreditCard } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { createSubscription, getHasActiveSubscription } from '../utils/subscription'
import { createPixPayment, PixCharge } from '../utils/pixPayment'
import { PIX_PLANS_DISPLAY, PixPlanId, formatBRL } from '../utils/pixPlans'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'

const POLL_INTERVAL_MS = 3000
// Retorno do cartão: o webhook costuma chegar em segundos, então 45s já indica
// que algo atrasou. O Pix depende da pessoa abrir o banco e pagar, então a
// espera precisa ser bem mais longa antes de sugerir que ela feche a tela.
const CARD_POLL_TIMEOUT_MS = 45000
const PIX_POLL_TIMEOUT_MS = 10 * 60 * 1000

export default function Subscribe() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAdmin, hasActiveSubscription, needsOnboarding, setHasActiveSubscription } = useAuthStore()
  const [creating, setCreating] = useState(false)
  const [generatingPix, setGeneratingPix] = useState<PixPlanId | null>(null)
  const [pixCharge, setPixCharge] = useState<PixCharge | null>(null)
  const [polling, setPolling] = useState(false)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const [pollKey, setPollKey] = useState(0)
  const { toast, show: showToast, dismiss: dismissToast } = useToast()

  const returnedFromCheckout = searchParams.has('preapproval_id')
  const destination = needsOnboarding ? '/onboarding' : '/home'

  useEffect(() => {
    if (isAdmin || hasActiveSubscription) {
      navigate(destination, { replace: true })
    }
  }, [isAdmin, hasActiveSubscription, destination, navigate])

  // Uma única espera cobre os dois caminhos: voltar do checkout do cartão e
  // aguardar a compensação do Pix. Nos dois, quem libera o acesso é o webhook,
  // então o cliente só pergunta ao banco até a resposta virar positiva.
  const awaitingPayment = returnedFromCheckout || !!pixCharge
  const timeoutMs = pixCharge ? PIX_POLL_TIMEOUT_MS : CARD_POLL_TIMEOUT_MS

  useEffect(() => {
    if (!awaitingPayment || !user) return

    setPolling(true)
    setPollTimedOut(false)
    const startedAt = Date.now()
    let interval: ReturnType<typeof setInterval>

    const check = async () => {
      const active = await getHasActiveSubscription()
      if (active) {
        setHasActiveSubscription(true)
        setPolling(false)
        clearInterval(interval)
        navigate(destination, { replace: true })
        return
      }
      if (Date.now() - startedAt >= timeoutMs) {
        setPolling(false)
        setPollTimedOut(true)
        clearInterval(interval)
      }
    }

    check()
    interval = setInterval(check, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [awaitingPayment, user, navigate, setHasActiveSubscription, destination, timeoutMs, pollKey])

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

  const handlePix = async (plan: PixPlanId) => {
    setGeneratingPix(plan)
    const { charge, error } = await createPixPayment(plan)
    setGeneratingPix(null)
    if (error || !charge) {
      showToast(error || 'Erro ao gerar o Pix')
      return
    }
    setPixCharge(charge)
  }

  const copyPixCode = async () => {
    if (!pixCharge) return
    try {
      await navigator.clipboard.writeText(pixCharge.qr_code)
      showToast('Código copiado. Cole no app do seu banco.', 'success')
    } catch {
      showToast('Não foi possível copiar. Selecione o código manualmente.')
    }
  }

  // Retorno do checkout do cartão, antes do webhook confirmar
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

  // Pix gerado, aguardando compensação
  if (pixCharge) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center px-4 py-8">
        <Card className="max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-text mb-1">
            Pague {formatBRL(pixCharge.amount)} via Pix
          </h1>
          <p className="text-sm text-gray-600 dark:text-text-muted mb-5">
            Acesso liberado por {pixCharge.months} {pixCharge.months === 1 ? 'mês' : 'meses'} assim que o pagamento cair.
          </p>

          {pixCharge.qr_code_base64 && (
            <img
              src={`data:image/png;base64,${pixCharge.qr_code_base64}`}
              alt="QR Code do Pix"
              className="w-56 h-56 mx-auto mb-4 rounded-lg bg-white p-2"
            />
          )}

          <p className="text-xs text-gray-500 dark:text-text-muted mb-2">Ou copie o código:</p>
          <p className="text-xs font-mono break-all bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-text-muted rounded-lg p-3 mb-3">
            {pixCharge.qr_code}
          </p>
          <Button variant="secondary" className="w-full mb-5" onClick={copyPixCode}>
            <Copy className="w-4 h-4 mr-2" /> Copiar código Pix
          </Button>

          <div className="border-t border-gray-200 dark:border-border pt-4">
            {polling && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-text-muted">
                <Spinner size="sm" />
                Aguardando o pagamento...
              </div>
            )}
            {pollTimedOut && (
              <>
                <p className="text-sm text-gray-600 dark:text-text-muted mb-3">
                  Você pode fechar esta página — o acesso é liberado sozinho assim que o pagamento for confirmado.
                </p>
                <Button variant="secondary" onClick={() => setPollKey((k) => k + 1)}>
                  Verificar novamente
                </Button>
              </>
            )}
          </div>
        </Card>
        <Toast toast={toast} onDismiss={dismissToast} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center px-4 py-8">
      <Card className="max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-text mb-1 text-center">Assine o MusaFit</h1>
        <p className="text-gray-600 dark:text-text-muted mb-6 text-center">
          Acesso completo aos treinos e aos planos alimentares.
        </p>

        <div className="rounded-xl border border-gray-200 dark:border-border p-4 mb-5">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-300" />
            <span className="font-semibold text-gray-900 dark:text-text">Cartão de crédito</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-text-muted mb-3">
            {formatBRL(59.9)} por mês, com renovação automática. Cancele quando quiser.
          </p>
          <Button className="w-full" onClick={handleSubscribe} isLoading={creating}>
            Assinar agora
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <span className="h-px flex-1 bg-gray-200 dark:bg-border" />
          <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-text-muted">ou pague via Pix</span>
          <span className="h-px flex-1 bg-gray-200 dark:bg-border" />
        </div>

        <div className="space-y-3">
          {PIX_PLANS_DISPLAY.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-gray-200 dark:border-border p-4">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-purple-600 dark:text-purple-300" />
                  <span className="font-semibold text-gray-900 dark:text-text">{plan.title}</span>
                </div>
                {plan.badge && (
                  <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400">
                    {plan.badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-text-muted mb-3">{plan.subtitle}</p>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => handlePix(plan.id)}
                isLoading={generatingPix === plan.id}
              >
                Pagar {formatBRL(plan.amount)}
              </Button>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500 dark:text-text-muted mt-5 text-center">
          No Pix não há renovação automática — avisamos no app antes de o acesso acabar.
        </p>
      </Card>
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

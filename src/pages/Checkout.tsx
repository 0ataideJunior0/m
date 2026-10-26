import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Copy, Mail } from 'lucide-react'
import { startCheckout, type CheckoutMethod } from '../utils/checkout'
import { suggestEmail } from '../utils/emailSuggest'
import { getPixPlansDisplay, formatBRL, type PixPlanDisplay, type PixPlanId } from '../utils/pixPlans'
import { paidLoginPath, rememberCheckoutEmail } from '../utils/checkoutEmail'
import { useCheckoutStatus } from '../hooks/useCheckoutStatus'
import { useToast } from '../hooks/useToast'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ChoiceGroup from '../components/ui/ChoiceGroup'
import FormField from '../components/ui/FormField'
import Input from '../components/ui/Input'
import PageHeader from '../components/ui/PageHeader'
import Spinner from '../components/ui/Spinner'
import Toast from '../components/ui/Toast'
import { cn } from '../lib/utils'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const METHOD_OPTIONS: { value: CheckoutMethod; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'card', label: 'Cartão (até 12x)' },
]

const ALL_PLANS = getPixPlansDisplay()
// O plano de verificação (R$ 0,01) nunca aparece na lista de opções. Só chega
// por link (?plano=teste) e o servidor recusa quem não está na lista de teste.
const PLANS = ALL_PLANS.filter((plan) => !plan.adminOnly)

interface PixPurchase {
  intentId: string
  email: string
  qrCode: string
  qrCodeBase64?: string
  amount: number
  months: number
}

function PlanSummary({ plan }: { plan: PixPlanDisplay }) {
  return (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="font-semibold text-text-strong">{plan.title}</span>
        <span className="font-extrabold text-text-strong">{formatBRL(plan.amount)}</span>
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-muted">
        <span>{plan.subtitle}</span>
        {plan.badge && (
          <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-success/10 text-success">{plan.badge}</span>
        )}
      </span>
    </>
  )
}

export default function Checkout() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast, show: showToast, dismiss: dismissToast } = useToast()

  const [planId, setPlanId] = useState<PixPlanId | null>(() => {
    const requested = searchParams.get('plano')
    return ALL_PLANS.some((plan) => plan.id === requested) ? (requested as PixPlanId) : null
  })
  const [choosingPlan, setChoosingPlan] = useState(false)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [method, setMethod] = useState<CheckoutMethod>('pix')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pix, setPix] = useState<PixPurchase | null>(null)

  const status = useCheckoutStatus(pix?.intentId ?? null)

  useEffect(() => {
    if (pix && status?.status === 'paid') navigate(paidLoginPath(pix.email), { replace: true })
  }, [pix, status, navigate])

  const plan = ALL_PLANS.find((p) => p.id === planId) ?? null
  const trimmedEmail = email.trim()
  const emailValid = EMAIL_PATTERN.test(trimmedEmail)
  const suggestion = emailValid ? suggestEmail(trimmedEmail) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plan || loading) return
    if (!emailValid) {
      setEmailError('Digite um e-mail válido.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const { data, error: startError } = await startCheckout({ email: trimmedEmail, plan: plan.id, method })
      if (startError || !data) {
        setError(startError || 'Algo deu errado. Tente de novo.')
        return
      }
      if (data.method === 'pix') {
        setPix({
          intentId: data.intentId,
          email: trimmedEmail,
          qrCode: data.pix.qr_code,
          qrCodeBase64: data.pix.qr_code_base64,
          amount: plan.amount,
          months: plan.months,
        })
        return
      }
      // Mesma aba: o navegador do Instagram bloqueia popup e nova aba.
      rememberCheckoutEmail(data.intentId, trimmedEmail)
      window.location.href = data.init_point
    } finally {
      setLoading(false)
    }
  }

  const copyPixCode = async () => {
    if (!pix) return
    try {
      await navigator.clipboard.writeText(pix.qrCode)
      showToast('Código copiado. Cole no app do seu banco.', 'success')
    } catch {
      showToast('Não foi possível copiar. Selecione o código manualmente.')
    }
  }

  if (pix) {
    const rejected = status?.status === 'rejected'
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
        <Card className="max-w-md w-full text-center">
          {rejected ? (
            <>
              <h1 className="text-xl font-extrabold tracking-tight text-text-strong mb-2">
                O pagamento não foi aprovado.
              </h1>
              <p className="text-sm text-text-muted mb-5">Volte e gere um novo Pix para tentar de novo.</p>
              <Button className="w-full" onClick={() => setPix(null)}>
                Tentar de novo
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-extrabold tracking-tight text-text-strong mb-1">
                Pague {formatBRL(pix.amount)} via Pix
              </h1>
              <p className="text-sm text-text-muted mb-5">
                Acesso por {pix.months} {pix.months === 1 ? 'mês' : 'meses'} assim que o pagamento cair.
              </p>

              {pix.qrCodeBase64 && (
                <img
                  src={`data:image/png;base64,${pix.qrCodeBase64}`}
                  alt="QR Code do Pix"
                  className="w-56 h-56 mx-auto mb-4 rounded-lg bg-white p-2"
                />
              )}

              <p className="text-xs text-text-muted mb-2">Ou copie o código:</p>
              <p className="text-xs font-mono break-all bg-surface-sunken text-text-muted rounded-lg p-3 mb-3">
                {pix.qrCode}
              </p>
              <Button variant="secondary" className="w-full mb-5" onClick={copyPixCode}>
                <Copy className="w-4 h-4 mr-2" /> Copiar código Pix
              </Button>

              <div className="border-t border-border pt-4 flex items-center justify-center gap-2 text-sm text-text-muted">
                <Spinner size="sm" />
                Aguardando o pagamento...
              </div>
            </>
          )}
        </Card>
        <Toast toast={toast} onDismiss={dismissToast} />
      </div>
    )
  }

  const showPlanList = !plan || choosingPlan

  return (
    <div className="min-h-screen bg-bg px-4 py-6">
      <div className="max-w-md mx-auto">
        <PageHeader title="Finalizar compra" />

        <Card>
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {showPlanList ? (
              <div>
                <span className="block text-sm font-medium text-text-muted mb-2">Escolha seu plano</span>
                <div role="radiogroup" aria-label="Escolha seu plano" className="space-y-3">
                  {PLANS.map((option) => {
                    const selected = option.id === planId
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setPlanId(option.id)
                          setChoosingPlan(false)
                        }}
                        className={cn(
                          'block w-full text-left rounded-2xl border p-4 transition active:scale-[0.99]',
                          'focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2',
                          selected ? 'border-accent bg-surface-hover' : 'border-border bg-surface hover:bg-surface-hover',
                        )}
                      >
                        <PlanSummary plan={option} />
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-accent p-4">
                <PlanSummary plan={plan} />
                <button
                  type="button"
                  onClick={() => setChoosingPlan(true)}
                  className="mt-3 text-sm text-accent-text hover:opacity-80 underline underline-offset-2"
                >
                  Trocar plano
                </button>
              </div>
            )}

            <FormField label="E-mail" htmlFor="checkout-email" error={emailError}>
              <Input
                id="checkout-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="seu@email.com"
                icon={<Mail className="w-5 h-5" />}
                value={email}
                error={!!emailError}
                aria-describedby={emailError ? 'checkout-email-error' : undefined}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEmailError('')
                }}
              />
            </FormField>

            {emailValid && (
              <div className="-mt-2 space-y-2">
                <p className="text-sm text-text-muted">{`O acesso vai para ${trimmedEmail}. Confira se está certo.`}</p>
                {suggestion && (
                  <button
                    type="button"
                    onClick={() => setEmail(suggestion)}
                    className="text-sm font-medium text-accent-text hover:opacity-80 underline underline-offset-2"
                  >
                    {`Você quis dizer ${suggestion}?`}
                  </button>
                )}
              </div>
            )}

            <ChoiceGroup
              label="Como quer pagar?"
              name="checkout-method"
              options={METHOD_OPTIONS}
              value={method}
              onChange={(value) => setMethod(value as CheckoutMethod)}
            />

            {error && (
              <div
                role="alert"
                className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm"
              >
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={!plan} isLoading={loading}>
              Ir para o pagamento
            </Button>
          </form>
        </Card>
      </div>
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

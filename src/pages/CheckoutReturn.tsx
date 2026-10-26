import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCheckoutStatus } from '../hooks/useCheckoutStatus'
import { paidLoginPath, recallCheckoutEmail } from '../utils/checkoutEmail'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

/** Volta do checkout do cartão: confirma o pagamento e leva ao login quando aprovado. */
export default function CheckoutReturn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const intentId = searchParams.get('intent')
  const status = useCheckoutStatus(intentId)

  useEffect(() => {
    if (intentId && status?.status === 'paid') {
      navigate(paidLoginPath(recallCheckoutEmail(intentId)), { replace: true })
    }
  }, [intentId, status, navigate])

  const backToCheckout = (label: string) => (
    <Button className="w-full" onClick={() => navigate('/comprar')}>
      {label}
    </Button>
  )

  let content
  if (!intentId) {
    content = (
      <>
        <p className="text-text-strong font-semibold mb-4">Não encontramos o seu pedido.</p>
        {backToCheckout('Voltar para a compra')}
      </>
    )
  } else if (status?.status === 'rejected') {
    content = (
      <>
        <p className="text-text-strong font-semibold mb-4">O pagamento não foi aprovado.</p>
        {backToCheckout('Tentar de novo')}
      </>
    )
  } else if (status?.status === 'pending') {
    content = (
      <>
        <Spinner className="mx-auto mb-4" />
        <p className="text-text-muted">Pagamento em análise. Avisaremos por e-mail assim que for aprovado.</p>
      </>
    )
  } else {
    content = (
      <>
        <Spinner className="mx-auto mb-4" />
        <p className="text-text-muted">Estamos confirmando seu pagamento...</p>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center" aria-live="polite">
        {content}
      </Card>
    </div>
  )
}

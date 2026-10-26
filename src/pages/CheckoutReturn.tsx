import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCheckoutStatus } from '../hooks/useCheckoutStatus'
import { paidLoginPath, recallCheckoutEmail } from '../utils/checkoutEmail'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

// Quem sai do Mercado Pago sem pagar volta com o intent 'pending' e nenhum
// pagamento registrado: depois deste tempo sem novidade, oferece voltar à compra.
const CONFIRMING_TIMEOUT_MS = 60_000

/** Volta do checkout do cartão: confirma o pagamento e leva ao login quando aprovado. */
export default function CheckoutReturn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const intentId = searchParams.get('intent')
  const status = useCheckoutStatus(intentId)
  const [waitedTooLong, setWaitedTooLong] = useState(false)

  useEffect(() => {
    setWaitedTooLong(false)
    if (!intentId) return
    const timer = setTimeout(() => setWaitedTooLong(true), CONFIRMING_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [intentId])

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
  } else if (status?.status === 'pending' && status.lastPaymentStatus) {
    // O MP registrou um pagamento que ainda não foi aprovado (in_process/pending).
    content = (
      <>
        <Spinner className="mx-auto mb-4" />
        <p className="text-text-muted mb-4">Pagamento em análise. Assim que for aprovado, seu acesso é liberado.</p>
        {backToCheckout('Voltar para a compra')}
      </>
    )
  } else {
    content = (
      <>
        <Spinner className="mx-auto mb-4" />
        <p className={`text-text-muted${waitedTooLong ? ' mb-4' : ''}`}>Estamos confirmando seu pagamento...</p>
        {waitedTooLong && backToCheckout('Voltar para a compra')}
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

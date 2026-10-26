import { useEffect, useState } from 'react'
import { getCheckoutStatus, type CheckoutStatus } from '../utils/checkout'

export const CHECKOUT_POLL_INTERVAL_MS = 4000

/**
 * Pergunta ao servidor a cada 4s como está a compra, até chegar um status
 * final (paid/rejected) ou a tela sair. Uma consulta só começa depois que a
 * anterior terminou, então uma resposta lenta não empilha chamadas. Falha de
 * rede não derruba a espera: tenta de novo no próximo ciclo.
 */
export function useCheckoutStatus(intentId: string | null): CheckoutStatus | null {
  const [status, setStatus] = useState<CheckoutStatus | null>(null)

  useEffect(() => {
    setStatus(null)
    if (!intentId) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const check = async () => {
      const { data } = await getCheckoutStatus(intentId)
      if (cancelled) return
      if (data) {
        setStatus(data)
        if (data.status !== 'pending') return
      }
      timer = setTimeout(check, CHECKOUT_POLL_INTERVAL_MS)
    }

    check()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [intentId])

  return status
}

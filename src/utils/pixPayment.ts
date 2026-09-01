import { supabase } from '../lib/supabase'
import type { PixPlanId } from './pixPlans'

export interface PixCharge {
  payment_id: string
  qr_code: string
  qr_code_base64?: string
  ticket_url?: string
  amount: number
  months: number
}

export const createPixPayment = async (
  plan: PixPlanId
): Promise<{ charge: PixCharge | null; error: string | null }> => {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { charge: null, error: 'Sessão inválida' }

  try {
    const response = await fetch('/api/create-pix-payment', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const body = await response.json()
    if (!response.ok) return { charge: null, error: body?.error || 'Erro ao gerar o Pix' }
    return { charge: body as PixCharge, error: null }
  } catch {
    return { charge: null, error: 'Erro ao gerar o Pix' }
  }
}

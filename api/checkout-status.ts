import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseAdmin } from './_lib/supabaseAdmin.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Consulta pública do andamento de uma compra (a tela de retorno faz polling).
 * O id da intenção é um uuid não adivinhável; mesmo assim só devolve o status,
 * nunca o e-mail.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const intent = req.query?.intent
  if (typeof intent !== 'string' || !UUID_PATTERN.test(intent)) {
    res.status(400).json({ error: 'Invalid intent' })
    return
  }

  const { data, error } = await createSupabaseAdmin()
    .from('purchase_intents')
    .select('status, last_payment_status')
    .eq('id', intent)
    .maybeSingle()

  if (error) {
    console.error('checkout-status error:', error.message)
    res.status(500).json({ error: 'Failed to load status' })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  res.status(200).json({ status: data.status, lastPaymentStatus: data.last_payment_status ?? null })
}

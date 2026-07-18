import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PreApproval } from 'mercadopago'
import { createMercadoPagoConfig } from './_lib/mercadopagoConfig'
import { createSupabaseAdmin } from './_lib/supabaseAdmin'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = (req.headers.authorization as string) || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' })
    return
  }

  const supabaseAdmin = createSupabaseAdmin()
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData.user) {
    res.status(401).json({ error: 'Invalid session' })
    return
  }

  const { data: subscription, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .select('preapproval_id, status')
    .eq('user_id', userData.user.id)
    .single()

  if (subError || !subscription) {
    res.status(404).json({ error: 'No subscription found' })
    return
  }

  if (subscription.status === 'cancelled') {
    res.status(200).json({ ok: true, status: 'cancelled' })
    return
  }

  const preApproval = new PreApproval(createMercadoPagoConfig())
  try {
    await preApproval.update({ id: subscription.preapproval_id, body: { status: 'cancelled' } })
  } catch (error) {
    console.error('cancel-subscription MP error:', error)
    res.status(500).json({ error: 'Failed to cancel subscription' })
    return
  }

  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userData.user.id)

  res.status(200).json({ ok: true, status: 'cancelled' })
}

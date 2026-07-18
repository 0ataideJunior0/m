import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PreApproval } from 'mercadopago'
import { createMercadoPagoConfig } from './_lib/mercadopagoConfig.js'
import { createSupabaseAdmin } from './_lib/supabaseAdmin.js'

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

  const user = userData.user
  const planId = process.env.MERCADOPAGO_PREAPPROVAL_PLAN_ID || ''
  const host = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string) || ''
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const backUrl = `${protocol}://${host}/subscribe`

  const preApproval = new PreApproval(createMercadoPagoConfig())
  try {
    const result = await preApproval.create({
      body: {
        preapproval_plan_id: planId,
        payer_email: user.email || '',
        external_reference: user.id,
        back_url: backUrl,
      },
    })
    res.status(200).json({ init_point: result.init_point })
  } catch (error) {
    console.error('create-subscription error:', error)
    res.status(500).json({ error: 'Failed to create subscription' })
  }
}

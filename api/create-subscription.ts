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
  const host = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string) || ''
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const backUrl = `${protocol}://${host}/subscribe`

  const preApproval = new PreApproval(createMercadoPagoConfig())
  try {
    const result = await preApproval.create({
      body: {
        reason: 'Musa Fit30 - Assinatura mensal',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: 59.90,
          currency_id: 'BRL',
        },
        payer_email: user.email || '',
        external_reference: user.id,
        back_url: backUrl,
        status: 'pending',
      },
    })
    res.status(200).json({ init_point: result.init_point })
  } catch (error) {
    console.error('create-subscription error:', JSON.stringify(error, Object.getOwnPropertyNames(error as object)))
    res.status(500).json({ error: 'Failed to create subscription' })
  }
}

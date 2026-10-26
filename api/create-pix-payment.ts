import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { buildPrepaidExternalReference } from './_lib/pixPeriod.js'
import { createPixCharge, ChargeResponseError, requestOrigin } from './_lib/charges.js'
import { checkLoggedPurchase } from './_lib/loggedPurchase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const check = await checkLoggedPurchase(
    req,
    createSupabaseAdmin(),
    'Você já tem uma assinatura ativa no cartão. Cancele antes de pagar via Pix.',
  )
  if ('status' in check) {
    res.status(check.status).json({ error: check.error })
    return
  }
  const { user, plan } = check

  try {
    const pix = await createPixCharge({
      amount: plan.amount,
      months: plan.months,
      email: user.email || '',
      externalReference: buildPrepaidExternalReference(user.id, plan.months, 'pix'),
      notificationUrl: `${requestOrigin(req.headers)}/api/mercadopago-webhook`,
    })

    res.status(200).json({ ...pix, amount: plan.amount, months: plan.months })
  } catch (error) {
    if (error instanceof ChargeResponseError) {
      res.status(502).json({ error: 'Não foi possível gerar o código Pix' })
      return
    }
    console.error(
      'create-pix-payment error:',
      JSON.stringify(error, Object.getOwnPropertyNames(error as object))
    )
    res.status(500).json({ error: 'Failed to create Pix payment' })
  }
}

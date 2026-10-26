import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { buildPrepaidExternalReference } from './_lib/pixPeriod.js'
import { createCardCheckout, ChargeResponseError, requestOrigin } from './_lib/charges.js'
import { checkLoggedPurchase } from './_lib/loggedPurchase.js'

const CHARGE_ERROR = 'Não foi possível iniciar o pagamento. Tente de novo.'

/** Cartão avulso (pagamento único, parcelado) para quem já está logada. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' })
    return
  }

  const check = await checkLoggedPurchase(
    req,
    createSupabaseAdmin(),
    'Você já tem uma assinatura ativa no cartão. Cancele antes de comprar um novo período.',
  )
  if ('status' in check) {
    res.status(check.status).json({ error: check.error })
    return
  }
  const { user, plan } = check
  const origin = requestOrigin(req.headers)

  try {
    const { init_point } = await createCardCheckout({
      amount: plan.amount,
      months: plan.months,
      email: user.email || '',
      externalReference: buildPrepaidExternalReference(user.id, plan.months, 'card'),
      notificationUrl: `${origin}/api/mercadopago-webhook`,
      backUrl: `${origin}/subscribe`,
    })
    res.status(200).json({ init_point })
  } catch (error) {
    if (error instanceof ChargeResponseError) {
      res.status(502).json({ error: CHARGE_ERROR })
      return
    }
    console.error(
      'create-card-payment error:',
      JSON.stringify(error, Object.getOwnPropertyNames(error as object))
    )
    res.status(500).json({ error: CHARGE_ERROR })
  }
}

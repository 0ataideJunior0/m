import { readFileSync } from 'node:fs'
import { MercadoPagoConfig, PreApprovalPlan } from 'mercadopago'

const envText = readFileSync('./.env.local', 'utf8')
const env = Object.fromEntries(
  envText.split('\n').filter(Boolean).map((line) => {
    const idx = line.indexOf('=')
    return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
  })
)

const accessToken = env.MERCADOPAGO_ACCESS_TOKEN
if (!accessToken) {
  console.error('MERCADOPAGO_ACCESS_TOKEN não encontrado em .env.local')
  process.exit(1)
}

const config = new MercadoPagoConfig({ accessToken })
const plan = new PreApprovalPlan(config)

const result = await plan.create({
  body: {
    reason: 'Musa Fit30 - Assinatura mensal',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: 59.90,
      currency_id: 'BRL',
    },
    back_url: 'https://traemusa20lfmz.vercel.app/subscribe',
  },
})

console.log('Plano criado com sucesso.')
console.log('ID do plano (MERCADOPAGO_PREAPPROVAL_PLAN_ID):', result.id)
console.log('Status:', result.status)

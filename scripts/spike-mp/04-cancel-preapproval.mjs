// Auxiliar da Tarefa M1.3 — não é um dos 3 scripts originais do plano, mas
// necessário para gerar um evento real (subscription_preapproval) depois
// que o webhook foi registrado. Só assim uma notificação de verdade chega
// para o 03-verify-signature.mjs capturar.
//
// Uso:
//   node --env-file=.env.local scripts/spike-mp/04-cancel-preapproval.mjs <preapproval_id>

import { MercadoPagoConfig, PreApproval } from 'mercadopago'

const preapprovalId = process.argv[2]
if (!preapprovalId) {
  console.error('Uso: node --env-file=.env.local 04-cancel-preapproval.mjs <preapproval_id>')
  process.exit(1)
}

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
if (!accessToken) {
  console.error('MERCADOPAGO_ACCESS_TOKEN não encontrado. Rode com --env-file=.env.local.')
  process.exit(1)
}

const config = new MercadoPagoConfig({ accessToken })
const preApproval = new PreApproval(config)

try {
  const result = await preApproval.update({ id: preapprovalId, body: { status: 'cancelled' } })
  console.log('--- Cancelada ---')
  console.log('status:', result.status)
  console.log()
  console.log('Isso deveria disparar uma notificação subscription_preapproval para o')
  console.log('webhook de sandbox registrado. Conferir com: vercel logs <deployment-url>')
} catch (err) {
  console.error('--- Falha ---')
  console.error(JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
  process.exitCode = 1
}

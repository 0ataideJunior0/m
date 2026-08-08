// Tarefa M1.2 do docs/PLANO-MERCADOPAGO.md.
//
// Consulta uma preapproval por id e imprime o objeto inteiro. Rodar DEPOIS
// de autorizar manualmente pela init_point que o 01-create-preapproval.mjs
// imprimiu (com o usuário de teste comprador, ou cartão real de verdade).
//
// O que registrar em docs/spike-mp-log.md: o formato EXATO de status,
// next_payment_date, external_reference e id. A migration da Fase M4 (a
// tabela subscriptions e has_active_subscription()) depende do que a API
// realmente devolve, não do que a documentação promete.
//
// Uso:
//   node --env-file=.env.local scripts/spike-mp/02-get-preapproval.mjs <preapproval_id>

import { MercadoPagoConfig, PreApproval } from 'mercadopago'

const preapprovalId = process.argv[2]
if (!preapprovalId) {
  console.error('Uso: node --env-file=.env.local 02-get-preapproval.mjs <preapproval_id>')
  console.error('O id vem do campo "id" impresso por 01-create-preapproval.mjs.')
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
  const result = await preApproval.get({ id: preapprovalId })

  console.log('--- Campos que a M4.1 precisa (formato real, não o da doc) ---')
  console.log('status:', JSON.stringify(result.status))
  console.log('next_payment_date:', JSON.stringify(result.next_payment_date))
  console.log('external_reference:', JSON.stringify(result.external_reference))
  console.log('id:', JSON.stringify(result.id))
  console.log()
  console.log('--- Objeto completo ---')
  console.log(JSON.stringify(result, null, 2))

  if (result.status !== 'authorized') {
    console.warn()
    console.warn(`⚠️  status ainda é "${result.status}", não "authorized".`)
    console.warn('Abra a init_point e autorize manualmente antes de considerar a M1.2 fechada.')
  }
} catch (err) {
  console.error('--- Falha ---')
  console.error(JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
  // process.exitCode em vez de process.exit() — ver comentário equivalente
  // em 01-create-preapproval.mjs (handle HTTP do SDK fechando assíncrono).
  process.exitCode = 1
}

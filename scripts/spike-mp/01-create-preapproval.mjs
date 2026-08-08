// Tarefa M1.1 do docs/PLANO-MERCADOPAGO.md.
//
// Cria uma assinatura (preapproval SEM plano associado — é o formato que o
// commit 6f65691 corrigiu para o checkout hospedado) e imprime a init_point.
// Abrir essa URL no navegador deve mostrar a tela de autorização do MP com
// R$ 59,90/mês.
//
// Uso:
//   npm install --no-save mercadopago@3.2.0   (uma vez, ver README.md)
//   node --env-file=.env.local scripts/spike-mp/01-create-preapproval.mjs <payer_email>
//
// IMPORTANTE: <payer_email> precisa ser DIFERENTE do e-mail da conta MP
// vendedora (hipótese principal do blocker A — ver §4 do plano). Use o
// usuário de teste comprador, não seu e-mail real.

import { MercadoPagoConfig, PreApproval } from 'mercadopago'

const payerEmail = process.argv[2]
if (!payerEmail) {
  console.error('Uso: node --env-file=.env.local 01-create-preapproval.mjs <payer_email>')
  process.exit(1)
}

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
if (!accessToken) {
  console.error('MERCADOPAGO_ACCESS_TOKEN não encontrado. Rode com --env-file=.env.local.')
  process.exit(1)
}

// back_url precisa ser HTTPS e domínio real, não localhost — item 3 da
// ordem de investigação do M1.1. Ajustar para o domínio real do deploy
// (Vercel) antes de rodar; um placeholder óbvio evita passar batido.
const BACK_URL = 'https://SUBSTITUA-PELO-DOMINIO-VERCEL.vercel.app/subscribe'

if (BACK_URL.includes('SUBSTITUA')) {
  console.warn('⚠️  BACK_URL ainda é o placeholder. Edite este arquivo antes de rodar de verdade.')
}

const config = new MercadoPagoConfig({ accessToken })
const preApproval = new PreApproval(config)

const body = {
  reason: 'Musa Fit - Assinatura mensal',
  auto_recurring: {
    frequency: 1,
    frequency_type: 'months',
    transaction_amount: 59.9,
    currency_id: 'BRL',
  },
  payer_email: payerEmail,
  external_reference: 'spike-teste-001',
  back_url: BACK_URL,
  status: 'pending',
}

console.log('--- Request ---')
console.log(JSON.stringify(body, null, 2))
console.log()

try {
  const result = await preApproval.create({ body })
  console.log('--- Sucesso ---')
  console.log('id:', result.id)
  console.log('init_point:', result.init_point)
  console.log('status:', result.status)
  console.log()
  console.log('Abra a init_point no navegador para autorizar (Tarefa M1.2).')
  console.log()
  console.log(JSON.stringify(result, null, 2))
} catch (err) {
  console.error('--- Falha ---')
  // O SDK esconde cause/errors em propriedades não-enumeráveis — sem o
  // segundo argumento aqui, JSON.stringify(err) sozinho devolve "{}".
  console.error(JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
  console.error()
  console.error('Ordem de investigação (não pular etapas, registrar em docs/spike-mp-log.md):')
  console.error('1. payer_email diferente do e-mail da conta vendedora — testar isto primeiro')
  console.error('2. token de teste + usuário de teste do painel (nunca e-mail real com token TEST-)')
  console.error('3. back_url com HTTPS e domínio real (não localhost)')
  console.error('4. mesma chamada via curl direto na API REST, sem o SDK')
  console.error('5. só então suspeitar de conta sem Assinaturas habilitado')
  // process.exitCode, não process.exit() — o SDK deixa um handle HTTP
  // keep-alive fechando de forma assíncrona; exit() força e o Node quebra
  // no Windows com "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)".
  // exitCode deixa o event loop drenar e sai com o código certo mesmo assim.
  process.exitCode = 1
}

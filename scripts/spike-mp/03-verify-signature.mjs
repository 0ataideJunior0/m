// Tarefa M1.3 do docs/PLANO-MERCADOPAGO.md — o blocker B.
//
// IMPORTANTE (Registro de revisão 2, 2026-08-08): a hipótese antiga — "dataId
// vem vazio porque só lê da query" — foi DERRUBADA. O SDK, na versão exata
// que julho usava (3.2.0), já omite o segmento `id:` do manifesto quando
// dataId está ausente, exatamente como a documentação oficial manda.
// dataId='' NÃO é o bug. Não "conserte" isso aqui — este script existe para
// descobrir a causa real, não para confirmar uma correção já pronta.
//
// Hipóteses a testar, nesta ordem (ver §5 M1.3 do plano para o raciocínio):
//   1. segredo do ambiente errado (teste vs produção são diferentes)
//   2. x-signature mal parseado por alguma lógica manual (o SDK já parseia certo)
//   3. ids alfanuméricos em maiúsculas (o SDK já normaliza para minúsculas)
//   4. simulador do painel assina diferente de notificação real — SEMPRE
//      validar com notificação real, nunca só com o simulador
//   5. algo específico de como o Vercel entrega o body à function
//
// Uso: edite os três valores abaixo com o que uma notificação REAL trouxe
// (capturados dos logs do Vercel, não do simulador do painel), depois:
//   node --env-file=.env.local scripts/spike-mp/03-verify-signature.mjs
//
// Não recebe argumentos de linha de comando de propósito — x-signature tem
// vírgulas e "=", que o shell escapa de forma inconsistente entre
// PowerShell/bash/cmd. Colar direto no arquivo evita esse ruído.

import { WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago'

// ─── EDITE AQUI com os valores de uma notificação real ─────────────────────
const X_SIGNATURE = 'ts=REPLACE,v1=REPLACE'
const X_REQUEST_ID = 'REPLACE'
const DATA_ID = 'REPLACE' // string vazia '' é válida — significa "ausente na notificação"
// ─────────────────────────────────────────────────────────────────────────

const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
if (!secret) {
  console.error('MERCADOPAGO_WEBHOOK_SECRET não encontrado. Rode com --env-file=.env.local.')
  console.error('Esse segredo só existe depois de registrar o webhook (M0/M2.3 via save_webhook).')
  process.exit(1)
}

if ([X_SIGNATURE, X_REQUEST_ID, DATA_ID].some((v) => v.includes('REPLACE'))) {
  console.error('Edite X_SIGNATURE, X_REQUEST_ID e DATA_ID no topo deste arquivo antes de rodar.')
  console.error('Os valores vêm de uma notificação REAL (logs do Vercel), não do simulador.')
  process.exit(1)
}

// Reconstrução do manifesto só para diagnóstico visual — a validação de
// verdade abaixo usa o WebhookSignatureValidator do SDK, não esta função.
// Replica a lógica confirmada em node_modules/mercadopago/dist/utils/webhook
// (buildManifest): cada segmento entra só se o valor correspondente existir.
function manifestParaDiagnostico(dataId, requestId, ts) {
  const parts = []
  if (dataId) parts.push(`id:${dataId}`)
  if (requestId) parts.push(`request-id:${requestId}`)
  parts.push(`ts:${ts}`)
  return parts.join(';') + ';'
}

function parseXSignature(header) {
  let ts, v1
  for (const part of header.split(',')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    const val = part.slice(eq + 1).trim()
    if (key === 'ts') ts = val
    if (key === 'v1') v1 = val
  }
  return { ts, v1 }
}

const { ts, v1 } = parseXSignature(X_SIGNATURE)

console.log('--- Entrada ---')
console.log('x-signature (raw):', X_SIGNATURE)
console.log('  ts extraído:', ts)
console.log('  v1 extraído:', v1)
console.log('x-request-id:', X_REQUEST_ID)
console.log('data.id:', JSON.stringify(DATA_ID), DATA_ID ? '' : '(vazio/ausente — segmento id: será omitido)')
console.log()
console.log('--- Manifesto reconstruído (diagnóstico) ---')
console.log(manifestParaDiagnostico(DATA_ID, X_REQUEST_ID, ts))
console.log()

console.log('--- Validação real via SDK ---')
try {
  WebhookSignatureValidator.validate({
    xSignature: X_SIGNATURE,
    xRequestId: X_REQUEST_ID,
    dataId: DATA_ID,
    secret,
  })
  console.log('✅ ASSINATURA VÁLIDA.')
  console.log()
  console.log('Registrar em docs/spike-mp-log.md: os três valores acima + "válido".')
  console.log('Esse é o manifesto vencedor — é o que api/mercadopago-webhook.ts precisa reproduzir.')
} catch (err) {
  if (err instanceof InvalidWebhookSignatureError) {
    console.error('❌ ASSINATURA INVÁLIDA.')
    console.error('reason:', err.reason)
    console.error()
    console.error('Cruzar o reason com a lista de hipóteses no topo deste arquivo.')
    console.error('Ex.: SignatureMismatch com manifesto correto → suspeitar do segredo (hipótese 1).')
  } else {
    console.error('Erro inesperado (não é falha de assinatura):')
    console.error(JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
  }
  process.exit(1)
}

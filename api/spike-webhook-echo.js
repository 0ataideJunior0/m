// Function isolada e TEMPORÁRIA para a Tarefa M1.3 do docs/PLANO-MERCADOPAGO.md.
//
// Único propósito: capturar os headers e o body de uma notificação REAL do
// Mercado Pago (x-signature, x-request-id, data.id) para alimentar o
// scripts/spike-mp/03-verify-signature.mjs offline. Não valida nada, não
// grava nada, não faz parte do app — só loga e responde 200.
//
// DELETAR depois que a M1.3 fechar (junto da limpeza de scripts/spike-mp/
// na Fase M2). Não é o api/mercadopago-webhook.ts de produção — aquele
// será recuperado do histórico na M2.2, com a validação de verdade.

export default function handler(req, res) {
  console.log('=== SPIKE WEBHOOK ECHO ===')
  console.log('method:', req.method)
  console.log('query:', JSON.stringify(req.query))
  console.log('headers:', JSON.stringify(req.headers))
  console.log('body:', JSON.stringify(req.body))
  console.log('=== FIM ===')

  res.status(200).json({ ok: true, received: true })
}

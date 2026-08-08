# Spike Mercado Pago — Fase M1

Pasta temporária, criada para a Fase M1 do `docs/PLANO-MERCADOPAGO.md`.
**Deletar inteira na Fase M2** (Tarefa M2.1) — o conhecimento que ela produzir
já estará registrado em `docs/spike-mp-log.md`.

Nada aqui toca React, Supabase ou Vercel. É deliberado: a tentativa de julho
morreu porque os dois blockers (A e B) foram depurados com o app inteiro no
caminho. Isolar primeiro.

## Setup (uma vez)

```bash
npm install --no-save mercadopago@3.2.0
```

`--no-save` de propósito — esta dependência só entra em `package.json` de
verdade na Fase M2 (Tarefa M2.1), depois que o spike provar que vale a pena
recuperar o resto do código.

`mercadopago@3.2.0` é a mesma versão que a tentativa de julho usava
(confirmado contra `git show 3db7a4f:package.json`), não a mais recente —
é ela que precisa ser validada, não uma versão que o histórico nunca rodou.

## Uso

Os scripts leem `MERCADOPAGO_ACCESS_TOKEN` de `.env.local` via `--env-file`
nativo do Node (v20.6+; este projeto roda em v24). Sem dependência extra
para isso.

```bash
node --env-file=.env.local scripts/spike-mp/01-create-preapproval.mjs <payer_email>
node --env-file=.env.local scripts/spike-mp/02-get-preapproval.mjs <preapproval_id>
node --env-file=.env.local scripts/spike-mp/03-verify-signature.mjs
```

O `03` não recebe argumentos por linha de comando — os valores (x-signature,
x-request-id, data.id) vêm de uma notificação real capturada, e são colados
diretamente no script antes de rodar (ver comentário no topo do arquivo).
Isso é intencional: evita erro de escaping de shell com o header
`x-signature`, que contém vírgulas e o caractere `=`.

## Registro obrigatório

Toda tentativa — sucesso ou falha — vai para `docs/spike-mp-log.md`. É o que
a Fase M2 usa depois para saber a diferença entre "o que a documentação
promete" e "o que a API realmente devolveu".

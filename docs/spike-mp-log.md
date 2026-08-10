# Log do spike Mercado Pago — Fase M1

Registro de cada tentativa dos scripts em `scripts/spike-mp/`, conforme exigido pelas Tarefas M1.1–M1.3 do `docs/PLANO-MERCADOPAGO.md`. Sucesso e falha, sempre — é o que a Fase M2 usa para saber a diferença entre o que a documentação promete e o que a API do Mercado Pago realmente devolveu.

Formato por entrada: data, script, comando, resultado, o que foi aprendido.

---

## Estado em 2026-08-08 (antes de qualquer execução)

Preparação feita via MCP oficial do Mercado Pago (ver `docs/PLANO-MERCADOPAGO.md`, Registro de revisão 2):

- Aplicação `musaapp` (AppID `6869259522625752`) confirmada
- Credenciais de sandbox obtidas e gravadas em `.env.local`
- `MERCADOPAGO_WEBHOOK_SECRET` ainda **não existe** — nenhum webhook registrado
- Usuário de teste comprador existente desde julho (User ID `3549381055`), senha mascarada, pendente de reset pelo painel
- Hipótese antiga do blocker B (dataId vazio) **derrubada** antes mesmo de rodar o spike — ver script `03-verify-signature.mjs` para o raciocínio

Nenhum script foi executado ainda. Próxima entrada deve vir de uma execução real.

---

## 2026-08-08 — 01-create-preapproval.mjs

**Comando:** `node --env-file=.env.local scripts/spike-mp/01-create-preapproval.mjs comprador.teste.musa@example.com`

**Resultado:** falha (esperada — e informativa)

**Saída relevante:**
```json
{
  "message": "Both payer and collector must be real or test users",
  "status": 400
}
```

**Aprendizado:**

- Confirma o item 2 da ordem de investigação: com credenciais de sandbox, o Mercado Pago **exige que `payer_email` corresponda a um usuário de teste real** cadastrado no painel. Um e-mail arbitrário (mesmo sintaticamente válido, mesmo diferente do vendedor) é rejeitado antes de qualquer verificação de identidade pagador-vendedor.
- **Ainda não testa a hipótese A** (pagador = vendedor). Para isso, o próximo passo precisa do e-mail real do usuário de teste comprador (User ID `3549381055`, existente desde julho) — obter no painel, já que `create_test_user` via MCP só devolve usuário mascarado quando já existe.
- **Achado colateral, corrigido:** a chamada real ao SDK (`preApproval.create`) deixa um handle HTTP keep-alive fechando de forma assíncrona. Encerrar com `process.exit(1)` logo após o `catch` derruba o processo no Windows: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76`, com `EXIT: 127` (código enganoso — não é "comando não encontrado", é crash de baixo nível do libuv). Trocado por `process.exitCode = 1` em `01` e `02`, que deixa o event loop drenar antes de sair. Reproduzido de forma consistente antes da correção, ausente depois.

---

## 2026-08-08 — 01-create-preapproval.mjs (sucesso)

**Comando:** `node --env-file=.env.local scripts/spike-mp/01-create-preapproval.mjs test_user_233439973195359974@testuser.com`

Usado o e-mail real do usuário de teste comprador (User ID `3549381055`), obtido no painel após o reset de senha — formato `test_user_<username>@testuser.com`, confirmando o padrão que se suspeitava.

**Resultado:** ✅ sucesso — `init_point` gerada, `status: "pending"`.

**Campos que a M4.1 precisa (formato real, não o da doc):**

| Campo | Valor observado |
|---|---|
| `id` / `subscription_id` | `bc85fa0e36b2452bbd8da7af419cea70` — string hex, não UUID com hífens |
| `status` | `"pending"` (string, minúscula) |
| `next_payment_date` | preenchido **já na criação**, igual ao `date_created` — não é a data do próximo ciclo ainda, é só um placeholder até a assinatura ser autorizada. **Não confiar neste valor antes da M1.2** |
| `external_reference` | ecoado exatamente como enviado (`"spike-teste-001"`) |
| `payer_id` | `3549381055` — preenchido corretamente |
| `payer_email` | **vazio (`""`) na resposta**, apesar de enviado corretamente no request. Anomalia da API, não do código — registrar para não gerar confusão na M4 |
| `collector_id` | `3549380673` — o vendedor de teste, confirma que payer (`3549381055`) ≠ collector (`3549380673`) nesta chamada |
| `application_id` | `5680527538914392` — **diferente** do AppID principal (`6869259522625752`); é o app de teste auto-gerado pelo MP para o ambiente sandbox, não um erro |

**Aprendizado:**

- **Hipótese A não se confirmou como bloqueio nesta configuração.** `payer_id` (3549381055) e `collector_id` (3549380673) são contas distintas, e a criação funcionou sem erro. Isso não prova que payer=collector seria aceito (não foi testado, e não precisa ser — a topologia real de produção sempre terá pagador ≠ vendedor) — prova que o caminho **real** que o produto vai usar funciona.
- `BACK_URL` continua o placeholder (`SUBSTITUA-PELO-DOMINIO-VERCEL`). Isso é aceitável para a M1.2: ao autorizar, o navegador vai tentar redirecionar para um domínio que não existe e mostrar erro — **isso é esperado e não invalida a autorização**. O estado real da assinatura se confirma consultando por id via `02-get-preapproval.mjs`, não pelo redirect.

---

## 2026-08-08 — 02-get-preapproval.mjs (após autorização manual — M1.2)

**Comando:** `node --env-file=.env.local scripts/spike-mp/02-get-preapproval.mjs bc85fa0e36b2452bbd8da7af419cea70`

Autorizado manualmente pela `init_point`, logado como o comprador de teste, pagando com o saldo fictício da conta (não cartão).

**Resultado:** ✅ sucesso — `status` mudou de `"pending"` para `"authorized"`.

**Campos confirmados (agora com significado real, não placeholder):**

| Campo | Valor |
|---|---|
| `status` | `"authorized"` |
| `next_payment_date` | `"2026-09-08T18:41:05.000-04:00"` — **exatamente 1 mês** depois de `date_created` (08/08 → 08/09), confirma `auto_recurring.frequency: 1, frequency_type: 'months'` funcionando como esperado |
| `payment_method_id` | `"account_money"` — pago com saldo da conta MP, não cartão (esperado, dado o saldo fictício de 1000 na criação do usuário de teste) |
| `last_modified` | atualizado para o momento da autorização |
| `external_reference` | mantido |
| `payer_email` | continua vazio na resposta — confirma que é anomalia persistente da API, não só do momento da criação |

**Aprendizado:**

- **M1.2 fechada.** O ciclo completo criar → autorizar → consultar funciona de ponta a ponta em sandbox.
- **Consequência para a M4.1:** a defesa de "assinatura que expira" (checar `next_payment_date`) tem dado real pra se basear — o campo é confiável e previsível **depois** de `authorized`, não antes.
- **Consequência para a M1.3:** o webhook de autorização deveria ter disparado agora — mas **nenhuma notificação foi recebida**, porque a aplicação não tem webhook configurado ainda (confirmado na M0: `notifications_history` veio vazio, sem `MERCADOPAGO_WEBHOOK_SECRET`). A M1.3 precisa de um endpoint HTTPS público real para receber e capturar essa notificação — isso não estava resolvido no plano original, que assumia "logs do Vercel" já existindo neste ponto. Decisão pendente: expor um endpoint mínimo (tunnel local, ou deploy isolado de uma única function) sem recuperar o app inteiro.
- **M1.1 fechada.** Critério de aceite do plano satisfeito: script imprimiu `init_point` válida.

---

## 2026-08-08 — M1.3, tentativa 1: nenhuma notificação chegou

**Setup:**
1. Function isolada `api/spike-webhook-echo.js` (só loga headers/body, responde 200), deploy **preview** (não produção) em `musa20-j5wetpiwo-ataide-juniors-projects.vercel.app`
2. Preview protegido pelo "Vercel Authentication" por padrão — testado e confirmado que bloquearia até a notificação do MP (`401 Protected deployment`)
3. Contornado com "Protection Bypass for Automation" do Vercel (secret gerado pelo humano no painel), embutido na URL: `?x-vercel-protection-bypass=<secret>` — padrão oficialmente documentado pro Vercel pra webhooks de terceiros (Stripe, Slack, etc.)
4. Bypass testado via curl direto: `200 OK`
5. Webhook registrado via `save_webhook` (MCP), `callback_sandbox` apontando pra essa URL, tópico `subscription_preapproval`. Confirmado sucesso, segredo novo gerado (só os 7 primeiros caracteres visíveis: `d7f2a54...`)
6. Disparado `scripts/spike-mp/04-cancel-preapproval.mjs bc85fa0e36b2452bbd8da7af419cea70` (script novo, auxiliar — ver arquivo) → `status: "cancelled"` confirmado

**Resultado:** ❌ **nenhuma notificação chegou** em ~5 minutos de monitoramento (8 checagens a cada ~25s via `vercel logs --expand`, procurando pelo header `x-signature`). `notifications_history` (MCP) continua reportando "nenhuma notificação configurada", mesmo com o `save_webhook` tendo confirmado sucesso — suspeita de que essa tool só enxerga `callback` (produção), não `callback_sandbox`.

**O que isso NÃO prova:**
- Não prova que a hipótese B (agora sem candidato) está certa ou errada — nenhuma notificação chegou pra testar assinatura nenhuma.
- Não prova que o endpoint está inacessível — o bypass foi testado e funcionou para uma chamada manual.

**Hipóteses pra próxima tentativa, nesta ordem:**
1. **Delay maior que 5 minutos é normal em sandbox.** Fila de notificação de teste pode ter prioridade mais baixa. Ação: checar de novo mais tarde (30min+), sem novo gatilho.
2. **Cancelamento pode não ser um evento notificado**, mesmo estando no escopo do tópico `subscription_preapproval` — talvez só criação/autorização disparem. Ação: criar uma preapproval nova (com o webhook já registrado desta vez) e autorizar, em vez de cancelar uma existente.
3. **`notifications_history` (MCP) só refletir callback de produção** — o registro em sandbox pode estar correto mas invisível pra essa tool específica de diagnóstico. Ação: conferir a tela de Webhooks no painel do MP diretamente (mostra tentativas de entrega, sucesso/falha), não só via MCP.
4. **Algo na URL com query string embutida** (`?x-vercel-protection-bypass=...`) pode não estar sendo aceito como está pelo sistema de disparo de notificação do MP, mesmo o `save_webhook` tendo aceitado salvar. Ação: testar variação sem bypass, com proteção de preview desligada no painel (opção que foi preterida antes, mas vira plano B aqui).

**Não fechado.** Decisão de como prosseguir pendente do humano.

---

## 2026-08-09 — M1.3, causa encontrada: nenhum evento marcado no painel

**Tentativa 2 (antes da descoberta):** criada uma preapproval nova (`97b69434fcdc4ca7bec73bdcb87e02a6`) **com o webhook já registrado**, e autorizada manualmente. Confirmado via `02-get-preapproval.mjs` que chegou a `status: "authorized"` — ou seja, o evento realmente aconteceu. Mesmo assim, ~5 minutos de monitoramento (10 checagens): **nada entregue**. Isso descartou de vez as hipóteses de "delay de sandbox" e "cancelamento não é evento notificado".

**🔴 CAUSA RAIZ (encontrada pelo humano, olhando o painel):** na tela de Webhooks do painel do Mercado Pago, o campo *URL para teste* estava preenchido corretamente com a URL do bypass — mas **todos os checkboxes de evento estavam desmarcados**. Nenhum tópico assinado ⇒ nada a notificar ⇒ silêncio absoluto, sem erro em lugar nenhum.

O checkbox necessário é **"Planos e assinaturas"**, na seção *Outros eventos*.

**Discrepância a registrar sobre a tool `save_webhook` do MCP:** ela foi chamada com `topics: ["subscription_preapproval"]` e **respondeu sucesso**, inclusive imprimindo:

```
## 📋 Subscribed Topics
1. **subscription_preapproval**
```

Mas o painel mostra que nenhum evento foi de fato marcado. **A tool grava a URL e o segredo, mas aparentemente não aplica os tópicos** — ou usa um identificador de tópico que a UI não reconhece. Consequência prática: **não confiar no retorno de sucesso do `save_webhook` para os tópicos; conferir sempre no painel.** Vale registrar em `docs/ACHADOS-EXTRAS.md` quando a Fase M2 começar.

**Lição de método:** três ciclos de espera (~10 min somados) foram gastos monitorando um endpoint que nunca receberia nada, porque confiei no retorno de sucesso da tool em vez de verificar o estado real na fonte. A tool de diagnóstico `notifications_history` também não ajudou — reportava "nenhuma notificação configurada", que estava tecnicamente correto mas eu li como "ainda não chegou nada" em vez de "não há nada configurado para chegar". **O sinal estava lá, mal interpretado.**

**Próximo passo:** marcar "Planos e assinaturas" no painel, salvar, e disparar um evento novo (criar + autorizar mais uma preapproval, ou cancelar a `97b69434fcdc4ca7bec73bdcb87e02a6` que está `authorized`).

<!-- Próxima entrada:

## AAAA-MM-DD HH:MM — 01-create-preapproval.mjs

**Comando:** `node --env-file=.env.local scripts/spike-mp/01-create-preapproval.mjs <email>`

**Resultado:** sucesso | falha

**Saída relevante:**
```
(colar aqui)
```

**Aprendizado:**

-->

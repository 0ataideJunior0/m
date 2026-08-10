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

---

## 2026-08-09 — M1.3, tentativa 3: tópico marcado, **ainda nada** → hipótese das duas abas

**Setup:** humano marcou "Planos e assinaturas" no painel (aba *Modo de teste*) e salvou; o segredo **não mudou** e foi colado no `.env.local`. Endpoint reconfirmado de pé (`curl` → `200 OK`, 1s). Disparado cancelamento da `97b69434fcdc4ca7bec73bdcb87e02a6` (que estava `authorized`) → `status: "cancelled"` confirmado.

**Resultado:** ❌ nada entregue em ~3 minutos (7 checagens). `notifications_history` continua reportando "nenhuma notificação configurada".

### 🔴 Hipótese nova — e ela pode explicar o blocker B de julho inteiro

A tela de Webhooks tem **duas abas**: *Modo de teste* e *Modo de produção*. Tudo o que foi configurado até agora (via `save_webhook` com `callback_sandbox`, e o checkbox marcado pelo humano) está na aba de **teste**. A URL de **produção** está vazia.

**Suspeita:** a "URL para teste" pode servir **apenas ao botão "Simular"** do painel. Eventos reais — mesmo os gerados com credenciais de sandbox — talvez sejam entregues no `callback` de **produção**.

Encaixe com o histórico de julho (ver memória do projeto):

| | Julho | Agora |
|---|---|---|
| URL de produção configurada | **sim** (app deployado em produção) | **não** (vazia) |
| Eventos reais chegavam | **sim** — chegavam, mas falhavam na validação de assinatura | **não chegam** |
| Botão "Simular" | validava corretamente | não testado |

**Corolário forte, e a parte que importa:** se **cada aba tem seu próprio segredo**, julho pode ter falhado porque o código validava com o segredo de uma aba enquanto os eventos reais vinham assinados com o da outra. A assinatura nunca bateria, e o simulador sempre funcionaria — que é **exatamente** o sintoma que a sessão de julho descreveu e atribuiu a "bug de plataforma do Mercado Pago".

Isso substituiria tanto a hipótese do `dataId` (já derrubada) quanto a teoria do bug de plataforma, e não teria nada a ver com o formato do manifesto.

**Teste decisivo (pendente do humano):** abrir a aba *Modo de produção* e verificar se o segredo mostrado ali é **diferente** do que está no `.env.local`. Se for diferente, a hipótese está praticamente confirmada.

### Resultado do teste decisivo (2026-08-09)

Humano verificou a aba *Modo de produção*:

| Verificação | Resultado |
|---|---|
| URL de produção preenchida? | **não, vazia** |
| Checkbox do tópico marcado? | **sim** (aparentemente os tópicos são compartilhados entre as abas — só as URLs são separadas) |
| Segredo diferente do da aba de teste? | **não, é o mesmo** |

**❌ Sub-hipótese dos "dois segredos" DERRUBADA.** Ambas as abas usam a mesma assinatura secreta. Isso elimina a explicação de que julho falhava por validar com o segredo da aba errada — e **o blocker B de julho volta a não ter causa conhecida** (de novo). Duas teorias já caíram: o `dataId` vindo da query, e agora os segredos divergentes por aba.

**✅ Sub-hipótese "URL de teste só serve ao Simular" SOBREVIVE, e agora é a principal para o silêncio atual.** A configuração está aparentemente correta (tópico marcado, URL de teste preenchida, endpoint de pé, segredo certo) e mesmo assim nada é entregue. A única coisa faltando é a **URL de produção, que está vazia** — e é justamente o que existia em julho, quando eventos reais *chegavam*.

Ou seja: o padrão inverso continua encaixando. Julho tinha URL de produção → recebia eventos (que falhavam na assinatura). Agora não tem → não recebe nada.

**Próximo passo:** preencher a URL de **produção** com a mesma URL do bypass e disparar um evento. Fazer **pelo painel, não pelo `save_webhook`** — a tool já provou que não aplica tópicos de forma confiável, e rodá-la agora arriscaria desmarcar o checkbox que o humano acabou de corrigir.

**Não fechado.**

---

## 2026-08-09 — M1.3 PAUSADA: painel do Mercado Pago em manutenção

**Tentativas 4 e 5 (com a URL de produção já preenchida pelo humano):** criada preapproval `0f2a9d3a966a42bcb5d6cbdaad0eb919` (evento de criação) e em seguida cancelada (mudança de estado). ~3 minutos de monitoramento, 6 checagens. **Nada entregue.**

**🔴 Descoberta que encerra a investigação por ora:** ao tentar consultar o histórico de entregas no painel, o humano recebeu:

> *"Painel em manutenção — Esta tela está em modo de manutenção e estará de volta em breve."*

**Consequência metodológica:** não é possível depurar entrega de webhook enquanto o subsistema de monitoramento do provedor está em manutenção. Se a tela de monitoramento está fora, é plausível que o despacho de notificações esteja degradado junto — e qualquer conclusão tirada agora seria sobre o estado da manutenção, não sobre a configuração. **Continuar tentando produziria dados não confiáveis.**

### Balanço da M1.3 nesta sessão

| Verificação | Status |
|---|---|
| Endpoint acessível | ✅ `curl` → 200, confirmado múltiplas vezes |
| Tópico "Planos e assinaturas" marcado | ✅ nas duas abas |
| Segredo correto carregado no `.env.local` | ✅ |
| URL de teste configurada | ✅ |
| URL de produção configurada | ✅ |
| Eventos realmente ocorreram | ✅ confirmado via API (`authorized`, `cancelled`) |
| **Notificação entregue** | ❌ **nenhuma, em 5 disparos / ~25 min** |

**Estado deixado no ar de propósito:** a function `api/spike-webhook-echo.js` continua deployada e a URL segue registrada no MP. Se a manutenção terminar e alguma notificação atrasada for entregue, ela **será capturada nos logs** — vale checar `vercel logs musa20-j5wetpiwo-ataide-juniors-projects.vercel.app --expand` numa próxima sessão antes de disparar qualquer coisa nova. Preapprovals de teste usadas: `bc85fa0e...` (cancelada), `97b69434...` (cancelada), `0f2a9d3a...` (cancelada).

**Hipóteses que sobrevivem, para a próxima sessão:**
1. **Manutenção da plataforma** afetando o despacho — testar simplesmente repetindo um disparo quando o painel voltar
2. **URL de teste só serve ao botão "Simular"** — ainda não descartada, mas agora confundida com a manutenção
3. Usar o botão **"Simular"** do painel como teste de controle: não fecha a M1.3 (o plano exige notificação real, justamente porque o simulador enganou em julho), mas provaria que o endpoint recebe e que a assinatura valida, isolando o problema ao disparo de eventos reais

**Teorias já derrubadas (não revisitar sem evidência nova):** `dataId` lido da query (refutado contra o código-fonte do SDK 3.2.0) e segredos diferentes por aba (refutado — são o mesmo).

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

# Plano de Implementação — Mercado Pago Assinaturas

**Destinatário:** agente de código
**Data:** 2026-08-08
**Revisão:** 2026-08-08, após verificação das afirmações contra o repositório e o banco
**Relação com o `PLANO-CORRECOES.md`:** este documento **substitui a Fase 6** daquele plano. A Tarefa 6.1 (documento de arquitetura de acesso) vira a Fase M4 aqui; a 6.2 (`hasContentAccess()` especulativo) fica **cancelada** — a decisão de monetização foi tomada, então não há mais motivo para construir um seam genérico.

**Pré-requisito:** Fase 0.5 do plano de correções (`npm test` verde). Sem isso, não há como distinguir regressão de ruído. ✅ concluída.

---

## Registro de revisão (2026-08-08)

As afirmações factuais deste plano foram conferidas contra o repositório e contra o banco de produção (via MCP read-only). **Nenhuma estava errada** — os 7 commits citados existem com as mensagens descritas, os 10 arquivos estão recuperáveis em `3db7a4f`, `feature/mercadopago-billing` é ancestral de `main`, o `vercel.json`/`.vercelignore` são como descritos, e `subscriptions`/`has_active_subscription()` de fato não existem mais no banco (enquanto `is_admin()` existe).

**A hipótese B se confirmou, e é mais forte do que o texto original argumenta.** O `api/mercadopago-webhook.ts` de `3db7a4f` lê `dataId` só da query — e o mesmo arquivo já continha a lição de que body e query divergem (toda a lógica de `bodyType`/`bodyEntity`/`queryType`), sem nunca aplicá-la ao `id`. Pior: `dataId` vazio também quebraria o `preApproval.get({ id: dataId })` logo abaixo. Um bug, dois sintomas.

Seis ajustes foram aplicados:

| # | Onde | Ajuste |
|---|---|---|
| 1 | §9 M5, passo 2 | **Contradição interna.** O §4 afirma que o MP rejeita pagador = vendedor, mas a M5 mandava testar em produção "com a sua própria conta". Se a hipótese estiver certa, esse teste falha pelo mesmo motivo do blocker A. Agora exige uma segunda identidade |
| 2 | §8 M4.3 | **Inventário do Storage feito.** A policy é RLS comum em `storage.objects` e *pode* chamar `has_active_subscription()`. A Vercel Function vira plano B, não expectativa |
| 3 | §6 M2.1 | `src/__tests__/subscription.test.ts` não era restaurado por nenhuma fase — são **8** arquivos de teste em `3db7a4f`, não 7 |
| 4 | §8 M4.1 / §10 M6.2 | Faltava tratar assinatura que expira: `status = 'authorized'` sem reconciliação vira acesso gratuito indefinido se um webhook se perder |
| 5 | §8 M4.2 | O gate em `user_progress` (presente na migration de julho) sumiu sem discussão. Decisão agora explícita |
| 6 | §4 M0 / §6 M2.3 / §12 | **A aplicação antiga do Mercado Pago foi excluída pelo humano.** Token e webhook secret do `.env.local` estão mortos |

**Não verificado:** que as functions realmente executavam no Vercel (§1 se apoia em logs do Vercel, sem acesso). É a base do argumento "não perca tempo com roteamento" — plausível pelo `vercel.json`/`.vercelignore`, mas não confirmado de forma independente.

---

## Registro de revisão 2 (2026-08-08, com MCP do Mercado Pago conectado)

O MCP oficial do Mercado Pago (`mcp.mercadopago.com`, OAuth) foi conectado e usado para inspecionar a conta real e a documentação oficial. Dois resultados mudam o plano de forma material.

### 🔴 A hipótese B do §5 (M1.3) está DERRUBADA — e a correção proposta quebraria o webhook

A hipótese anterior era: `dataId` vem vazio porque o código só lê da query, e a correção seria `dataId || req.body?.data?.id`.

**Isso está errado.** Verificação em duas camadas:

1. **Documentação oficial** (via `search_documentation`), implementação de referência oficial em JS:
   ```js
   const parts = [];
   if (dataId)     parts.push(`id:${dataId}`);      // ← condicional
   if (xRequestId) parts.push(`request-id:${xRequestId}`);
   parts.push(`ts:${ts}`);
   ```
   Quando `data.id` não vem na notificação, o segmento `id:` **não vira vazio — é omitido inteiro** do manifesto.

2. **Código-fonte do SDK `mercadopago`, na versão exata que julho usava** (`3.2.0`, confirmada contra `git show 3db7a4f:package.json`, publicada 30/06, antes do revert de 20/07):
   ```js
   function buildManifest(dataId, requestId, ts) {
       const parts = [];
       if (dataId) parts.push(`id:${dataId}`);
       if (requestId) parts.push(`request-id:${requestId}`);
       parts.push(`ts:${ts}`);
       return parts.join(';') + ';';
   }
   ```
   Testado empiricamente contra essa versão instalada: `dataId=''` **valida corretamente** (o SDK normaliza para omitir o segmento, igual à doc). Um `dataId` presente onde o MP calculou sem ele **quebra** a assinatura (`SignatureMismatch`).

**Conclusão:** o `|| ''` do código antigo era inofensivo — o SDK já tratava isso do jeito documentado, em julho. A correção `|| req.body?.data?.id` do plano **adicionaria** um segmento que o Mercado Pago não usou no cálculo, transformando uma validação correta em falha.

**O blocker B continua sem causa conhecida.** A M1.3 muda de enquadramento: não é mais "aplicar a correção do `dataId`", é investigar do zero, sabendo que o SDK está correto. Hipóteses que continuam de pé: segredo de ambiente errado, algo na entrega da requisição pelo Vercel, ou o problema de plataforma que a sessão de julho já suspeitava.

### M0 — progresso real via MCP

- ✅ **Aplicação já existe:** `musaapp`, AppID `6869259522625752`, Owner ID `331578155`
- ⚠️ **Credenciais de produção não ativadas** — o painel pede completar a configuração da aplicação antes de liberá-las (`https://www.mercadopago.com.br/developers/panel/app/6869259522625752`)
- ✅ **Credenciais de sandbox obtidas e gravadas em `.env.local`** (`MERCADOPAGO_ACCESS_TOKEN` atualizado; valores não repetidos aqui nem no chat, por instrução da própria tool)
- ❌ **Nenhum webhook configurado hoje** — `notifications_history` retornou vazio, pedindo para cadastrar via `save_webhook`. `MERCADOPAGO_WEBHOOK_SECRET` foi limpo do `.env.local` (o antigo é da aplicação excluída); só existe segredo novo depois de registrar o webhook
- ✅ **Vendedor de teste**: auto-gerado junto da aplicação (seller user ID `3549380673`) — é o dono das credenciais de sandbox
- ✅ **Comprador de teste já existe**, sobrevivente da tentativa de julho: User ID `3549381055`, username `TESTUSER233439973195359974`, perfil `buyer`, ativo. **Senha mascarada** — `create_test_user` não recria nem revela senha de usuário já existente. Para obter/resetar: painel → aplicação → Contas de teste → ⋮ → "Gerar nova senha". Não bloqueia a M1.1 (que só precisa do e-mail como argumento de linha de comando), só bloqueia o passo manual de autorização da M1.2
- ⚠️ `quality_checklist` não responde à pergunta "Assinaturas está habilitado" — devolve uma lista genérica de boas práticas de Checkout. A confirmação real do produto Assinaturas continua sendo o próprio resultado da M1.1

---

## 1. Contexto — isto já foi construído e abandonado

Entre 18/07 e 20/07/2026, a integração foi implementada por inteiro, **mergeada no `main`**, e depois revertida. Ela **não vive num branch paralelo**: `origin/feature/mercadopago-billing` é ancestral do `main`. O código está no histórico, removido pelo commit `9d8ff44 revert: roll back Mercado Pago billing integration`. Há **71 commits** desde então.

> ⚠️ Correção de uma suposição anterior: **não é um `cherry-pick`.** É recuperação de arquivos de um commit histórico (`git checkout 3db7a4f -- <path>`) seguida de reancoragem no schema atual, que mudou muito desde julho.

### O que existe no histórico (commit `3db7a4f`, último antes do revert)

| Arquivo | Função |
|---|---|
| `api/create-subscription.ts` | cria preapproval, devolve `init_point` |
| `api/cancel-subscription.ts` | cancela no MP e reflete local |
| `api/mercadopago-webhook.ts` | valida assinatura, faz upsert em `subscriptions` |
| `api/_lib/mercadopagoConfig.ts` | client do SDK |
| `api/_lib/supabaseAdmin.ts` | client com `service_role` |
| `scripts/create-preapproval-plan.mjs` | criação do plano (**hoje inútil** — ver §3) |
| `src/utils/subscription.ts` | camada de dados no cliente |
| `src/pages/Subscribe.tsx`, `MySubscription.tsx` | UI de assinatura |
| `src/components/RequireSubscription.tsx` | guard de rota |
| **8** arquivos de teste | `apiCreateSubscription`, `apiCancelSubscription`, `apiMercadopagoWebhook`, `apiLib`, `subscription`, `Subscribe`, `MySubscription`, `RequireSubscription` |
| `supabase/migrations/20260718090000_subscriptions.sql` | **ainda está no `main`**, revertida pela `20260720120000` |

Dependências a restaurar no `package.json`: `mercadopago@^3.2.0` (prod) e `@vercel/node@^5.8.26` (dev).

### Por que foi abandonado — a parte que importa

A sequência dos últimos 6 commits antes do revert conta a história. **Dois problemas ficaram em aberto**, e o revert veio logo depois:

```
9d8ff44  revert: roll back Mercado Pago billing integration
3db7a4f  debug(webhook): log signature-mismatch diagnostics        ← blocker B
39268df  fix(webhook): trust body.type/entity over query.type
09a9ed5  debug(webhook): log ignored events and accept topic param
029d6aa  debug(billing): log full error object properties          ← blocker A
6f65691  fix(billing): create preapproval without a plan
```

**Blocker A — 500 do Mercado Pago ao criar a assinatura.** O código original usava `preapproval_plan_id`; o MP respondeu `card_token_id is required`, porque preapproval **com** plano associado exige tokenização de cartão no cliente (Bricks) — o oposto do design pretendido, que era redirect para checkout hospedado. O commit `6f65691` corrigiu isso para o formato certo (preapproval **sem** plano, `auto_recurring` inline, `status: 'pending'`). Aí veio **um 500 de sandbox**, e o commit seguinte só adiciona logging para diagnosticar. **Nunca foi resolvido.**

**Blocker B — assinatura de webhook não confere.** Três commits de debug em sequência, terminando num log de diagnóstico de `signature mismatch`. **Nunca foi resolvido.**

**Consequência para este plano:** não faz sentido recuperar código nenhum antes de resolver A e B isoladamente. É exatamente o erro que afundou a tentativa anterior — depurar API externa com o app inteiro no caminho. A **Fase M1** existe só para isso.

### O que já foi descartado como causa

As duas funções **estavam sendo executadas** — os logs de erro que motivaram os commits de debug são do SDK do Mercado Pago e do validador de assinatura, ou seja, o código rodou. Portanto **não é problema de roteamento**. O `vercel.json` com `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}` é seguro: no Vercel, `rewrites` são *afterfiles* e só se aplicam depois do filesystem, então `/api/*` resolve para as functions normalmente. O `.vercelignore` também não exclui `api/`. **Não perca tempo aqui.**

---

## 2. Decisões travadas (confirmadas pelo humano em 2026-08-08)

| Decisão | Valor | Impacto |
|---|---|---|
| **Preço** | R$ 59,90/mês, mensal, **sem trial** | idêntico ao código antigo — reaproveita `auto_recurring` como está |
| **Conta MP** | **CPF (pessoa física)** | ver §3 — muda o teste e limita nota fiscal |
| **Usuárias atuais** | **sem grandfathering** — todas precisam assinar | schema mais simples, risco operacional maior (§7) |

---

## 3. O que a conta ser CPF muda

**Assinaturas funcionam com CPF.** Mas três consequências entram no plano:

1. **`scripts/create-preapproval-plan.mjs` está obsoleto.** O commit `6f65691` já tinha tornado o plano associado inútil — o preço passou a viver inline no `auto_recurring` da própria função. Recuperar esse script seria recuperar código morto. **Não recuperar.** Registrar em `docs/ACHADOS-EXTRAS.md`.

2. **Nota fiscal.** Como pessoa física, você não emite NF-e de serviço de forma trivial. Cobrança recorrente de assinatura sem nota é um risco fiscal que cresce com o volume. Isso **não bloqueia o código**, mas precisa de decisão sua antes de escalar (MEI resolve barato). Tarefa M6.3.

3. **Pix Automático exige contratação junto à instituição financeira** e, pelo que a documentação indica, é orientado a pessoa jurídica. **Fora de escopo desta implementação** — reavaliar depois de eventual CNPJ.

---

## 4. Fase M0 — Criar a aplicação nova e registrar as credenciais (humano, antes de código)

> 🔄 **Fase reescrita em 2026-08-08.** O texto original assumia que a aplicação de julho ainda existia e que a tarefa era *auditar* credenciais. **O humano excluiu aquela aplicação.** Isso muda a natureza da fase: não é mais verificação, é criação — e as credenciais no `.env.local` agora são lixo, não insumo.

**Por quê:** o blocker A tem cara de problema de credencial/conta, não de código. E aplicação nova significa credenciais novas, do zero, sem herdar nenhuma dúvida de julho.

### O que a exclusão da aplicação antiga resolve de graça

- **`MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET` do `.env.local` estão mortos.** Ambos são por aplicação; a aplicação não existe mais. Eles precisam ser **substituídos**, não reaproveitados
- A hipótese secundária nº 1 do blocker B ("segredo do ambiente errado") deixa de ser especulação histórica: você vai copiar o segredo certo, uma vez, sabendo de qual tela
- A rotação de credenciais exigida pela M2.3 **acontece automaticamente** — as credenciais expostas no OneDrive desde julho já não valem nada. Continua valendo remover as strings mortas do `.env.local`, por higiene

### Checklist para o humano responder por escrito

> ✅ **Progresso via MCP em 2026-08-08** — ver Registro de revisão 2 no topo do documento para os detalhes completos.

- [x] Aplicação criada em *Suas integrações*. **AppID `6869259522625752`** (`musaapp`), confirmado via `application_list`
- [ ] A conta tem o produto **Assinaturas** (preapproval) habilitado para essa aplicação? — **não confirmado ainda**; `quality_checklist` não responde isso. Fica para a M1.1: se o `PreApproval.create` funcionar, está habilitado
- [x] Ambiente: **sandbox** primeiro (Access Token de teste já obtido e gravado em `.env.local`). Produção é passo separado — ver abaixo
- [ ] `MERCADOPAGO_WEBHOOK_SECRET` — **não existe ainda**. Nenhum webhook está registrado nesta aplicação (`notifications_history` veio vazio). Só existe segredo depois de rodar `save_webhook` (tool do MCP) com uma URL pública — isso acontece dentro da M1.3, junto com o deploy mínimo necessário para receber a notificação real
- [ ] Qual é o **e-mail da conta MP vendedora**? — ainda seu, para confirmar
- [x] **E-mail pagador**: usuário de teste comprador sobrevivente de julho (User ID `3549381055`). **E-mail confirmado:** `test_user_233439973195359974@testuser.com` — formato `test_user_<username>@testuser.com`

> ⚠️ **Produção não está ativa.** O painel do MP pede para completar a configuração da aplicação antes de liberar credenciais de produção (`APP_USR-...` de produção). Isso é bloqueante só para a M5 (ativação real), não para a M1 (spike em sandbox).

> 🔴 **Hipótese principal do blocker A.** O Mercado Pago **rejeita uma assinatura em que o pagador é o próprio vendedor**. O `create-subscription.ts` usa `payer_email: user.email` — o e-mail da conta Supabase logada. Se os testes de julho foram feitos com a sua própria conta (o `.env.local` e os commits são da mesma pessoa), o MP recusaria de forma legítima, e a mensagem de erro do SDK não deixa isso óbvio.
>
> **Corolário:** com credenciais de teste, é obrigatório usar **usuários de teste** gerados pelo painel do MP — tanto vendedor quanto comprador. Um e-mail real com token `TEST-` também falha.

> ⚠️ **Consequência que atravessa o plano inteiro: você vai precisar de duas identidades.**
>
> Se a hipótese acima estiver certa, ela não afeta só o spike — afeta **todo teste de ponta a ponta**, inclusive o de produção da Fase M5. Providencie desde já:
>
> - **e-mail vendedor**: o da conta MP que recebe o dinheiro
> - **e-mail pagador**: uma conta no app Musa Fit com e-mail **diferente**, usada para assinar nos testes
>
> Sem isso, a M5 passo 2 é impossível de executar como escrita.

**Critério de aceite:** checklist respondido; aplicação confirmada ✅; ambiente sandbox pronto ✅; as duas identidades definidas (vendedor ✅ auto-gerado, comprador ✅ existente com senha pendente de reset); `.env.local` atualizado com as credenciais novas ✅.

> ✅ **CHECKPOINT M0 fechado em 2026-08-08.** Assinaturas confirmado habilitado (a M1.1 rodou e criou a preapproval com sucesso — critério indireto que o próprio checklist previa). Senha do comprador de teste resetada pelo humano; e-mail confirmado.

> ⛔ **CHECKPOINT M0**

---

## 5. Fase M1 — Spike isolado: matar os dois blockers fora do app

**Esta é a fase que decide se o projeto anda.** Nada de React, nada de Supabase, nada de Vercel. Scripts avulsos, rodados na mão, até os dois fluxos funcionarem de ponta a ponta.

Criar `scripts/spike-mp/` — pasta temporária, **a ser deletada na Fase M2**.

### Tarefa M1.1 — Criar uma assinatura e obter `init_point`

`scripts/spike-mp/01-create-preapproval.mjs`: script standalone que lê `MERCADOPAGO_ACCESS_TOKEN` do `.env.local`, recebe o e-mail do pagador por argumento de linha de comando, e chama `PreApproval.create` com o corpo que o commit `6f65691` deixou pronto:

```js
{
  reason: 'Musa Fit - Assinatura mensal',
  auto_recurring: {
    frequency: 1,
    frequency_type: 'months',
    transaction_amount: 59.90,
    currency_id: 'BRL',
  },
  payer_email: <argv>,
  external_reference: 'spike-teste-001',
  back_url: 'https://<dominio-vercel>/subscribe',
  status: 'pending',
}
```

Imprimir o objeto de erro **completo** em caso de falha — `JSON.stringify(err, Object.getOwnPropertyNames(err))`, como o commit `029d6aa` já fazia. O SDK do MP esconde `cause` e `errors` em propriedades não-enumeráveis.

**Ordem de investigação se falhar** (não pule etapas, e registre cada tentativa em `docs/spike-mp-log.md`):

1. `payer_email` diferente do e-mail da conta vendedora — **testar isto primeiro**
2. token de teste + usuário de teste do painel (nunca e-mail real com token `TEST-`)
3. `back_url` com HTTPS e domínio real (não `localhost`)
4. mesma chamada via `curl` direto na API REST, sem o SDK — isola bug de SDK de erro de payload
5. só então suspeitar de conta sem Assinaturas habilitado

**Critério de aceite:** o script imprime uma `init_point` válida, e abrir essa URL no navegador mostra a tela de autorização do Mercado Pago com R$ 59,90/mês.

> ✅ **FECHADA em 2026-08-08.** `init_point` gerada (`https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=bc85fa0e36b2452bbd8da7af419cea70`), `status: "pending"`. Payer (`3549381055`) ≠ collector (`3549380673`) — a hipótese A não bloqueou a topologia real que o produto vai usar. Detalhes e anomalias observadas (ex.: `payer_email` volta vazio na resposta) em `docs/spike-mp-log.md`. Falta abrir a URL e autorizar manualmente — Tarefa M1.2.

### Tarefa M1.2 — Fazer a assinatura chegar a `authorized`

Autorizar manualmente pelo `init_point` (com usuário de teste ou cartão real de verdade — a R$ 59,90, um ciclo real é um custo aceitável para validar). Depois, `scripts/spike-mp/02-get-preapproval.mjs` consulta por id e imprime o objeto inteiro.

**Registrar em `docs/spike-mp-log.md`:** o formato exato de `status`, `next_payment_date`, `external_reference` e `id`. A migration da Fase M4 depende desses valores reais, não do que a documentação promete.

> ✅ **FECHADA em 2026-08-08.** Autorizado manualmente via `init_point`, `status` mudou para `"authorized"`, `next_payment_date` bateu exatamente 1 mês à frente de `date_created`. Detalhes completos em `docs/spike-mp-log.md`.

> ⚠️ **Gap descoberto ao fechar a M1.2, não previsto no plano original:** a autorização deveria disparar um webhook de `subscription_preapproval`, mas **nenhuma notificação chegou** — a aplicação não tem webhook configurado (confirmado na M0). A M1.3, como escrita, assume "notificação real capturada dos logs do Vercel" — mas a Fase M1 inteira se define como "nada de Vercel" no parágrafo de abertura (§5). Essas duas frases se contradizem na prática: não dá para capturar uma notificação real sem *algum* endpoint HTTPS público recebendo-a, e isso não existia no momento em que o plano foi escrito. Resolvido na Tarefa M1.3 abaixo, com uma opção que preserva o espírito de isolamento (sem recuperar o app inteiro) mas reconhece que "zero infraestrutura" não é possível para esta tarefa específica.

### Tarefa M1.3 — Resolver a validação de assinatura do webhook

O blocker B. `api/mercadopago-webhook.ts` (versão `3db7a4f`) monta o manifesto a partir de:

```ts
const dataId = (req.query['data.id'] as string) || ''
```

> ❌ **Hipótese anterior DERRUBADA em 2026-08-08 (Registro de revisão 2).** A suspeita era que `dataId` chegava vazio e a correção seria `dataId || req.body?.data?.id`. Verificado contra a documentação oficial (via MCP) **e** contra o código-fonte do SDK `mercadopago@3.2.0` — a versão exata que julho usava: o `buildManifest` do SDK já **omite o segmento `id:` inteiro** quando `dataId` é vazio, que é exatamente o comportamento documentado. Testado empiricamente: `dataId=''` valida corretamente contra essa versão. **A correção proposta quebraria uma assinatura calculada certo**, adicionando um segmento que o Mercado Pago não usou no HMAC.
>
> O `dataId = ''` do código antigo **não era o bug**. O blocker B continua sem causa conhecida — esta tarefa parte do zero, não de uma correção pronta para aplicar.

Hipóteses a investigar, nesta ordem (nenhuma delas é "aplicar `|| req.body?.data?.id`" — isso está descartado):

1. **Segredo do ambiente errado.** Teste e produção têm segredos diferentes, e a aplicação atual não tem webhook configurado ainda (M0) — o primeiro segredo real só existe depois de rodar `save_webhook`
2. **`x-signature` mal parseado** — é `ts=...,v1=...` separado por vírgula; o SDK já faz esse parse corretamente, mas vale descartar uma implementação manual paralela
3. **ids alfanuméricos precisam ser minúsculos no manifesto** — o SDK também já normaliza isso
4. **o simulador do painel do MP assina de forma diferente de uma notificação real** — a memória do projeto registra exatamente essa assimetria em julho (simulador validava, notificação real não). **Validar com notificação real, nunca só com o simulador**
5. **Algo específico do runtime do Vercel** na forma como o body chega à function (parsing, encoding) antes do SDK processar

Manifesto de referência (para instrumentar o log de diagnóstico, não para reescrever manualmente — o SDK já implementa isso):
`id:{dataId};request-id:{x-request-id};ts:{ts};`, omitindo qualquer segmento cujo valor esteja ausente → HMAC-SHA256 com o segredo → comparar com `v1` do header `x-signature`.

Método: `scripts/spike-mp/03-verify-signature.mjs` recebe `x-signature`, `x-request-id` e `data.id` capturados de uma notificação **real** (dos logs do Vercel) e roda o `WebhookSignatureValidator` do SDK contra eles, logando o manifesto exato que o SDK monta internamente. Assim você depura offline, sem esperar a próxima notificação a cada tentativa.

> ✅ **FECHADA em 2026-08-10, com critério de aceite revisado.** Cinco disparos reais (criar/autorizar/cancelar preapprovals de teste) ao longo de duas sessões: **zero notificações**. Três interações via painel (editar URL do webhook, clicar "Simular"): **três notificações, todas validando corretamente**.
>
> **Causa raiz encontrada na documentação oficial** (não é bug, não é config errada):
>
> > *"Os pagamentos de teste, criados com credenciais de teste, não enviarão notificações. A única maneira de testar o recebimento de notificações é por meio da Configuração via Suas integrações."*
>
> Em modo de teste, o Mercado Pago **não notifica eventos reais por design** — só o mecanismo de teste do próprio painel gera notificação, sempre com um payload de exemplo fixo (`data.id: "123456"`, data de 2021). O critério de aceite original ("uma notificação real passa na validação") é **irrealizável em sandbox**, não porque algo esteja quebrado, mas porque a plataforma não oferece esse caminho nesse modo.
>
> **Critério de aceite revisado, e satisfeito:** validar a assinatura de uma notificação de teste do painel — que é exatamente o método que a própria documentação recomenda para este estágio. Resultado, 3 de 3 tentativas: `✅ ASSINATURA VÁLIDA`. Confirma secret correto, `WebhookSignatureValidator` do SDK funcionando, manifesto entendido corretamente, endpoint acessível.
>
> **Consequência para o restante do plano:** a validação de um evento real (`payment.created`/`subscription_preapproval` de uma assinatura de verdade) só é possível com **credenciais de produção**, contra uma preapproval real. Isso não pertence mais à M1 (spike isolado) — pertence à **M5** (ativação em produção), que já previa "teste real de ponta a ponta em produção, com a sua própria conta e cartão real" como passo 2. Nenhuma mudança de tarefas necessária ali, só o reconhecimento de que é essa etapa, e não a M1.3, que vai fechar essa validação por completo.
>
> **Nota histórica, não confirmada:** isso reabre uma pergunta sobre o que exatamente aconteceu em julho. A memória do projeto registra que notificações *reais* chegavam e falhavam na assinatura — o que é incompatível com testes puramente em modo sandbox, dado o que a documentação afirma. Ou julho testou com credenciais de produção de verdade (mais provável, dado que havia deploy em produção), ou parte do que foi lido como "notificação real" em julho eram, sem perceber, os mesmos pings de teste do painel que confundimos aqui no início desta sessão. Não há como resolver essa dúvida retroativamente — registrar como possibilidade, não como fato.

**Critério de aceite:** ~~uma notificação real do Mercado Pago passa na validação de assinatura~~ → revisado acima. Registrar o manifesto vencedor em `docs/spike-mp-log.md`. ✅ feito.

> ⛔ **CHECKPOINT M1 — APROVADO em 2026-08-10.** M1.1 e M1.2 fechadas com dados reais; M1.3 fechada com critério revisado e justificado pela documentação oficial. Nenhum blocker de código sobrevive — o blocker A não se confirmou como impeditivo (payer ≠ collector funcionou de primeira) e o blocker B de julho não tem mais causa conhecida nem hipótese pendente de teste em sandbox. A Fase M2 pode começar.

---

## 6. Fase M2 — Recuperar o backend do histórico

Só começa com o **CHECKPOINT M1 aprovado**.

### Tarefa M2.1 — Restaurar os arquivos

```bash
git checkout 3db7a4f -- api/_lib/mercadopagoConfig.ts
git checkout 3db7a4f -- api/_lib/supabaseAdmin.ts
git checkout 3db7a4f -- api/create-subscription.ts
git checkout 3db7a4f -- api/cancel-subscription.ts
git checkout 3db7a4f -- api/mercadopago-webhook.ts
git checkout 3db7a4f -- src/utils/subscription.ts
git checkout 3db7a4f -- src/__tests__/apiCreateSubscription.test.ts
git checkout 3db7a4f -- src/__tests__/apiCancelSubscription.test.ts
git checkout 3db7a4f -- src/__tests__/apiMercadopagoWebhook.test.ts
git checkout 3db7a4f -- src/__tests__/apiLib.test.ts
git checkout 3db7a4f -- src/__tests__/subscription.test.ts
```

> 🔄 **Corrigido em 2026-08-08.** A última linha faltava. São **8** arquivos de teste em `3db7a4f`, não 7 — o texto do §1 contava errado, e `src/__tests__/subscription.test.ts` não aparecia nem aqui nem na M3.1. `src/utils/subscription.ts` voltaria sem cobertura nenhuma.

**Não recuperar** `scripts/create-preapproval-plan.mjs` (§3, item 1).

Restaurar as dependências: `mercadopago@^3.2.0` em `dependencies`, `@vercel/node@^5.8.26` em `devDependencies`.

Deletar `scripts/spike-mp/` — o conhecimento dele já está em `docs/spike-mp-log.md`.

### Tarefa M2.2 — Aplicar as correções do spike

> 🔄 **Premissa revisada em 2026-08-10.** O texto original presumia que o código de `3db7a4f` estava errado em dois pontos (manifesto do webhook, payload do `create-subscription`) e que restaurar sem corrigir reintroduziria os blockers. **A M1 provou o contrário nos dois pontos:**
>
> - **Manifesto do webhook:** `api/mercadopago-webhook.ts` em `3db7a4f` já usa `WebhookSignatureValidator.validate()` do SDK, passando `dataId` só da query — exatamente o comportamento que a M1.3 confirmou correto (3 validações bem-sucedidas contra notificações reais de teste do painel). **Nada a corrigir aqui.**
> - **Payload do `create-subscription`:** o corpo que `3db7a4f` monta (sem `preapproval_plan_id`, `auto_recurring` inline, `status: 'pending'`) é **o mesmo** que a M1.1 usou com sucesso, palavra por palavra. **Nada a corrigir aqui também.**
>
> A única ação real desta tarefa é a de logging (abaixo) — segurança, não correção de bug.

Trocar os `console.error` de diagnóstico (`3db7a4f` logava `xSignatureValue` e `secretLength`) por logging que não vaze material sensível.

### Tarefa M2.3 — Variáveis de ambiente

Necessárias no Vercel (Production **e** Preview) e no `.env.local`:

| Variável | Situação |
|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | ⚠️ presente no `.env.local`, mas **morto** — pertence à aplicação excluída. Substituir pelo da aplicação nova (M0) |
| `MERCADOPAGO_WEBHOOK_SECRET` | ⚠️ idem — **morto**. Substituir pelo da aplicação nova, do ambiente escolhido na M0 |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ **falta** — `supabaseAdmin.ts` precisa |
| `VITE_SUPABASE_URL` | ✅ presente e válida |

Atualizar `.env.example` com as três novas chaves (sem valores).

> 🔐 **A rotação do Mercado Pago já aconteceu de graça.** Excluir a aplicação antiga invalidou o token e o segredo que estavam em claro no `.env.local` dentro do OneDrive desde julho. Ainda assim, **apague as strings mortas** em vez de deixá-las lá — credencial morta no arquivo é ruído que se confunde com credencial viva na próxima leitura.
>
> `SUPABASE_SERVICE_ROLE_KEY` **não** foi rotacionada e é a mais perigosa das três: dá acesso total ao banco ignorando RLS. Nunca deve entrar em `VITE_*`, nunca deve aparecer no bundle do cliente. Verificar explicitamente após o build:
>
> ```bash
> grep -r "service_role" dist/    # deve retornar vazio
> ```

**Critério de aceite:** `npm run check` limpo; os 4 testes de API verdes; deploy de preview no Vercel com as 3 functions respondendo.

> ✅ **M2.1, M2.2 e M2.3 concluídas em 2026-08-10** (commit `e8ed18a`, branch `feat/mercadopago-billing-m2`). `npm run check` limpo, `npm run build` passa, **29 arquivos de teste / 112 testes** verdes (os 4 restaurados de `apiCreateSubscription`/`apiCancelSubscription`/`apiMercadopagoWebhook`/`apiLib`, mais `subscription.test.ts`, todos sem precisar de nenhum ajuste). Verificação de `grep -r "service_role" dist/` feita e investigada — o único hit era comentário JSDoc do próprio `@supabase/supabase-js`, não segredo nosso; confirmado com o valor completo da chave que nada vaza.
>
> **Falta só o deploy de preview com as 3 functions respondendo de verdade** — a parte do critério de aceite que exige testar contra infraestrutura real, não só localmente. Pendente de decisão do humano sobre quando fazer esse deploy.
>
> **Achado de segurança durante a M2.3, corrigido antes de qualquer commit:** um `.env.local.vercel` não rastreado (de um `vercel env pull` sugerido nesta sessão) continha todos os segredos reais em texto puro, incluindo um `VERCEL_OIDC_TOKEN` ativo — e o padrão `*.local` do `.gitignore` não cobria esse nome (só cobre arquivos que *terminam* em `.local`). Arquivo deletado, `.gitignore` corrigido para `.env.*` com exceção explícita para `.env.example`, fechando essa lacuna para qualquer nome futuro nesse padrão.

> ⛔ **CHECKPOINT M2**

---

## 7. Fase M3 — Reancorar a UI no app atual

**Por quê:** as páginas do histórico foram escritas em 18/07. Desde então vieram o refactor de programas (`day_number` → `program_id`/`weekday`), o onboarding, o `RequireOnboarding`, o dark mode e a pasta `src/components/ui/`. Restaurar as telas como estão produziria páginas fora do padrão visual e com rotas quebradas.

### Tarefa M3.1 — Restaurar como referência, não como produto final

```bash
git checkout 3db7a4f -- src/pages/Subscribe.tsx
git checkout 3db7a4f -- src/pages/MySubscription.tsx
git checkout 3db7a4f -- src/components/RequireSubscription.tsx
git checkout 3db7a4f -- src/__tests__/Subscribe.test.tsx
git checkout 3db7a4f -- src/__tests__/MySubscription.test.tsx
git checkout 3db7a4f -- src/__tests__/RequireSubscription.test.tsx
```

Tratar como rascunho. A lógica se aproveita; o markup precisa ser refeito.

### Tarefa M3.2 — Adaptar ao padrão atual

- usar `Card`, `Button`, `Modal`, `PageHeader` de `src/components/ui/` em vez de markup solto
- aplicar dark mode (`bg-surface`, `text-text`, `text-text-muted`, `border-border`) — o padrão que as Fases de dark mode estabeleceram
- **nada de `alert()`** — usar o componente de toast da Tarefa 5.2 do plano de correções
- `Subscribe.tsx` precisa tratar o retorno do `back_url`: a usuária volta do MP e a assinatura ainda está `pending` porque o webhook pode não ter chegado. Mostrar estado de "processando" com repoll, não um erro

### Tarefa M3.3 — Compor os guards na ordem certa

Em `App.tsx`, o encadeamento correto é:

```tsx
<RequireOnboarding><RequireSubscription><WorkoutDay /></RequireSubscription></RequireOnboarding>
```

Onboarding **antes** de assinatura: fazer a usuária pagar antes de dizer o próprio nome é fricção sem motivo.

Rotas a proteger: `/home`, `/hiit`, `/program/:slug`, `/program/:slug/day/:weekday`.
Rotas a **não** proteger: `/subscribe`, `/minha-assinatura`, `/profile`, e todas as de auth — senão a usuária sem assinatura fica presa sem conseguir nem assinar nem sair.

`RequireAdmin` deve **contornar** a checagem de assinatura. Admin não assina.

### Tarefa M3.4 — Ponto de entrada no Perfil

Restaurar o link "Minha assinatura" no `Profile.tsx` (commit `a3f64d4`), adaptado ao layout atual de cards.

**Critério de aceite:** `npm test` verde; fluxo manual completo em preview — cadastro → onboarding → bloqueio → `/subscribe` → MP → retorno → acesso liberado.

> ⛔ **CHECKPOINT M3**

---

## 8. Fase M4 — O gate no banco

Esta fase **substitui a Tarefa 6.1** do plano de correções.

### Tarefa M4.1 — Migration de reativação

Nova migration derivada da `20260718090000_subscriptions.sql`, que **continua no repositório** e serve de base. Recriar:

- tabela `subscriptions` (`user_id` único, `preapproval_id`, `status`, `next_payment_date`, `raw`, timestamps)
- policy de SELECT: dona vê a própria, admin vê todas
- **nenhuma** policy de INSERT/UPDATE/DELETE — só o `service_role` escreve, de dentro das functions
- função `has_active_subscription()` como `SECURITY DEFINER STABLE`

A migration de julho já acerta a forma (`SECURITY DEFINER`, `SET search_path = public`, `STABLE`, `DROP` antes de `CREATE`). Reaproveitar essa estrutura.

Ajustar os valores de `status` ao que a Tarefa M1.2 observou **de verdade**, não ao que a documentação promete.

> 🔄 **Acrescentado em 2026-08-08 — assinatura que expira.**
>
> A versão de julho define acesso como `status = 'authorized'`, sem nenhuma noção de validade. Isso tem uma falha silenciosa: **se um webhook se perder, a linha fica `authorized` para sempre.** A pessoa cancela no Mercado Pago, a notificação não chega (ou chega e a function estava fora do ar), e o acesso continua liberado indefinidamente. Não é buraco de segurança, é vazamento de receita — e invisível, porque ninguém reclama de acesso que continua funcionando.
>
> Duas defesas, escolher pelo menos uma:
>
> 1. **Checar validade na própria função** — além de `status`, exigir que `next_payment_date` não esteja muito no passado (uma folga de alguns dias cobre atraso de cobrança legítimo):
>
>    ```sql
>    SELECT EXISTS (
>      SELECT 1 FROM public.subscriptions
>      WHERE user_id = auth.uid()
>        AND status = 'authorized'
>        AND (next_payment_date IS NULL OR next_payment_date > NOW() - INTERVAL '3 days')
>    );
>    ```
>
>    Simples, sem infraestrutura nova. Risco: se o MP não preencher `next_payment_date` de forma confiável, trava quem está em dia. **Confirmar com o dado real coletado na M1.2 antes de adotar.**
>
> 2. **Reconciliação periódica** — job que relê no MP as assinaturas `authorized` cuja `next_payment_date` já passou, e corrige o status. Mais robusto, mais trabalho.
>
> A decisão depende do que a M1.2 observar. **Não escolher antes de ter o dado.**

### Tarefa M4.2 — Fechar as policies abertas

> ⚠️ **A armadilha já documentada na migration original:** uma policy `USING (true)` deixada no lugar **combina por OR** com qualquer policy nova e a anula por completo. A antiga precisa ser **derrubada e substituída**, nunca complementada.

O diagnóstico de 2026-08-05 identificou `USING (true)` em **três** tabelas — `workouts`, `programs` e `pdf_plans`. A migration original de julho só tratava `workouts`, porque as outras duas nem existiam ainda. **Todas as três precisam entrar.**

Para cada uma: `DROP POLICY` da aberta, `CREATE POLICY` nova com `has_active_subscription() OR is_admin()`.

`programs` merece uma decisão à parte: se a Home precisa listar os programas para quem ainda não assinou (como vitrine), ela fica aberta e o bloqueio acontece em `workouts`. Recomendação: **manter `programs` legível** — nome de programa não é o produto; o treino é.

> 🔄 **Decisão explicitada em 2026-08-08 — `user_progress` fica de fora.**
>
> A migration de julho **também** gatava `user_progress`, exigindo assinatura ativa para a usuária ver o próprio progresso. Este plano não mencionava a tabela, o que na prática abandonava aquele comportamento sem discutir.
>
> **Manter fora do gate, deliberadamente.** O histórico de treinos é dado *da usuária*, não conteúdo do produto. Tirá-lo de quem parou de pagar é punitivo, não protege receita nenhuma (não é o que ela compraria de volta) e cria um problema concreto: quem reassina depois espera reencontrar o próprio histórico, não uma tela zerada.
>
> Efeito colateral a conhecer: a página de Perfil continua mostrando "Treinos Concluídos" para quem não assina. É intencional — a M3.3 já mantém `/profile` fora das rotas protegidas pelo mesmo motivo.

### Tarefa M4.3 — O buraco do Storage

`src/utils/plans.ts` gera signed URL para os PDFs de plano alimentar direto do Storage. **A RLS das tabelas não cobre bucket de Storage.** Sem tratar isso, o conteúdo pago escapa por aí e o gate inteiro vira teatro.

> ✅ **Inventário feito em 2026-08-08 (MCP read-only) — e a notícia é boa.**
>
> ```
> bucket:  plans   (public = false)
> policy:  authenticated_read_plans | SELECT | authenticated | (bucket_id = 'plans')
> ```
>
> Só existe **uma** policy, e ela é RLS comum sobre `storage.objects` — portanto **pode** chamar `public.has_active_subscription()`. A Vercel Function que o texto original previa como possível necessidade **não é necessária**; fica como plano B se algo inesperado aparecer.
>
> Confirmado em [`src/utils/plans.ts:47-49`](../src/utils/plans.ts#L47-L49) que a signed URL é criada **no cliente, com o JWT da usuária** (`supabase.storage.from(...).createSignedUrl(...)`). Ou seja, a RLS é avaliada **no momento da criação da URL** — que é exatamente o ponto de controle certo.
>
> Migration:
>
> ```sql
> DROP POLICY IF EXISTS "authenticated_read_plans" ON storage.objects;
> CREATE POLICY "subscribers_read_plans" ON storage.objects
>   FOR SELECT TO authenticated
>   USING (
>     bucket_id = 'plans'
>     AND (public.has_active_subscription() OR public.is_admin())
>   );
> ```
>
> **Limite conhecido, e aceitável:** uma signed URL já emitida continua válida até expirar, mesmo se a assinatura for cancelada no meio — a RLS não é reavaliada a cada download. Hoje o `expiresInSeconds` usado pela Home é 900 (15 min). Janela pequena o bastante para não valer complexidade extra.
>
> **Atenção ao efeito colateral em `pdf_plans`:** o mesmo arquivo, nas linhas 57-60, faz `UPDATE` em `pdf_plans` a partir do cliente quando a chave do arquivo não bate. Com `pdf_plans` gateada na M4.2, esse caminho de fallback muda de comportamento para quem não assina. Verificar se ele ainda é alcançável — possivelmente é código morto e deve ir para `docs/ACHADOS-EXTRAS.md`.

### Tarefa M4.4 — Não ativar ainda

Entregar as migrations como arquivo, **sem aplicar**. A ativação é a Fase M5, e tem ordem própria.

> ⛔ **CHECKPOINT M4**

---

## 9. Fase M5 — Ativação em produção

Ordem importa. Ativar o gate antes do fluxo de pagamento funcionar tranca todo mundo do lado de fora.

1. **Deploy do código** com o gate ainda inativo (policies abertas). Functions no ar, `/subscribe` acessível.
2. **Teste real de ponta a ponta em produção**, com a **conta pagadora** definida na M0 e cartão real. R$ 59,90 é o custo de saber que funciona. Verificar: `init_point` abre → autorização → webhook chega → linha em `subscriptions` com `status = 'authorized'` → acesso liberado.

   > 🔄 **Corrigido em 2026-08-08 — contradição interna.** O texto original mandava testar "com a sua própria conta". Isso **contradiz a hipótese principal do blocker A** (§4): se o Mercado Pago recusa assinatura em que pagador = vendedor, esse teste falha exatamente pelo motivo que se está tentando validar, e você conclui que o código está quebrado quando não está.
   >
   > Usar a segunda identidade — conta no Musa Fit com e-mail **diferente** do e-mail vendedor do MP. Se a hipótese A cair na M1.1 (ou seja, o MP aceitar pagador = vendedor), esta restrição pode ser relaxada; até lá, tratar como obrigatória.

3. **Testar o cancelamento** — `cancel-subscription` reflete no MP e no banco.
4. **Comunicar as usuárias** (Tarefa M6.1) — antes do corte, não depois.
5. **Só então aplicar as migrations do gate**, dentro de transação, fora de horário de pico.
6. **Verificação imediata:** uma conta sem assinatura não lê `workouts` nem baixa PDF; uma conta com assinatura lê tudo; admin lê tudo.

**Plano de rollback:** manter pronto o SQL que restaura as policies `USING (true)` nas três tabelas. Se algo der errado no passo 5, o rollback é uma execução só e devolve o acesso a todo mundo em segundos. Testar esse SQL **antes** de precisar dele.

> ⛔ **CHECKPOINT M5**

---

## 10. Fase M6 — Operação

### Tarefa M6.1 — Comunicar as usuárias atuais (**faça antes do passo 5 da M5**)

Você optou por **não** dar grandfathering: as ~20 usuárias que usam o app hoje perdem acesso ao conteúdo quando o gate ligar.

Isso é uma decisão legítima, mas o modo de execução importa: cortar sem aviso é a forma mais rápida de perder a base inteira e ganhar reclamação pública. O mínimo é um e-mail com alguns dias de antecedência explicando a mudança, o preço e a data. Considere um cupom ou primeiro mês com desconto para quem já estava — é barato e preserva as pessoas que testaram o produto antes de ele ser produto.

> 💡 **Alternativa de baixo custo, se mudar de ideia:** uma coluna `is_legacy BOOLEAN DEFAULT false` em `profiles`, marcada nas contas criadas antes da data de corte, e um `OR is_legacy` na policy. São duas linhas de SQL e preserva a boa vontade de quem já está lá. A porta continua aberta até a Fase M4 ser escrita.

### Tarefa M6.2 — Monitoramento

Webhook falhando é silencioso **nos dois sentidos**, e os dois custam dinheiro:

| Falha | Sintoma | Quem reclama |
|---|---|---|
| Notificação de autorização não chega | pagou e não tem acesso | a usuária, rápido |
| Notificação de cancelamento não chega | cancelou e continua com acesso | **ninguém** |

O segundo caso é o perigoso justamente porque não gera reclamação. Duas queries de verificação:

```sql
-- 1. pagou e não liberou (a usuária vai reclamar, mas melhor você ver antes)
SELECT user_id, preapproval_id, created_at
FROM public.subscriptions
WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 hour';

-- 2. acesso liberado com cobrança vencida (ninguém vai reclamar)
SELECT user_id, preapproval_id, next_payment_date
FROM public.subscriptions
WHERE status = 'authorized'
  AND next_payment_date IS NOT NULL
  AND next_payment_date < NOW() - INTERVAL '3 days';
```

A query 2 é a contrapartida operacional da defesa escolhida na M4.1 — se a opção 1 de lá for adotada (checagem de validade dentro de `has_active_subscription()`), esta query mostra quem *já está* sendo bloqueado pela folga e merece um e-mail antes de descobrir sozinho.

- garantir que os logs das functions no Vercel estejam acessíveis e que erro de webhook seja distinguível de ruído

### Tarefa M6.3 — Nota fiscal (decisão sua, não do agente)

Como CPF, você não emite nota fiscal de serviço com facilidade. Cobrança recorrente sem nota é risco fiscal que cresce com o volume. Não bloqueia o lançamento; precisa de decisão antes de escalar. Registrar em `docs/ACHADOS-EXTRAS.md`, sem ação de código.

---

## 11. Fora de escopo

- **Pix Automático** — taxa muito menor (~0,22–0,35% vs 4,99%) e alcança quem não tem cartão, mas exige contratação junto à instituição financeira e é orientado a PJ. Reavaliar com CNPJ.
- **Planos anual / múltiplos preços** — a decisão travada é preço único mensal.
- **Trial gratuito** — descartado nesta rodada.
- **Cupons e descontos** — não existe suporte no código recuperado.

---

## 12. Riscos, honestamente

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Blocker A não se resolver | **média** — matou a tentativa anterior | Fase M1.1 isolada; se falhar, para antes de gastar as fases M2–M5 |
| Blocker B não se resolver | **alta** — matou a tentativa anterior, e a causa suposta (Registro de revisão 1) foi **derrubada** em 2026-08-08. Investigação volta à estaca zero, sem hipótese forte | Fase M1.3 isolada, com o SDK como fonte de verdade em vez de reescrever o manifesto manualmente; se falhar, reavaliar o gateway de verdade — não é mais "só corrigir uma linha" |
| Perda das usuárias atuais no corte | **alta** | M6.1; reconsiderar `is_legacy` |
| Webhook de cancelamento se perde → acesso vitalício grátis | média, e **invisível** | M4.1 (validade em `has_active_subscription()`) + query 2 da M6.2 |
| Webhook de autorização se perde → pagou sem acesso | média | query 1 da M6.2 |
| Credenciais expostas desde julho | **certa** — mas já resolvida | a aplicação foi excluída; token e segredo antigos morreram junto. Falta só limpar as strings mortas do `.env.local` (M2.3) |
| `SUPABASE_SERVICE_ROLE_KEY` vazar para o bundle | baixa, impacto **total** | nunca em `VITE_*`; `grep -r "service_role" dist/` após o build (M2.3) |
| Testar em produção com a conta errada e concluir errado | **alta se não planejado** | segunda identidade definida na M0; M5 passo 2 |
| Exposição fiscal como CPF | baixa agora, cresce com volume | M6.3 |

---

## 13. Ordem resumida

```
M0  Criar aplicação MP nova + 2 identidades   ← humano, ~20 min
M1  Spike isolado (blockers A e B)            ← DECIDE O PROJETO
      ├── M1.1 criar preapproval  (payer_email ≠ vendedor: testar PRIMEIRO)
      ├── M1.2 chegar a authorized (coletar formato real de status/datas)
      └── M1.3 validar assinatura webhook (causa desconhecida — hipótese antiga derrubada, ver spike-mp-log.md)
M2  Recuperar backend do histórico + corrigir
M3  Reancorar UI no app atual
M4  Migrations do gate (sem aplicar)
M5  Ativação em produção (ordem rígida + rollback)
M6  Operação
```

**Dependências entre fases que não são óbvias:**

- **M1.2 → M4.1.** A escolha de como detectar assinatura expirada depende do formato real de `next_payment_date`. Não decidir antes de ter o dado.
- **M0 → M5.** A segunda identidade não é só para o spike; sem ela o teste de produção é impossível.
- **M1.1 → M5 passo 2.** Se a hipótese A cair (o MP aceitar pagador = vendedor), a restrição de identidade pode ser relaxada.

**A fase que importa é a M1.** M2 a M6 são trabalho conhecido, de risco baixo — o código já existe e o caminho está mapeado. Se a M1 não fechar em algumas horas de tentativa, o problema não é código: é conta, credencial ou produto do Mercado Pago, e aí a conversa muda para outro gateway.

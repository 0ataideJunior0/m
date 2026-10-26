# Checkout "pagar primeiro" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compradora vinda da landing paga só com o e-mail (Pix ou cartão avulso), recebe link de acesso, cria a senha e entra; tudo medido num funil no painel admin.

**Architecture:** Uma `purchase_intents` guarda e-mail/plano/UTMs/marcas de tempo; o id dela vai no `external_reference` como `intent|<uuid>`. O webhook, ao aprovar, acha/cria a conta, credita o período pela mesma regra do Pix (extraída para uma função comum) e, se o e-mail ainda não foi provado, dispara o e-mail de acesso pelo **Magic Link do Supabase** (que já sai pelo Resend). "E-mail provado" mora numa tabela só do servidor (`email_verifications`), gravada quando a sessão nasce de um link do e-mail (`amr` = `otp`/`recovery` no JWT). Cartão vira **preferência do Checkout Pro** (pagamento avulso, parcelável), tanto no checkout novo quanto na tela de assinatura logada.

**Tech Stack:** React + TypeScript + Vite + Tailwind (tokens Musafit), Vercel functions em `api/`, Supabase (Postgres/RLS/Auth), SDK `mercadopago` (`Payment`, `Preference`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-26-checkout-pagar-primeiro-design.md`

## Global Constraints

- Preço **sempre** do servidor (`api/_lib/pixPlans.ts`: mensal 49,90 · trimestral 129,90 · semestral 233,40 · anual 358,80). Cartão usa os **mesmos planos e preços** do Pix.
- Plano `teste` (R$ 0,01) no checkout aberto **só** para e-mails da variável `CHECKOUT_TEST_EMAILS` (lista separada por vírgula); logado continua só admin.
- Conta **só** é criada com pagamento aprovado. Nunca criar conta nem mandar e-mail na hora de digitar o e-mail.
- Conta existente **com e-mail provado** → só credita, **sem e-mail nosso**. Sem e-mail provado → credita **e** manda o link de acesso.
- Senha **obrigatória** no primeiro acesso; a tela não tem "pular".
- E-mail de acesso = template **Magic Link** do Supabase (estilo dos atuais, português). `emailRedirectTo` = `<origin>/primeiro-acesso`.
- Parcelamento no cartão: **até 12x**, juros padrão do MP (pagos por quem compra).
- Quem tem **assinatura recorrente ativa** (`source='preapproval'`, `status='authorized'`) não compra de novo: HTTP 409 com "Você já tem uma assinatura ativa. Entre na sua conta."
- Assinaturas recorrentes já existentes continuam funcionando (webhook de preapproval intacto).
- Nada de login com Google. Tudo tem que funcionar no navegador do Instagram.
- Textos em português do Brasil. Respostas de rotas públicas **não revelam** se um e-mail tem conta (exceto o 409 da assinatura recorrente, que o spec pede).
- Migração no banco de **produção** só com autorização explícita do usuário, inspecionando antes (histórico local não é confiável). Ordem de produção: migração → variáveis de ambiente → deploy do código → **só então** desligar "Confirm email" no Supabase.

## Review Focus

- E-mail digitado com maiúsculas/espaços (`  Ana@Gmail.com `) e depois comprado de novo em minúsculas: tem que cair na **mesma** conta, não criar outra. Teste na Task 2 (`normalizeEmail`) e Task 4 (busca por e-mail normalizado).
- Webhook reentregue (mesmo `payment_id`) ou chegando como IPN antigo: não pode creditar duas vezes nem mandar dois e-mails. Teste na Task 4.
- Pagamento aprovado cujo intent já tem `user_id` (reentrega após criar a conta): não tenta criar conta de novo. Teste na Task 4.
- Pessoa abre o link do e-mail em outro navegador/celular (fora do Instagram), sem nada no `localStorage`: `/primeiro-acesso` funciona só com a sessão do link. Teste na Task 8.
- Impostor com conta criada no cadastro direto (sem confirmação) tenta se marcar como "provado" pelo cliente: impossível — `email_verifications` não aceita escrita do cliente e `claim-access` exige `amr` de link. Teste na Task 5.

---

### Task 1: Banco — intenção de compra, e-mail provado, UTM do cadastro

**Files:**
- Create: `supabase/migrations/20261026120000_pay_first_checkout.sql`
- Modify: `src/types/index.ts` (`SubscriptionSource` ganha `'card'`; tipos `PurchaseIntent`, `FunnelUtm`)

**Interfaces:**
- Produces (SQL):
  - `public.purchase_intents`: `id uuid pk default gen_random_uuid()`, `email text not null` (já normalizado), `plan_id text not null`, `method text not null check (method in ('pix','card'))`, `months int not null`, `amount numeric(10,2) not null`, `utm_source/utm_medium/utm_campaign/utm_content/utm_term text null`, `referrer text null`, `status text not null default 'pending' check (status in ('pending','paid','rejected'))`, `last_payment_status text null`, `payment_id text unique null`, `user_id uuid null references auth.users on delete set null`, `created_at timestamptz not null default now()`, `paid_at`, `access_email_sent_at`, `link_opened_at`, `password_set_at` (timestamptz null). Índices em `(email, created_at desc)` e `(created_at)`. RLS on; **só SELECT para `is_admin()`**; nenhum GRANT de escrita para `authenticated`/`anon` (só service role escreve).
  - `public.email_verifications`: `user_id uuid pk references auth.users on delete cascade`, `verified_at timestamptz not null default now()`, `method text not null` (`'legacy'|'link'`). RLS on; SELECT `user_id = (select auth.uid()) OR is_admin()`; sem escrita do cliente. **Backfill:** `insert ... select id, coalesce(email_confirmed_at, now()), 'legacy' from auth.users where email_confirmed_at is not null`.
  - `public.profiles.signup_utm jsonb null` (a própria usuária grava pela policy de update que já existe).
  - CHECK de `subscriptions.source`, se existir no banco real, passa a aceitar `'card'` (inspecionar antes).
- Produces (TS): `SubscriptionSource = 'preapproval' | 'pix' | 'manual' | 'card'`.

- [ ] **Step 1:** Inspecionar via MCP (somente leitura): colunas e constraints de `subscriptions`, existência de nomes iguais, contagem de `auth.users` com `email_confirmed_at`.
- [ ] **Step 2:** Escrever a migração e o tipo. `npm run check` → sem erros.
- [ ] **Step 3: Parar e pedir autorização ao usuário** para aplicar. Aplicar via `mcp__supabase__apply_migration`; verificar com SQL (tabelas, `relrowsecurity`, policies, contagem do backfill = contagem do Step 1) e `get_advisors` sem aviso novo.
- [ ] **Step 4: Commit** `Checkout: tabelas de intencao de compra e e-mail provado`

### Task 2: Regras puras do checkout (servidor)

**Files:**
- Create: `api/_lib/checkoutRules.ts`
- Modify: `api/_lib/pixPeriod.ts` (referência do cartão logado), `api/_lib/prepaid.ts` (`'card'` em `PREPAID_SOURCES`)
- Test: `src/__tests__/checkoutRules.test.ts`, `src/__tests__/pixPeriod.test.ts`, `src/__tests__/prepaid.test.ts`

**Interfaces:**
- Produces:
  - `normalizeEmail(raw: unknown): string | null` — trim + minúsculas; `null` se não casar `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
  - `buildIntentReference(intentId: string): string` → `intent|<id>`; `parseIntentReference(ref: unknown): string | null`.
  - `resolveCheckoutPlan(planId: unknown, email: string, testEmails: string[]): { plan: PixPlan } | { error: 'invalid_plan' | 'unavailable' }` — `teste` só se `email ∈ testEmails`.
  - `parseTestEmails(env: string | undefined): string[]` (normalizados, vazios descartados).
  - `buildPrepaidExternalReference(userId: string, months: number, method: 'pix' | 'card'): string` (`<uid>|pix|<m>` ou `<uid>|card|<m>`); `parsePixExternalReference` passa a devolver `{ userId, months, method }` e aceita os dois marcadores. `buildPixExternalReference` vira alias de `method='pix'` (não quebra chamadas existentes).
  - `MAX_INTENTS_PER_EMAIL_PER_HOUR = 5`.

- [ ] **Step 1: Testes que falham**
  ```ts
  expect(normalizeEmail('  Ana@Gmail.COM ')).toBe('ana@gmail.com')
  expect(normalizeEmail('ana@')).toBeNull()
  expect(parseIntentReference(buildIntentReference('abc'))).toBe('abc')
  expect(parseIntentReference('u1|pix|3')).toBeNull()
  expect(resolveCheckoutPlan('teste', 'x@y.com', [])).toEqual({ error: 'unavailable' })
  expect(resolveCheckoutPlan('teste', 'qa@musa.com', ['qa@musa.com'])).toHaveProperty('plan.amount', 0.01)
  expect(resolveCheckoutPlan('trimestral', 'x@y.com', [])).toHaveProperty('plan.months', 3)
  expect(parseTestEmails(' QA@Musa.com, ,b@c.com')).toEqual(['qa@musa.com', 'b@c.com'])
  expect(parsePixExternalReference('u1|card|6')).toEqual({ userId: 'u1', months: 6, method: 'card' })
  expect(parsePixExternalReference('u1|pix|1')).toEqual({ userId: 'u1', months: 1, method: 'pix' })
  expect(isPrepaidSource('card')).toBe(true)
  ```
- [ ] **Step 2:** `npx vitest run src/__tests__/checkoutRules.test.ts src/__tests__/pixPeriod.test.ts src/__tests__/prepaid.test.ts` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** mesmo comando → PASS (os testes antigos de `pixPeriod` continuam passando).
- [ ] **Step 5: Commit** `Checkout: regras puras de e-mail, plano e referencias`

### Task 3: Criação de cobrança (aberta e logada)

**Files:**
- Create: `api/_lib/charges.ts`, `api/checkout.ts`, `api/checkout-status.ts`, `api/create-card-payment.ts`
- Modify: `api/create-pix-payment.ts` (passa a usar `createPixCharge`)
- Test: `src/__tests__/apiCheckout.test.ts`, `src/__tests__/apiCheckoutStatus.test.ts`, `src/__tests__/apiCreateCardPayment.test.ts` (padrão de mocks de `apiCreateSubscription.test.ts`)

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `createPixCharge(o: { amount: number; months: number; email: string; externalReference: string; notificationUrl: string }): Promise<{ payment_id: string; qr_code: string; qr_code_base64?: string; ticket_url?: string }>`
  - `createCardCheckout(o: { amount: number; months: number; email: string; externalReference: string; notificationUrl: string; backUrl: string }): Promise<{ init_point: string }>` — `Preference.create` com 1 item (`title: "MusaFit - Acesso por N meses"`), `payer.email`, `payment_methods: { installments: 12, excluded_payment_types: [{ id: 'ticket' }] }`, `back_urls` success/pending/failure = `backUrl`, `auto_return: 'approved'`, `external_reference`, `notification_url`.
  - `POST /api/checkout` body `{ email, plan, method: 'pix'|'card', utm?: {source,medium,campaign,content,term}, referrer? }` → 200 `{ intentId, method:'pix', pix: {...} }` ou `{ intentId, method:'card', init_point }`; 400 e-mail/plano inválido; 403 plano indisponível; 409 assinatura recorrente ativa; 429 `"Muitas tentativas. Aguarde alguns minutos."` se `>= 5` intents do e-mail na última hora. Insere o intent **antes** de criar a cobrança; `backUrl` = `<origin>/comprar/retorno?intent=<id>`.
  - `GET /api/checkout-status?intent=<uuid>` → `{ status: 'pending'|'paid'|'rejected', lastPaymentStatus: string|null }`; 400 se não for uuid; 404 se não existir. Não devolve e-mail.
  - `POST /api/create-card-payment` (Bearer) body `{ plan }` → `{ init_point }`, referência `buildPrepaidExternalReference(user.id, months, 'card')`, `backUrl` `<origin>/subscribe`; mesmas regras de admin-only e 409 do Pix logado.

- [ ] **Step 1: Testes que falham** — checkout: e-mail inválido → 400; `teste` sem allowlist → 403; e-mail com preapproval authorized → 409 e **nenhum** intent inserido; 5 intents na última hora → 429; Pix feliz → intent inserido com `email` normalizado, UTMs e `amount` 129.9, `external_reference` = `intent|<id>`; cartão feliz → `Preference.create` com `installments: 12` e `back_urls.success` terminando em `/comprar/retorno?intent=<id>`. Status: uuid inválido → 400; devolve `{status:'paid', lastPaymentStatus:'approved'}` sem campo `email`. create-card-payment: sem token → 401; referência `u1|card|6`.
- [ ] **Step 2:** rodar os três → FAIL.
- [ ] **Step 3:** Implementar; `create-pix-payment.ts` passa a chamar `createPixCharge` (o teste dele continua passando).
- [ ] **Step 4:** `npx vitest run src/__tests__/apiCheckout.test.ts src/__tests__/apiCheckoutStatus.test.ts src/__tests__/apiCreateCardPayment.test.ts src/__tests__/apiCreatePixPayment.test.ts` → PASS.
- [ ] **Step 5: Commit** `Checkout: rotas de cobranca aberta, status e cartao avulso logado`

### Task 4: Webhook — intenção paga, cartão avulso, conta e e-mail de acesso

**Files:**
- Create: `api/_lib/prepaidCredit.ts`, `api/_lib/accessEmail.ts`
- Modify: `api/mercadopago-webhook.ts` (`handlePixPayment` vira `handlePayment`)
- Test: `src/__tests__/apiMercadopagoWebhook.test.ts`, `src/__tests__/prepaidCredit.test.ts`

**Interfaces:**
- Consumes: Task 2 (`parseIntentReference`, `parsePixExternalReference` com `method`), Task 1 tabelas.
- Produces:
  - `creditPrepaidPeriod(admin, o: { userId: string; months: number; paymentId: string; amount: number; source: 'pix'|'card'; raw: unknown }): Promise<'credited' | 'duplicate'>` — **exatamente** a lógica atual do Pix (ledger em `pix_payments` com UNIQUE, soma sobre prepaid vigente, caso anômalo de preapproval ativa), só que com `source` parametrizado.
  - `sendAccessEmail(admin, email: string, origin: string): Promise<void>` — `admin.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: \`${origin}/primeiro-acesso\` } })`; lança no erro.
  - Fluxo para `intent|<id>` aprovado: (1) `creditPrepaidPeriod`; se `'duplicate'` → 200 sem mais nada; (2) usuária = `intent.user_id` ou `profiles` por `email` normalizado ou `auth.admin.createUser({ email, email_confirm: true })`; (3) intent `status='paid'`, `paid_at`, `payment_id`, `user_id`, `last_payment_status`; (4) se **não** há linha em `email_verifications` → `sendAccessEmail` + `access_email_sent_at`. Pagamento não aprovado com `intent|` → só atualiza `last_payment_status` (e `status='rejected'` em `rejected`/`cancelled`).
  - Origem para o link: `process.env.PUBLIC_APP_URL` (ex. `https://musafit.me`), sem depender do host da notificação.

- [ ] **Step 1: Testes que falham**
  - `creditPrepaidPeriod`: os casos atuais do Pix migrados (soma sobre vigente, ledger duplicado → `'duplicate'`, `source:'card'` gravado).
  - Webhook intent novo: cria usuária com o e-mail normalizado, credita 3 meses, marca intent pago e chama `signInWithOtp` com `emailRedirectTo: 'https://musafit.me/primeiro-acesso'` e `shouldCreateUser: false`.
  - E-mail com conta **provada**: credita, **não** chama `createUser` nem `signInWithOtp`.
  - E-mail com conta **não provada**: credita e chama `signInWithOtp`.
  - Reentrega (ledger 23505): não chama `createUser` nem `signInWithOtp` de novo.
  - Intent com `user_id` já preenchido: usa esse id, não busca por e-mail.
  - `u1|card|1` aprovado (cartão logado): credita com `source:'card'`, sem e-mail.
  - `intent|x` com status `rejected`: intent `status='rejected'`, nada creditado.
  - Preapproval e Pix logado: testes atuais continuam verdes.
- [ ] **Step 2:** `npx vitest run src/__tests__/apiMercadopagoWebhook.test.ts src/__tests__/prepaidCredit.test.ts` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** mesmo comando → PASS.
- [ ] **Step 5: Commit** `Checkout: webhook cria conta, credita periodo e manda o link de acesso`

### Task 5: Primeiro acesso e reenvio (servidor)

**Files:**
- Create: `api/claim-access.ts`, `api/resend-access.ts`, `api/_lib/jwtAmr.ts`
- Test: `src/__tests__/apiClaimAccess.test.ts`, `src/__tests__/apiResendAccess.test.ts`, `src/__tests__/jwtAmr.test.ts`

**Interfaces:**
- Consumes: Task 1, Task 4 (`sendAccessEmail`).
- Produces:
  - `sessionCameFromEmailLink(accessToken: string): boolean` — decodifica o payload do JWT (já validado por `auth.getUser`) e devolve `true` se algum `amr[].method` ∈ `['otp','magiclink','recovery']`.
  - `POST /api/claim-access` (Bearer) body `{ step: 'link_opened' | 'password_set' }` → 200 `{ ok: true }`.
    - `link_opened`: exige `sessionCameFromEmailLink` (senão 403); upsert em `email_verifications` (`method:'link'`); carimba `link_opened_at` no intent pago mais recente da usuária, se vazio.
    - `password_set`: carimba `password_set_at` no intent pago mais recente, se vazio.
  - `POST /api/resend-access` body `{ email }` → **sempre** 200 `{ ok: true }`; só envia se existir intent `paid` com esse e-mail e `password_set_at` nulo; admin (Bearer de admin) pode reenviar para qualquer intent pago.
- [ ] **Step 1: Testes que falham** — `sessionCameFromEmailLink` com `amr:[{method:'password'}]` → false, `[{method:'otp'}]` → true; claim `link_opened` com sessão de senha → 403 e **nenhum** upsert; com sessão de link → upsert `email_verifications` + carimbo; `password_set` carimba; resend com e-mail sem compra → 200 e `signInWithOtp` **não** chamado; com compra paga sem senha → chamado.
- [ ] **Step 2:** rodar → FAIL. **Step 3:** implementar. **Step 4:** rodar → PASS.
- [ ] **Step 5: Commit** `Checkout: primeiro acesso marca e-mail provado e reenvio do link`

### Task 6: Utilitários do front (origem do tráfego, e-mail, cliente das rotas)

**Files:**
- Create: `src/utils/attribution.ts`, `src/utils/emailSuggest.ts`, `src/utils/checkout.ts`
- Modify: `src/main.tsx` (chama `captureAttribution()` no boot)
- Test: `src/__tests__/attribution.test.ts`, `src/__tests__/emailSuggest.test.ts`, `src/__tests__/checkoutClient.test.ts`

**Interfaces:**
- Produces:
  - `captureAttribution(search = location.search, referrer = document.referrer): void` — se a URL tiver algum `utm_*`, grava `{source,medium,campaign,content,term,referrer}` em `sessionStorage['musa_attribution']` (try/catch); sem UTM, não sobrescreve.
  - `getAttribution(): Attribution | null`.
  - `suggestEmail(email: string): string | null` — corrige domínios: `gmial.com, gmai.com, gmal.com, gmail.co, gmail.con, hotmial.com, hotmal.com, hotmail.co, outlok.com, yahoo.com.b, icloud.co` → o certo; `null` se nada a sugerir.
  - `startCheckout(input): Promise<{ data?: CheckoutResponse; error?: string }>`, `getCheckoutStatus(intentId)`, `resendAccess(email)`, `claimAccess(step)`, `createCardPayment(plan)` — mesmo estilo de `src/utils/pixPayment.ts` (erros de rede → "Não foi possível falar com o servidor. Tente de novo.").
- [ ] **Step 1: Testes que falham** — `suggestEmail('ana@gmial.com')` → `'ana@gmail.com'`; `suggestEmail('ana@gmail.com')` → `null`; `captureAttribution('?utm_source=instagram&utm_campaign=out')` grava; segunda chamada sem UTM mantém; `startCheckout` 409 devolve a mensagem do servidor; fetch rejeitado → mensagem de rede.
- [ ] **Step 2–4:** FAIL → implementar → PASS (`npx vitest run src/__tests__/attribution.test.ts src/__tests__/emailSuggest.test.ts src/__tests__/checkoutClient.test.ts`).
- [ ] **Step 5: Commit** `Checkout: origem do trafego, sugestao de e-mail e cliente das rotas`

### Task 7: Página de compra, retorno do cartão e aviso no login

**Files:**
- Create: `src/pages/Checkout.tsx` (`/comprar`), `src/pages/CheckoutReturn.tsx` (`/comprar/retorno`)
- Modify: `src/App.tsx` (rotas **públicas**, fora dos guards), `src/pages/Login.tsx` (aviso + "Reenviar link")
- Test: `src/__tests__/Checkout.test.tsx`, `src/__tests__/CheckoutReturn.test.tsx`, `src/__tests__/Login.test.tsx`

**Interfaces:**
- Consumes: Task 6.
- Comportamento:
  - `/comprar?plano=<id>`: plano no topo (valor, meses, "equivale a R$ X/mês" de `getPixPlansDisplay`), "Trocar plano" abre as 4 opções; plano inválido/ausente → mostra as 4 sem pré-seleção; `teste` nunca aparece na lista. Campo e-mail; abaixo, sempre visível quando válido: **"O acesso vai para {email}. Confira se está certo."**; se `suggestEmail` sugerir: botão **"Você quis dizer {sugestão}?"** que corrige o campo. Escolha **Pix** ou **Cartão (até 12x)**. Botão "Ir para o pagamento".
  - Pix: QR + "Copiar código Pix" (como `Subscribe.tsx`), polling de `getCheckoutStatus` a cada 4s; `paid` → `navigate('/login?pago=1&email=<email>')`.
  - Cartão: `window.location.href = init_point`.
  - `/comprar/retorno?intent=`: polling; `paid` → mesmo destino do Pix; `pending`/`in_process` → "Pagamento em análise. Avisaremos por e-mail assim que for aprovado."; `rejected` → "O pagamento não foi aprovado." + "Tentar de novo" (volta a `/comprar`).
  - `Login` com `?pago=1&email=`: caixa de destaque **"Pagamento recebido! Enviamos um link de acesso para {email}. Confira também a caixa de spam."** e botão **"Reenviar link"** (`resendAccess`; depois de enviar, desabilita por 60s com "Enviado. Aguarde 1 minuto para pedir de novo."). Campo e-mail pré-preenchido.
- [ ] **Step 1: Testes que falham** — Checkout: `?plano=trimestral` mostra "3 meses" e R$ 129,90; e-mail `ana@gmial.com` mostra sugestão e clicar corrige; Pix gera QR e, quando o status vira `paid`, navega para o login com `pago=1`; erro 409 aparece na tela; plano `teste` não listado. Retorno: `rejected` mostra a mensagem e o botão. Login: com `?pago=1&email=a@b.com` mostra o aviso e "Reenviar link" chama `resendAccess('a@b.com')` e desabilita o botão.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `Checkout: pagina de compra, retorno do cartao e aviso no login`

### Task 8: Primeiro acesso (senha obrigatória), redefinição e cadastro direto

**Files:**
- Create: `src/pages/FirstAccess.tsx` (`/primeiro-acesso`)
- Modify: `src/App.tsx` (rota), `src/pages/ResetPassword.tsx` (chama `claimAccess('link_opened')` ao abrir com sessão de recuperação), `src/pages/Register.tsx` + `src/utils/auth.ts` (sem caminho de confirmação quando há sessão; grava `profiles.signup_utm` com `getAttribution()`)
- Test: `src/__tests__/FirstAccess.test.tsx`, `src/__tests__/Register.test.tsx`, `src/__tests__/ResetPassword.test.tsx`

**Interfaces:**
- Consumes: Task 5 (via `claimAccess`), Task 6.
- Comportamento `/primeiro-acesso`: espera a sessão do link (`supabase.auth.getSession()`; sem sessão após o carregamento → "Este link expirou ou já foi usado." + campo e-mail + "Enviar novo link" → `resendAccess`). Com sessão: `claimAccess('link_opened')` uma vez; formulário **"Crie sua senha"** (senha + confirmação, mesmas regras de `Register.tsx`), **sem botão de pular**; ao salvar: `supabase.auth.updateUser({ password })` → `claimAccess('password_set')` → hidrata a store como o `Login` faz → `navigate('/onboarding')` se `needsOnboarding`, senão `/home`.
- [ ] **Step 1: Testes que falham** — sem sessão mostra "Este link expirou..."; com sessão chama `claimAccess('link_opened')` e não há botão "Pular"; senhas diferentes bloqueiam; salvar chama `updateUser`, `claimAccess('password_set')` e vai para `/onboarding`; Register com `signUp` devolvendo sessão vai direto adiante e chama update de `signup_utm`; ResetPassword com sessão chama `claimAccess('link_opened')`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `Checkout: primeiro acesso com senha obrigatoria e cadastro sem confirmacao`

### Task 9: Tela de assinatura logada — cartão avulso

**Files:**
- Modify: `src/pages/Subscribe.tsx`, `src/pages/MySubscription.tsx` (rótulo de `source:'card'` = "Acesso via cartão"), `src/utils/pixExpiry.ts` (aviso vale para `'card'`)
- Test: `src/__tests__/Subscribe.test.tsx`, `src/__tests__/MySubscription.test.tsx`, `src/__tests__/pixExpiry.test.ts`

**Interfaces:**
- Consumes: Task 6 (`createCardPayment`).
- Comportamento: some o botão de assinatura mensal recorrente; cada plano oferece **"Pagar com Pix"** e **"Cartão (até 12x)"**; cartão redireciona para `init_point` e a volta (`/subscribe`) reaproveita a espera atual pelo webhook. `src/utils/subscription.ts#createSubscription` e `api/create-subscription.ts` ficam sem uso na tela (não apagar a API nesta etapa).
- [ ] **Step 1: Testes que falham** — não existe mais botão com texto de assinatura recorrente; "Cartão (até 12x)" do trimestral chama `createCardPayment('trimestral')`; `MySubscription` com `source:'card'` mostra "Acesso via cartão"; `pixExpiry` avisa para `'card'`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `Checkout: tela de assinatura oferece cartao avulso parcelado`

### Task 10: Painel admin — Funil

**Files:**
- Create: `src/utils/funnel.ts`, `src/pages/admin/AdminFunnel.tsx`
- Modify: `src/pages/admin/AdminDashboard.tsx` (tile "Funil", ícone `Filter`), `src/App.tsx` (`/admin/funnel` com `RequireOnboarding`+`RequireAdmin`)
- Test: `src/__tests__/funnel.test.ts`, `src/__tests__/AdminFunnel.test.tsx`

**Interfaces:**
- Produces:
  - `FUNNEL_STEPS = ['checkout','paid','link_opened','password_set','onboarding','first_workout'] as const` com rótulos "Checkout iniciado", "Pagou", "Abriu o link", "Criou a senha", "Fez o onboarding", "Primeiro treino".
  - `computeFunnel(intents: PurchaseIntent[], onboardedUserIds: Set<string>, firstWorkoutUserIds: Set<string>, since: Date): { steps: { key; label; count }[]; bySource: { source: string; checkout: number; paid: number }[]; paidWithoutPassword: PurchaseIntent[] }` — conta **pessoas** (e-mail distinto), não intents; `source` vazio vira "Direto/desconhecido".
  - `loadFunnelData(since: Date)` em `src/utils/funnel.ts`: intents (admin RLS), `profiles.onboarding_completed_at` e `workout_completions` dos `user_id` envolvidos.
  - Tela: filtro 7/30/90 dias; barras horizontais por etapa com % da etapa anterior; tabela por origem; lista "Pagaram e não criaram a senha" (e-mail, data) com botão **"Reenviar acesso"** (`resendAccess`).
- [ ] **Step 1: Testes que falham** — dois intents do mesmo e-mail contam 1 checkout; pagos sem senha listados; origem vazia agrupa em "Direto/desconhecido"; tela troca o período e chama `loadFunnelData` com a data nova; "Reenviar acesso" chama `resendAccess` com o e-mail.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `Checkout: tela Funil no painel admin`

### Task 11: Configuração, landing page e verificação final

**Files:**
- Create: `docs/checkout-pagar-primeiro-setup.md` (checklist manual do usuário)
- Modify (repositório da landing, quando o usuário der acesso): links dos cards → `https://musafit.me/comprar?plano=<id>` repassando os `utm_*` da URL da landing.

- [ ] **Step 1:** `npm run check`, `npx vitest run`, `npm run build` → tudo verde.
- [ ] **Step 2:** Escrever o checklist manual, na ordem:
  1. Vercel: `PUBLIC_APP_URL=https://musafit.me`, `CHECKOUT_TEST_EMAILS=<e-mails de teste>`.
  2. Supabase → Auth → URL Configuration: adicionar `https://musafit.me/primeiro-acesso` e `http://localhost:3000/primeiro-acesso` às Redirect URLs.
  3. Supabase → Email Templates → **Magic Link**: assunto **"Seu acesso à MusaFit está liberado"**, corpo no estilo atual com botão **"Acessar minha conta"** (`{{ .ConfirmationURL }}`); demais assuntos em português ("Redefinir sua senha", etc.).
  4. Depois do deploy do código: Supabase → Auth → Providers → Email → **desligar "Confirm email"**.
- [ ] **Step 3:** Landing page (com acesso do usuário): trocar os links dos cards; testar que `?utm_source=...` da landing chega no `/comprar`.
- [ ] **Step 4: Teste ponta a ponta em produção (usuário, com plano `teste`)** — e-mail de teste novo: pagar Pix R$ 0,01 → login com aviso → e-mail chega → link abre `/primeiro-acesso` → cria senha → onboarding; repetir com o **mesmo e-mail** (só credita, sem e-mail); cartão com valor real e estorno; conferir a tela Funil.
- [ ] **Step 5: Commit** `Checkout: checklist de configuracao`

# Mercado Pago Recurring Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Task 3 and Task 12 require live interaction with the human user (real Mercado Pago credentials) and cannot be delegated to a fully autonomous subagent — the coordinating agent must handle those steps directly.**

**Goal:** Gate the Musa Fit30 app behind a R$59,90/month Mercado Pago subscription — full access block for anyone without an active subscription (admins exempt), enforced at both the UI (route guard) and database (RLS) layers.

**Architecture:** Mercado Pago's Preapproval API ("Assinaturas") with hosted-checkout redirect. Three new Vercel Serverless Functions (`api/create-subscription.ts`, `api/mercadopago-webhook.ts`, `api/cancel-subscription.ts`) are the only code that ever touches the Mercado Pago Access Token or the Supabase `service_role` key — this is the first backend code in the repo. A new `public.subscriptions` table (synced from webhooks) and a `public.has_active_subscription()` `SECURITY DEFINER` function mirror the existing `profiles`/`is_admin()` pattern exactly. The client never talks to Mercado Pago directly.

**Tech Stack:** React 18 + TypeScript + Vite (existing), Vercel Serverless Functions (Node.js runtime, new), official `mercadopago` npm SDK v3 (new dependency — confirmed via its published type declarations to export `PreApproval`, `PreApprovalPlan`, and a `WebhookSignatureValidator` helper, so webhook HMAC validation does not need to be hand-rolled), `@vercel/node` (new, types-only devDependency), Supabase (existing).

## Global Constraints

- **Never expose secrets to the client.** `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_PREAPPROVAL_PLAN_ID`, and `SUPABASE_SERVICE_ROLE_KEY` are Vercel-Function-only environment variables — no `VITE_` prefix, never referenced from `src/`, never logged, never committed. Only `api/*.ts` files may read them.
- **No client-side calls to Mercado Pago's API directly** — every Mercado Pago API call happens inside a Vercel Function, never in `src/`.
- **The webhook handler never trusts its own payload for subscription state** — it always re-fetches the authoritative resource via `PreApproval.get()` before writing to the database, both for idempotency and to avoid trusting unverified data even after signature validation.
- **RLS is the real security boundary; `RequireSubscription`/`RequireAdmin` are UX only.** Every access-control decision made in a React component must have a matching, independently-enforced Postgres RLS policy (or `is_admin()`/`has_active_subscription()` function) — this project's established pattern (see `supabase/migrations/20260715090000_admin_dashboard.sql`).
- **No client-writable policy on `public.subscriptions`.** Only the `service_role` key (used exclusively inside `api/*.ts`) may INSERT/UPDATE it.
- **Single fixed plan, no trial, full block, no grandfathering, admin exempt** — confirmed business rules, do not add tiers, partial access, or free periods.
- **Follow existing conventions exactly**: relative imports (no `@/` alias) in `src/`; one file per concern in `src/utils/`; Tailwind shell `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50` / `max-w-4xl mx-auto` / `ArrowLeft` back-button header / spinner markup identical to `RequireAdmin.tsx`; `alert()` for save/error feedback, no toast library; tests under `src/__tests__/` using Vitest + `vi.mock` + `vi.hoisted()` where the mock factory needs top-level consts (see `src/__tests__/profile.test.ts` for the established pattern) — **`@testing-library/jest-dom` must never become a dependency**; use `.not.toBeNull()` instead of `.toBeInTheDocument()`.
- **Migration files** follow `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`, applied via `supabase db query --linked --file ...` (CLI already authenticated/linked to project `xgwigtsxkqwdvndxyupz`) — never via a manually-obtained `service_role` key in this session.
- **RLS policy replacement, not addition, where the existing policy is `USING (true)`.** Postgres OR-combines multiple permissive policies for the same command — adding a *new* restrictive-looking policy alongside an existing `USING (true)` policy on `workouts` would be a silent no-op (`true OR anything` is still `true`). The existing `"Anyone can view workouts"` and `"Users can view their own progress"` policies must be `DROP`ped and recreated with the subscription check folded in, not left in place with an additive policy beside them.

---

### Task 1: Database migration — `subscriptions` table, `has_active_subscription()`, RLS gating on `workouts`/`user_progress`

**Files:**
- Create: `supabase/migrations/20260718090000_subscriptions.sql`

**Interfaces:**
- Produces: table `public.subscriptions(id uuid pk, user_id uuid unique fk, preapproval_id text unique, status text, next_payment_date timestamptz, raw jsonb, created_at, updated_at)`; function `public.has_active_subscription(): boolean` (`SECURITY DEFINER STABLE`, mirrors `public.is_admin()`). Later tasks (4, 5, 6, 7) read/write this table and call this function.

- [ ] **Step 1: Write the migration file**

```sql
-- Mercado Pago recurring billing: subscriptions table, has_active_subscription()
-- helper, and RLS gating workouts/user_progress reads behind an active
-- subscription (admins remain exempt via the existing is_admin() checks).

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  preapproval_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL, -- 'pending' | 'authorized' | 'paused' | 'cancelled'
  next_payment_date TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.subscriptions TO authenticated;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription, admins view all" ON public.subscriptions
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_admin()
  );

-- No INSERT/UPDATE/DELETE policy: only service_role (inside Vercel Functions) writes.

CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = auth.uid() AND status = 'authorized'
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription() TO authenticated;

-- Replace (not add to) the existing fully-public workouts SELECT policy —
-- a USING(true) policy left in place would OR-combine and make any new
-- policy a no-op.
DROP POLICY IF EXISTS "Anyone can view workouts" ON public.workouts;
CREATE POLICY "Subscribers and admins can view workouts" ON public.workouts
  FOR SELECT USING (
    public.has_active_subscription()
    OR public.is_admin()
  );

-- Replace the existing self-view policy on user_progress to also require
-- an active subscription (or admin). The separate "Admins can view all
-- progress" policy from the admin-dashboard migration is untouched and
-- keeps working exactly as before (admins always see everyone's progress).
DROP POLICY IF EXISTS "Users can view their own progress" ON public.user_progress;
CREATE POLICY "Users can view their own progress" ON public.user_progress
  FOR SELECT USING (
    auth.uid() = user_id
    AND (public.has_active_subscription() OR public.is_admin())
  );
```

- [ ] **Step 2: Apply the migration to the linked project**

Run: `supabase db query --linked --file supabase/migrations/20260718090000_subscriptions.sql`
Expected: JSON response with `"rows": []` and no `"_tag":"Error"` key.

- [ ] **Step 3: Verify structure via the CLI**

Run:
```
supabase db query --linked "SELECT (SELECT count(*) FROM pg_proc WHERE proname = 'has_active_subscription' AND pronamespace = 'public'::regnamespace) AS fn_count, (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.subscriptions'::regclass) AS subs_policy_count, (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.workouts'::regclass AND polcmd = 'r') AS workouts_select_policy_count, (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.user_progress'::regclass AND polcmd = 'r') AS user_progress_select_policy_count;"
```
Expected row: `fn_count: 1`, `subs_policy_count: 1`, `workouts_select_policy_count: 1` (the old `USING(true)` one was dropped, replaced by exactly one new one), `user_progress_select_policy_count: 2` (the recreated self-view policy plus the untouched admin-view-all policy from the admin dashboard migration).

- [ ] **Step 4: Verify a user without a subscription is now blocked from `workouts`**

Create `_tmp_check_workouts_gated.mjs` in the project root:
```js
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envText = readFileSync('./.env.local', 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(Boolean).map((l) => {
    const idx = l.indexOf('=');
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { data, error } = await supabase.from('workouts').select('*').eq('day_number', 1);
console.log('data:', data);
console.log('error:', error);
```
Run: `node _tmp_check_workouts_gated.mjs`
Expected: `data: []` (anon has no session, `has_active_subscription()` and `is_admin()` both evaluate false, RLS returns zero rows — same "empty, no error" shape as the earlier `pdf_plans`/`profiles` anon checks in this project, since `anon` already holds broad default table grants here).
Then delete the file: `rm _tmp_check_workouts_gated.mjs`

- [ ] **Step 5: Verify the admin account still sees workouts (regression check)**

Run: `supabase db query --linked "SELECT count(*) FROM public.workouts;"` — expected: 30 (or however many rows already existed; this confirms the table itself wasn't touched, only the policy). This is a structural check only (the CLI's own elevated access bypasses RLS); the real per-role check happens in Task 12's manual browser verification once the admin logs in.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260718090000_subscriptions.sql
git commit -m "feat(db): add subscriptions table, has_active_subscription(), and gate workouts/user_progress RLS behind it"
```

---

### Task 2: Shared server-side libs — `api/_lib/supabaseAdmin.ts`, `api/_lib/mercadopagoConfig.ts`

**Files:**
- Create: `api/_lib/supabaseAdmin.ts`
- Create: `api/_lib/mercadopagoConfig.ts`
- Create: `src/__tests__/apiLib.test.ts`
- Modify: `package.json` (add `mercadopago` dependency, `@vercel/node` devDependency)

**Interfaces:**
- Produces: `createSupabaseAdmin(): SupabaseClient` and `createMercadoPagoConfig(): MercadoPagoConfig`, both reading from `process.env`. Tasks 4, 5, 6 import both.

- [ ] **Step 1: Install dependencies**

```bash
npm install mercadopago
npm install --save-dev @vercel/node
```

- [ ] **Step 2: Write the failing tests**

Create `src/__tests__/apiLib.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ mocked: 'client' })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

const { mercadoPagoConfigMock } = vi.hoisted(() => ({
  mercadoPagoConfigMock: vi.fn(),
}))

vi.mock('mercadopago', () => ({
  MercadoPagoConfig: mercadoPagoConfigMock,
}))

import { createSupabaseAdmin } from '../../api/_lib/supabaseAdmin'
import { createMercadoPagoConfig } from '../../api/_lib/mercadopagoConfig'

describe('createSupabaseAdmin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('cria o client com a URL e a service_role key das env vars', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-secret')

    createSupabaseAdmin()

    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-secret',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  })
})

describe('createMercadoPagoConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('cria a config com o access token da env var', () => {
    vi.stubEnv('MERCADOPAGO_ACCESS_TOKEN', 'TEST-token-123')

    createMercadoPagoConfig()

    expect(mercadoPagoConfigMock).toHaveBeenCalledWith({ accessToken: 'TEST-token-123' })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/apiLib.test.ts`
Expected: FAIL — `Cannot find module '../../api/_lib/supabaseAdmin'`.

- [ ] **Step 4: Implement `api/_lib/supabaseAdmin.ts`**

```ts
import { createClient } from '@supabase/supabase-js'

export const createSupabaseAdmin = () => {
  const url = process.env.VITE_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

- [ ] **Step 5: Implement `api/_lib/mercadopagoConfig.ts`**

```ts
import { MercadoPagoConfig } from 'mercadopago'

export const createMercadoPagoConfig = () => {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || ''
  return new MercadoPagoConfig({ accessToken })
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/apiLib.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Verify the project typechecks (this now also covers `api/`, per `tsconfig.json`'s existing `include`)**

Run: `npm run check`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json api/_lib/supabaseAdmin.ts api/_lib/mercadopagoConfig.ts src/__tests__/apiLib.test.ts
git commit -m "feat(billing): add mercadopago SDK and shared server-side client factories"
```

---

### Task 3: One-time Preapproval Plan creation — **requires live user interaction**

**Files:**
- Create: `scripts/create-preapproval-plan.mjs`

**Interfaces:**
- Produces: nothing importable — this is a one-off operational script, run once by hand, whose only output is a `preapproval_plan` ID the user pastes into `MERCADOPAGO_PREAPPROVAL_PLAN_ID` later (Task 12). No other task imports this file.

**Do not delegate this task's execution to an autonomous subagent** — it requires the user's real Mercado Pago test Access Token, which per this project's established secret-handling practice must never be typed into the chat or read by the assistant directly (same reasoning as the Supabase `service_role` key earlier in this project). The coordinating agent writes the script (this step can be a normal file-write), then asks the user to add their token to `.env.local` themselves and run the script themselves in their own terminal.

- [ ] **Step 1: Write the script**

Create `scripts/create-preapproval-plan.mjs`:
```js
import { readFileSync } from 'node:fs'
import { MercadoPagoConfig, PreApprovalPlan } from 'mercadopago'

const envText = readFileSync('./.env.local', 'utf8')
const env = Object.fromEntries(
  envText.split('\n').filter(Boolean).map((line) => {
    const idx = line.indexOf('=')
    return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
  })
)

const accessToken = env.MERCADOPAGO_ACCESS_TOKEN
if (!accessToken) {
  console.error('MERCADOPAGO_ACCESS_TOKEN não encontrado em .env.local')
  process.exit(1)
}

const config = new MercadoPagoConfig({ accessToken })
const plan = new PreApprovalPlan(config)

const result = await plan.create({
  body: {
    reason: 'Musa Fit30 - Assinatura mensal',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: 59.90,
      currency_id: 'BRL',
    },
    back_url: 'https://traemusa20lfmz.vercel.app/subscribe',
  },
})

console.log('Plano criado com sucesso.')
console.log('ID do plano (MERCADOPAGO_PREAPPROVAL_PLAN_ID):', result.id)
console.log('Status:', result.status)
```

- [ ] **Step 2: Ask the user to add their token and run the script**

Tell the user:
1. Add this line to `.env.local` (never paste the token value into chat): `MERCADOPAGO_ACCESS_TOKEN=<their TEST- access token>`
2. Run: `node scripts/create-preapproval-plan.mjs`
3. Report back only the printed **plan ID** (not the token) — this value is not secret and safe to share; it will be stored later as `MERCADOPAGO_PREAPPROVAL_PLAN_ID` in Vercel.

- [ ] **Step 3: Confirm and record**

Once the user shares the plan ID, note it in the session for use in Task 12 (adding it to Vercel env vars) — do not hardcode it anywhere in the codebase.

- [ ] **Step 4: Commit the script**

```bash
git add scripts/create-preapproval-plan.mjs
git commit -m "chore(billing): add one-time preapproval plan creation script"
```

---

### Task 4: `api/create-subscription.ts`

**Files:**
- Create: `api/create-subscription.ts`
- Create: `src/__tests__/apiCreateSubscription.test.ts`

**Interfaces:**
- Consumes: `createSupabaseAdmin` from `./_lib/supabaseAdmin`, `createMercadoPagoConfig` from `./_lib/mercadopagoConfig` (Task 2); `PreApproval` from `mercadopago`.
- Produces: default-exported Vercel handler `(req: VercelRequest, res: VercelResponse) => Promise<void>` responding `{ init_point: string }` on success. Consumed by `src/utils/subscription.ts` (Task 7) via `fetch('/api/create-subscription', ...)`.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/apiCreateSubscription.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getUserMock, preApprovalCreateMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  preApprovalCreateMock: vi.fn(),
}))

vi.mock('../../api/_lib/supabaseAdmin', () => ({
  createSupabaseAdmin: () => ({ auth: { getUser: getUserMock } }),
}))

vi.mock('../../api/_lib/mercadopagoConfig', () => ({
  createMercadoPagoConfig: () => ({ mocked: 'config' }),
}))

vi.mock('mercadopago', () => ({
  PreApproval: vi.fn().mockImplementation(() => ({ create: preApprovalCreateMock })),
}))

import handler from '../../api/create-subscription'

function createMockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

describe('POST /api/create-subscription', () => {
  beforeEach(() => {
    vi.stubEnv('MERCADOPAGO_PREAPPROVAL_PLAN_ID', 'plan-123')
  })

  it('retorna 405 se não for POST', async () => {
    const req: any = { method: 'GET', headers: {} }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('retorna 401 sem token de autorização', async () => {
    const req: any = { method: 'POST', headers: {} }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('retorna 401 com token inválido', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: new Error('invalid') })
    const req: any = { method: 'POST', headers: { authorization: 'Bearer bad-token' } }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('cria a assinatura e retorna init_point', async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'ana@example.com' } },
      error: null,
    })
    preApprovalCreateMock.mockResolvedValueOnce({ init_point: 'https://mp.example/checkout/abc' })

    const req: any = {
      method: 'POST',
      headers: { authorization: 'Bearer good-token', host: 'traemusa20lfmz.vercel.app' },
    }
    const res = createMockRes()
    await handler(req, res)

    expect(preApprovalCreateMock).toHaveBeenCalledWith({
      body: {
        preapproval_plan_id: 'plan-123',
        payer_email: 'ana@example.com',
        external_reference: 'user-1',
        back_url: 'https://traemusa20lfmz.vercel.app/subscribe',
      },
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ init_point: 'https://mp.example/checkout/abc' })
  })

  it('retorna 500 se a criação falhar no Mercado Pago', async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'ana@example.com' } },
      error: null,
    })
    preApprovalCreateMock.mockRejectedValueOnce(new Error('mp down'))

    const req: any = {
      method: 'POST',
      headers: { authorization: 'Bearer good-token', host: 'traemusa20lfmz.vercel.app' },
    }
    const res = createMockRes()
    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/apiCreateSubscription.test.ts`
Expected: FAIL — `Cannot find module '../../api/create-subscription'`.

- [ ] **Step 3: Implement `api/create-subscription.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PreApproval } from 'mercadopago'
import { createMercadoPagoConfig } from './_lib/mercadopagoConfig'
import { createSupabaseAdmin } from './_lib/supabaseAdmin'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = (req.headers.authorization as string) || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' })
    return
  }

  const supabaseAdmin = createSupabaseAdmin()
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData.user) {
    res.status(401).json({ error: 'Invalid session' })
    return
  }

  const user = userData.user
  const planId = process.env.MERCADOPAGO_PREAPPROVAL_PLAN_ID || ''
  const host = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string) || ''
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const backUrl = `${protocol}://${host}/subscribe`

  const preApproval = new PreApproval(createMercadoPagoConfig())
  try {
    const result = await preApproval.create({
      body: {
        preapproval_plan_id: planId,
        payer_email: user.email || '',
        external_reference: user.id,
        back_url: backUrl,
      },
    })
    res.status(200).json({ init_point: result.init_point })
  } catch (error) {
    console.error('create-subscription error:', error)
    res.status(500).json({ error: 'Failed to create subscription' })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/apiCreateSubscription.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify the project typechecks**

Run: `npm run check`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add api/create-subscription.ts src/__tests__/apiCreateSubscription.test.ts
git commit -m "feat(billing): add create-subscription Vercel function"
```

---

### Task 5: `api/mercadopago-webhook.ts`

**Files:**
- Create: `api/mercadopago-webhook.ts`
- Create: `src/__tests__/apiMercadopagoWebhook.test.ts`

**Interfaces:**
- Consumes: `createSupabaseAdmin`, `createMercadoPagoConfig` (Task 2); `PreApproval`, `WebhookSignatureValidator`, `InvalidWebhookSignatureError` from `mercadopago`.
- Produces: default-exported Vercel handler, no other file imports this.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/apiMercadopagoWebhook.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { validateMock, preApprovalGetMock, upsertMock, fromMock } = vi.hoisted(() => {
  const upsertMock = vi.fn().mockResolvedValue({ error: null })
  const fromMock = vi.fn(() => ({ upsert: upsertMock }))
  return {
    validateMock: vi.fn(),
    preApprovalGetMock: vi.fn(),
    upsertMock,
    fromMock,
  }
})

class FakeInvalidWebhookSignatureError extends Error {}

vi.mock('../../api/_lib/supabaseAdmin', () => ({
  createSupabaseAdmin: () => ({ from: fromMock }),
}))

vi.mock('../../api/_lib/mercadopagoConfig', () => ({
  createMercadoPagoConfig: () => ({ mocked: 'config' }),
}))

vi.mock('mercadopago', () => ({
  PreApproval: vi.fn().mockImplementation(() => ({ get: preApprovalGetMock })),
  WebhookSignatureValidator: { validate: validateMock },
  InvalidWebhookSignatureError: FakeInvalidWebhookSignatureError,
}))

import handler from '../../api/mercadopago-webhook'

function createMockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

describe('POST /api/mercadopago-webhook', () => {
  beforeEach(() => {
    vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', 'secret-abc')
    fromMock.mockClear()
    upsertMock.mockClear()
  })

  it('retorna 405 se não for POST', async () => {
    const req: any = { method: 'GET', headers: {}, query: {} }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('retorna 401 quando a assinatura é inválida', async () => {
    validateMock.mockImplementationOnce(() => {
      throw new FakeInvalidWebhookSignatureError('bad signature')
    })
    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=bad', 'x-request-id': 'req-1' },
      query: { 'data.id': '999', type: 'subscription_preapproval' },
      body: {},
    }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('ignora e responde 200 para tipos de evento desconhecidos', async () => {
    validateMock.mockImplementationOnce(() => undefined)
    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { 'data.id': '999', type: 'payment' },
      body: {},
    }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(preApprovalGetMock).not.toHaveBeenCalled()
  })

  it('busca o estado real e faz upsert em subscriptions para subscription_preapproval', async () => {
    validateMock.mockImplementationOnce(() => undefined)
    preApprovalGetMock.mockResolvedValueOnce({
      id: 'preapproval-999',
      external_reference: 'user-1',
      status: 'authorized',
      next_payment_date: '2026-08-18T00:00:00.000Z',
    })

    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { 'data.id': 'preapproval-999', type: 'subscription_preapproval' },
      body: {},
    }
    const res = createMockRes()
    await handler(req, res)

    expect(preApprovalGetMock).toHaveBeenCalledWith({ id: 'preapproval-999' })
    expect(fromMock).toHaveBeenCalledWith('subscriptions')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        preapproval_id: 'preapproval-999',
        status: 'authorized',
        next_payment_date: '2026-08-18T00:00:00.000Z',
      }),
      { onConflict: 'user_id' }
    )
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('ignora quando o recurso não tem external_reference', async () => {
    validateMock.mockImplementationOnce(() => undefined)
    preApprovalGetMock.mockResolvedValueOnce({ id: 'preapproval-999', status: 'authorized' })

    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { 'data.id': 'preapproval-999', type: 'subscription_preapproval' },
      body: {},
    }
    const res = createMockRes()
    await handler(req, res)

    expect(upsertMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/apiMercadopagoWebhook.test.ts`
Expected: FAIL — `Cannot find module '../../api/mercadopago-webhook'`.

- [ ] **Step 3: Implement `api/mercadopago-webhook.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PreApproval, WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago'
import { createMercadoPagoConfig } from './_lib/mercadopagoConfig'
import { createSupabaseAdmin } from './_lib/supabaseAdmin'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const dataId = (req.query['data.id'] as string) || (req.body?.data?.id as string) || ''
  const xSignature = (req.headers['x-signature'] as string) || ''
  const xRequestId = (req.headers['x-request-id'] as string) || ''
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET || ''

  try {
    WebhookSignatureValidator.validate({ xSignature, xRequestId, dataId, secret })
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      res.status(401).json({ error: 'Invalid signature' })
      return
    }
    throw error
  }

  const type = (req.query.type as string) || (req.body?.type as string) || (req.body?.topic as string) || ''
  if (type !== 'subscription_preapproval') {
    res.status(200).json({ ignored: true })
    return
  }

  const preApproval = new PreApproval(createMercadoPagoConfig())
  const resource = await preApproval.get({ id: dataId })

  const userId = resource.external_reference
  if (!userId) {
    res.status(200).json({ ignored: true, reason: 'missing external_reference' })
    return
  }

  const supabaseAdmin = createSupabaseAdmin()
  await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      preapproval_id: resource.id,
      status: resource.status,
      next_payment_date: resource.next_payment_date || null,
      raw: resource,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  res.status(200).json({ ok: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/apiMercadopagoWebhook.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify the project typechecks**

Run: `npm run check`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add api/mercadopago-webhook.ts src/__tests__/apiMercadopagoWebhook.test.ts
git commit -m "feat(billing): add mercadopago-webhook Vercel function"
```

---

### Task 6: `api/cancel-subscription.ts`

**Files:**
- Create: `api/cancel-subscription.ts`
- Create: `src/__tests__/apiCancelSubscription.test.ts`

**Interfaces:**
- Consumes: `createSupabaseAdmin`, `createMercadoPagoConfig` (Task 2); `PreApproval` from `mercadopago`.
- Produces: default-exported Vercel handler, consumed by `src/utils/subscription.ts` (Task 7) via `fetch('/api/cancel-subscription', ...)`.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/apiCancelSubscription.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getUserMock, selectSingleMock, updateEqMock, preApprovalUpdateMock, fromMock } = vi.hoisted(() => {
  const selectSingleMock = vi.fn()
  const updateEqMock = vi.fn().mockResolvedValue({ error: null })
  const fromMock = vi.fn((table: string) => {
    if (table === 'subscriptions') {
      return {
        select: () => ({ eq: () => ({ single: selectSingleMock }) }),
        update: () => ({ eq: updateEqMock }),
      }
    }
    throw new Error(`unexpected table ${table}`)
  })
  return {
    getUserMock: vi.fn(),
    selectSingleMock,
    updateEqMock,
    preApprovalUpdateMock: vi.fn(),
    fromMock,
  }
})

vi.mock('../../api/_lib/supabaseAdmin', () => ({
  createSupabaseAdmin: () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}))

vi.mock('../../api/_lib/mercadopagoConfig', () => ({
  createMercadoPagoConfig: () => ({ mocked: 'config' }),
}))

vi.mock('mercadopago', () => ({
  PreApproval: vi.fn().mockImplementation(() => ({ update: preApprovalUpdateMock })),
}))

import handler from '../../api/cancel-subscription'

function createMockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

describe('POST /api/cancel-subscription', () => {
  beforeEach(() => {
    fromMock.mockClear()
    updateEqMock.mockClear()
    preApprovalUpdateMock.mockReset()
  })

  it('retorna 401 sem token', async () => {
    const req: any = { method: 'POST', headers: {} }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('retorna 404 se o usuário não tem assinatura', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
    selectSingleMock.mockResolvedValueOnce({ data: null, error: new Error('not found') })

    const req: any = { method: 'POST', headers: { authorization: 'Bearer good-token' } }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('cancela no Mercado Pago e atualiza a linha local', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
    selectSingleMock.mockResolvedValueOnce({
      data: { preapproval_id: 'preapproval-999', status: 'authorized' },
      error: null,
    })
    preApprovalUpdateMock.mockResolvedValueOnce({ id: 'preapproval-999', status: 'cancelled' })

    const req: any = { method: 'POST', headers: { authorization: 'Bearer good-token' } }
    const res = createMockRes()
    await handler(req, res)

    expect(preApprovalUpdateMock).toHaveBeenCalledWith({
      id: 'preapproval-999',
      body: { status: 'cancelled' },
    })
    expect(updateEqMock).toHaveBeenCalledWith('user_id', 'user-1')
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true, status: 'cancelled' })
  })

  it('não chama o Mercado Pago se já está cancelada', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
    selectSingleMock.mockResolvedValueOnce({
      data: { preapproval_id: 'preapproval-999', status: 'cancelled' },
      error: null,
    })

    const req: any = { method: 'POST', headers: { authorization: 'Bearer good-token' } }
    const res = createMockRes()
    await handler(req, res)

    expect(preApprovalUpdateMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/apiCancelSubscription.test.ts`
Expected: FAIL — `Cannot find module '../../api/cancel-subscription'`.

- [ ] **Step 3: Implement `api/cancel-subscription.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PreApproval } from 'mercadopago'
import { createMercadoPagoConfig } from './_lib/mercadopagoConfig'
import { createSupabaseAdmin } from './_lib/supabaseAdmin'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = (req.headers.authorization as string) || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' })
    return
  }

  const supabaseAdmin = createSupabaseAdmin()
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData.user) {
    res.status(401).json({ error: 'Invalid session' })
    return
  }

  const { data: subscription, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .select('preapproval_id, status')
    .eq('user_id', userData.user.id)
    .single()

  if (subError || !subscription) {
    res.status(404).json({ error: 'No subscription found' })
    return
  }

  if (subscription.status === 'cancelled') {
    res.status(200).json({ ok: true, status: 'cancelled' })
    return
  }

  const preApproval = new PreApproval(createMercadoPagoConfig())
  try {
    await preApproval.update({ id: subscription.preapproval_id, body: { status: 'cancelled' } })
  } catch (error) {
    console.error('cancel-subscription MP error:', error)
    res.status(500).json({ error: 'Failed to cancel subscription' })
    return
  }

  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userData.user.id)

  res.status(200).json({ ok: true, status: 'cancelled' })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/apiCancelSubscription.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify the project typechecks**

Run: `npm run check`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add api/cancel-subscription.ts src/__tests__/apiCancelSubscription.test.ts
git commit -m "feat(billing): add cancel-subscription Vercel function"
```

---

### Task 7: Client data layer — `types`, `authStore`, `src/utils/subscription.ts`, wire into `App.tsx`

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/store/authStore.ts`
- Create: `src/utils/subscription.ts`
- Create: `src/__tests__/subscription.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `SubscriptionStatus`, `Subscription` types; `useAuthStore` gains `hasActiveSubscription: boolean` / `setHasActiveSubscription(v: boolean): void`; `getHasActiveSubscription(userId): Promise<boolean>`, `getMySubscription(userId): Promise<Subscription | null>`, `createSubscription(): Promise<{initPoint: string|null; error: string|null}>`, `cancelSubscription(): Promise<{ok: boolean; error: string|null}>`. Tasks 8, 9, 10 consume these.

- [ ] **Step 1: Add types to `src/types/index.ts`**

Append to the end of `src/types/index.ts`:
```ts

export type SubscriptionStatus = 'pending' | 'authorized' | 'paused' | 'cancelled'

export interface Subscription {
  id: string
  user_id: string
  preapproval_id: string
  status: SubscriptionStatus
  next_payment_date: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Write the failing tests for `src/utils/subscription.ts`**

Create `src/__tests__/subscription.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { singleMock, eqMock, selectMock, fromMock, getSessionMock, fetchMock } = vi.hoisted(() => {
  const singleMock = vi.fn()
  const eqMock = vi.fn(() => ({ single: singleMock }))
  const selectMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({ select: selectMock }))
  return {
    singleMock,
    eqMock,
    selectMock,
    fromMock,
    getSessionMock: vi.fn(),
    fetchMock: vi.fn(),
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock, auth: { getSession: getSessionMock } },
}))

vi.stubGlobal('fetch', fetchMock)

import {
  getHasActiveSubscription,
  getMySubscription,
  createSubscription,
  cancelSubscription,
} from '../utils/subscription'

describe('getHasActiveSubscription', () => {
  it('retorna true quando status é authorized', async () => {
    singleMock.mockResolvedValueOnce({ data: { status: 'authorized' }, error: null })
    const result = await getHasActiveSubscription('u1')
    expect(fromMock).toHaveBeenCalledWith('subscriptions')
    expect(eqMock).toHaveBeenCalledWith('user_id', 'u1')
    expect(result).toBe(true)
  })

  it('retorna false quando status não é authorized', async () => {
    singleMock.mockResolvedValueOnce({ data: { status: 'pending' }, error: null })
    expect(await getHasActiveSubscription('u2')).toBe(false)
  })

  it('retorna false quando há erro ou não há linha', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: new Error('not found') })
    expect(await getHasActiveSubscription('u3')).toBe(false)
  })
})

describe('getMySubscription', () => {
  it('retorna a assinatura quando existe', async () => {
    const row = { id: 's1', user_id: 'u1', preapproval_id: 'p1', status: 'authorized', next_payment_date: null, created_at: '', updated_at: '' }
    singleMock.mockResolvedValueOnce({ data: row, error: null })
    expect(await getMySubscription('u1')).toEqual(row)
  })

  it('retorna null quando não existe', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: new Error('not found') })
    expect(await getMySubscription('u2')).toBeNull()
  })
})

describe('createSubscription', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    getSessionMock.mockReset()
  })

  it('retorna erro se não há sessão', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } })
    const result = await createSubscription()
    expect(result.error).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('chama a function e retorna init_point', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: 'tok-1' } } })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ init_point: 'https://mp.example/checkout' }),
    })
    const result = await createSubscription()
    expect(fetchMock).toHaveBeenCalledWith('/api/create-subscription', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok-1' },
    })
    expect(result).toEqual({ initPoint: 'https://mp.example/checkout', error: null })
  })

  it('retorna erro quando a resposta não é ok', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: 'tok-1' } } })
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'falhou' }),
    })
    const result = await createSubscription()
    expect(result).toEqual({ initPoint: null, error: 'falhou' })
  })
})

describe('cancelSubscription', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    getSessionMock.mockReset()
  })

  it('chama a function e retorna ok', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: 'tok-1' } } })
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, status: 'cancelled' }) })
    const result = await cancelSubscription()
    expect(fetchMock).toHaveBeenCalledWith('/api/cancel-subscription', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok-1' },
    })
    expect(result).toEqual({ ok: true, error: null })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/subscription.test.ts`
Expected: FAIL — `Cannot find module '../utils/subscription'`.

- [ ] **Step 4: Implement `src/utils/subscription.ts`**

```ts
import { supabase } from '../lib/supabase'
import { Subscription } from '../types'

export const getHasActiveSubscription = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .single()

  if (error || !data) return false
  return data.status === 'authorized'
}

export const getMySubscription = async (userId: string): Promise<Subscription | null> => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data as Subscription
}

export const createSubscription = async (): Promise<{ initPoint: string | null; error: string | null }> => {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { initPoint: null, error: 'Sessão inválida' }

  try {
    const response = await fetch('/api/create-subscription', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await response.json()
    if (!response.ok) return { initPoint: null, error: body?.error || 'Erro ao criar assinatura' }
    return { initPoint: body.init_point, error: null }
  } catch {
    return { initPoint: null, error: 'Erro ao criar assinatura' }
  }
}

export const cancelSubscription = async (): Promise<{ ok: boolean; error: string | null }> => {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { ok: false, error: 'Sessão inválida' }

  try {
    const response = await fetch('/api/cancel-subscription', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await response.json()
    if (!response.ok) return { ok: false, error: body?.error || 'Erro ao cancelar assinatura' }
    return { ok: true, error: null }
  } catch {
    return { ok: false, error: 'Erro ao cancelar assinatura' }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/subscription.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Add `hasActiveSubscription` to `authStore`**

Modify `src/store/authStore.ts` to the full contents:
```ts
import { create } from 'zustand'
import { User } from '../types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isAdmin: boolean
  hasActiveSubscription: boolean
  setUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
  setIsAdmin: (isAdmin: boolean) => void
  setHasActiveSubscription: (hasActiveSubscription: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isAdmin: false,
  hasActiveSubscription: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  setHasActiveSubscription: (hasActiveSubscription) => set({ hasActiveSubscription }),
  logout: () => set({ user: null, isAuthenticated: false, isAdmin: false, hasActiveSubscription: false }),
}))
```

- [ ] **Step 7: Wire into `App.tsx`'s auth check**

Add the import near the other util imports at the top of `src/App.tsx`:
```ts
import { getHasActiveSubscription } from './utils/subscription'
```

Update the store destructuring (currently `const { setUser, setIsLoading, setIsAdmin } = useAuthStore()`) to:
```ts
  const { setUser, setIsLoading, setIsAdmin, setHasActiveSubscription } = useAuthStore()
```

Replace the `checkAuth` function's body with (same structure as today, one new call added alongside every existing `setIsAdmin` call):
```ts
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser()
        if (user) {
          let username = user.username
          if (!username) {
            try {
              const stored = localStorage.getItem('musa_username') || ''
              username = stored || undefined
            } catch {}
          }
          setUser({ ...user, username })
          setIsAdmin(await getIsAdmin(user.id))
          setHasActiveSubscription(await getHasActiveSubscription(user.id))
          await persistCurrentSession()
        } else {
          const restored = await tryRestoreSession()
          if (restored) {
            const u = await getCurrentUser()
            if (u) {
              setUser(u)
              setIsAdmin(await getIsAdmin(u.id))
              setHasActiveSubscription(await getHasActiveSubscription(u.id))
              await persistCurrentSession()
            } else {
              setUser(null)
              setIsAdmin(false)
              setHasActiveSubscription(false)
            }
          } else {
            setUser(null)
            setIsAdmin(false)
            setHasActiveSubscription(false)
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setUser(null)
        setIsAdmin(false)
        setHasActiveSubscription(false)
      } finally {
        setIsLoading(false)
      }
    }
```

Update the `useEffect` dependency array from `[setUser, setIsLoading, setIsAdmin]` to `[setUser, setIsLoading, setIsAdmin, setHasActiveSubscription]`.

**Also update `src/pages/Login.tsx` and `src/pages/Register.tsx`** — both already call `setIsAdmin(await getIsAdmin(user.id))` right after `setUser(user)` and before `navigate('/home')` (fixed in the admin-dashboard work, to close a "not populated until reload" gap — the same class of gap now applies to `hasActiveSubscription` and must be closed the same way, in both files, from day one).

In `src/pages/Login.tsx`, change line 5 from:
```ts
import { getIsAdmin } from '../utils/profile'
```
to:
```ts
import { getIsAdmin } from '../utils/profile'
import { getHasActiveSubscription } from '../utils/subscription'
```
Change line 17 from:
```ts
  const { setUser, setIsAdmin } = useAuthStore()
```
to:
```ts
  const { setUser, setIsAdmin, setHasActiveSubscription } = useAuthStore()
```
Change lines 50-51 from:
```ts
        setUser(user)
        setIsAdmin(await getIsAdmin(user.id))
```
to:
```ts
        setUser(user)
        setIsAdmin(await getIsAdmin(user.id))
        setHasActiveSubscription(await getHasActiveSubscription(user.id))
```

In `src/pages/Register.tsx`, change line 5 from:
```ts
import { getIsAdmin } from '../utils/profile'
```
to:
```ts
import { getIsAdmin } from '../utils/profile'
import { getHasActiveSubscription } from '../utils/subscription'
```
Change line 22 from:
```ts
  const { setUser, setIsAdmin } = useAuthStore()
```
to:
```ts
  const { setUser, setIsAdmin, setHasActiveSubscription } = useAuthStore()
```
Change lines 90-91 from:
```ts
        setUser(user)
        setIsAdmin(await getIsAdmin(user.id))
```
to:
```ts
        setUser(user)
        setIsAdmin(await getIsAdmin(user.id))
        setHasActiveSubscription(await getHasActiveSubscription(user.id))
```

- [ ] **Step 8: Verify the project typechecks**

Run: `npm run check`
Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add src/types/index.ts src/store/authStore.ts src/utils/subscription.ts src/__tests__/subscription.test.ts src/App.tsx src/pages/Login.tsx src/pages/Register.tsx
git commit -m "feat(billing): add subscription data layer and populate hasActiveSubscription on every login path"
```

---

### Task 8: `RequireSubscription` route guard

**Files:**
- Create: `src/components/RequireSubscription.tsx`
- Create: `src/__tests__/RequireSubscription.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore` (`isAdmin`, `hasActiveSubscription`, `isLoading`) from `../store/authStore` (Task 7).
- Produces: `RequireSubscription` default export, `{ children: JSX.Element }`, used by Task 11 to wrap content routes in `App.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/RequireSubscription.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RequireSubscription from '../components/RequireSubscription'

const mockState = { isAdmin: false, hasActiveSubscription: false, isLoading: false }
vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockState,
}))

describe('RequireSubscription', () => {
  it('redireciona para /subscribe quando não é admin nem tem assinatura ativa', async () => {
    mockState.isAdmin = false
    mockState.hasActiveSubscription = false
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<RequireSubscription><div>Home Content</div></RequireSubscription>} />
          <Route path="/subscribe" element={<div>Subscribe Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Subscribe Page')).not.toBeNull()
  })

  it('renderiza o conteúdo quando tem assinatura ativa', async () => {
    mockState.isAdmin = false
    mockState.hasActiveSubscription = true
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<RequireSubscription><div>Home Content</div></RequireSubscription>} />
          <Route path="/subscribe" element={<div>Subscribe Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Home Content')).not.toBeNull()
  })

  it('renderiza o conteúdo quando é admin, mesmo sem assinatura', async () => {
    mockState.isAdmin = true
    mockState.hasActiveSubscription = false
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<RequireSubscription><div>Home Content</div></RequireSubscription>} />
          <Route path="/subscribe" element={<div>Subscribe Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Home Content')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/RequireSubscription.test.tsx`
Expected: FAIL — `Cannot find module '../components/RequireSubscription'`.

- [ ] **Step 3: Implement `RequireSubscription`**

Create `src/components/RequireSubscription.tsx`:
```tsx
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function RequireSubscription({ children }: { children: JSX.Element }) {
  const { isAdmin, hasActiveSubscription, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-purple-600 animate-spin" />
      </div>
    )
  }

  if (!isAdmin && !hasActiveSubscription) {
    return <Navigate to="/subscribe" replace />
  }

  return children
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/RequireSubscription.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/RequireSubscription.tsx src/__tests__/RequireSubscription.test.tsx
git commit -m "feat(billing): add RequireSubscription route guard"
```

---

### Task 9: `Subscribe` page + `/subscribe` route

**Files:**
- Create: `src/pages/Subscribe.tsx`
- Create: `src/__tests__/Subscribe.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `createSubscription`, `getHasActiveSubscription` from `../utils/subscription` (Task 7); `useAuthStore` (`user`, `isAdmin`, `hasActiveSubscription`, `setHasActiveSubscription`).
- Produces: `Subscribe` default export; route `/subscribe`, registered **outside** any guard in `App.tsx`.

**Note on uncertainty**: this page assumes Mercado Pago appends `preapproval_id` as a query param on `back_url` return (the design flagged this as unverified — the exact `back_url` return-param shape wasn't confirmed against current docs). If Task 12's real end-to-end test shows a different param, adjust the `returnedFromCheckout` check below to match what's actually observed — everything else (not trusting the param's *value*, only using its *presence* as a trigger to re-verify against the database) stays correct regardless.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/Subscribe.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Subscribe from '../pages/Subscribe'

const { createSubscriptionMock, getHasActiveSubscriptionMock } = vi.hoisted(() => ({
  createSubscriptionMock: vi.fn(),
  getHasActiveSubscriptionMock: vi.fn(),
}))

vi.mock('../utils/subscription', () => ({
  createSubscription: createSubscriptionMock,
  getHasActiveSubscription: getHasActiveSubscriptionMock,
}))

const mockState: any = {
  user: { id: 'u1' },
  isAdmin: false,
  hasActiveSubscription: false,
  setHasActiveSubscription: vi.fn(),
}
vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockState,
}))

describe('Subscribe', () => {
  beforeEach(() => {
    mockState.isAdmin = false
    mockState.hasActiveSubscription = false
    mockState.setHasActiveSubscription = vi.fn()
    createSubscriptionMock.mockReset()
    getHasActiveSubscriptionMock.mockReset()
  })

  it('mostra o botão de assinar e redireciona pro checkout ao clicar', async () => {
    createSubscriptionMock.mockResolvedValueOnce({ initPoint: 'https://mp.example/checkout', error: null })
    const originalHref = window.location.href
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: originalHref },
    })

    render(
      <MemoryRouter initialEntries={['/subscribe']}>
        <Routes>
          <Route path="/subscribe" element={<Subscribe />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Assinar agora'))

    await waitFor(() => expect(window.location.href).toBe('https://mp.example/checkout'))
  })

  it('ao voltar do checkout, confirma a assinatura e redireciona pra /home', async () => {
    getHasActiveSubscriptionMock.mockResolvedValueOnce(true)

    render(
      <MemoryRouter initialEntries={['/subscribe?preapproval_id=abc']}>
        <Routes>
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/home" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Home Page')).not.toBeNull()
    expect(mockState.setHasActiveSubscription).toHaveBeenCalledWith(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/Subscribe.test.tsx`
Expected: FAIL — `Cannot find module '../pages/Subscribe'`.

- [ ] **Step 3: Implement `Subscribe.tsx`**

Create `src/pages/Subscribe.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { createSubscription, getHasActiveSubscription } from '../utils/subscription'

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 45000

export default function Subscribe() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAdmin, hasActiveSubscription, setHasActiveSubscription } = useAuthStore()
  const [creating, setCreating] = useState(false)
  const [polling, setPolling] = useState(false)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const [pollKey, setPollKey] = useState(0)

  const returnedFromCheckout = searchParams.has('preapproval_id')

  useEffect(() => {
    if (isAdmin || hasActiveSubscription) {
      navigate('/home', { replace: true })
    }
  }, [isAdmin, hasActiveSubscription, navigate])

  useEffect(() => {
    if (!returnedFromCheckout || !user) return

    setPolling(true)
    setPollTimedOut(false)
    const startedAt = Date.now()
    let interval: ReturnType<typeof setInterval>

    const check = async () => {
      const active = await getHasActiveSubscription(user.id)
      if (active) {
        setHasActiveSubscription(true)
        setPolling(false)
        clearInterval(interval)
        navigate('/home', { replace: true })
        return
      }
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setPolling(false)
        setPollTimedOut(true)
        clearInterval(interval)
      }
    }

    check()
    interval = setInterval(check, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [returnedFromCheckout, user, navigate, setHasActiveSubscription, pollKey])

  const handleSubscribe = async () => {
    setCreating(true)
    const { initPoint, error } = await createSubscription()
    if (error || !initPoint) {
      alert(`Erro ao iniciar assinatura. ${error || ''}`)
      setCreating(false)
      return
    }
    window.location.href = initPoint
  }

  if (returnedFromCheckout && (polling || pollTimedOut)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          {polling && (
            <>
              <div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-purple-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-700">Estamos confirmando seu pagamento...</p>
            </>
          )}
          {pollTimedOut && (
            <>
              <p className="text-gray-700 mb-4">
                Isso pode levar alguns minutos. Você pode fechar esta página — o acesso será liberado automaticamente assim que confirmarmos o pagamento.
              </p>
              <button
                onClick={() => setPollKey((k) => k + 1)}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
              >
                Verificar novamente
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Assine o Musa Fit30</h1>
        <p className="text-gray-600 mb-6">Acesso completo aos treinos por R$59,90/mês.</p>
        <button
          onClick={handleSubscribe}
          disabled={creating}
          className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
        >
          {creating ? 'Redirecionando...' : 'Assinar agora'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/Subscribe.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the route in `App.tsx`**

Add the lazy import with the others:
```ts
const Subscribe = lazy(() => import('./pages/Subscribe'))
```
Add the route (deliberately **not** wrapped in any guard — this page must be reachable by users without an active subscription):
```tsx
          <Route path="/subscribe" element={<Subscribe />} />
```

- [ ] **Step 6: Verify the project typechecks**

Run: `npm run check`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Subscribe.tsx src/__tests__/Subscribe.test.tsx src/App.tsx
git commit -m "feat(billing): add Subscribe page and /subscribe route"
```

---

### Task 10: `MySubscription` page + `/minha-assinatura` route

**Files:**
- Create: `src/pages/MySubscription.tsx`
- Create: `src/__tests__/MySubscription.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `getMySubscription`, `cancelSubscription` from `../utils/subscription` (Task 7); `Subscription` type (Task 7); `useAuthStore` (`user`).
- Produces: `MySubscription` default export; route `/minha-assinatura`, wrapped in `RequireSubscription` (Task 8).

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/MySubscription.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MySubscription from '../pages/MySubscription'

const { getMySubscriptionMock, cancelSubscriptionMock } = vi.hoisted(() => ({
  getMySubscriptionMock: vi.fn(),
  cancelSubscriptionMock: vi.fn(),
}))

vi.mock('../utils/subscription', () => ({
  getMySubscription: getMySubscriptionMock,
  cancelSubscription: cancelSubscriptionMock,
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1' } }),
}))

describe('MySubscription', () => {
  beforeEach(() => {
    getMySubscriptionMock.mockReset()
    cancelSubscriptionMock.mockReset()
    window.confirm = vi.fn(() => true)
    window.alert = vi.fn()
  })

  it('mostra o status e a próxima cobrança de uma assinatura ativa', async () => {
    getMySubscriptionMock.mockResolvedValueOnce({
      id: 's1',
      user_id: 'u1',
      preapproval_id: 'p1',
      status: 'authorized',
      next_payment_date: '2026-08-18T00:00:00.000Z',
      created_at: '',
      updated_at: '',
    })

    render(
      <MemoryRouter initialEntries={['/minha-assinatura']}>
        <Routes>
          <Route path="/minha-assinatura" element={<MySubscription />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Ativa')).not.toBeNull()
    expect(screen.getByText('Cancelar assinatura')).not.toBeNull()
  })

  it('cancela a assinatura ao confirmar', async () => {
    getMySubscriptionMock.mockResolvedValueOnce({
      id: 's1', user_id: 'u1', preapproval_id: 'p1', status: 'authorized',
      next_payment_date: null, created_at: '', updated_at: '',
    })
    cancelSubscriptionMock.mockResolvedValueOnce({ ok: true, error: null })
    getMySubscriptionMock.mockResolvedValueOnce({
      id: 's1', user_id: 'u1', preapproval_id: 'p1', status: 'cancelled',
      next_payment_date: null, created_at: '', updated_at: '',
    })

    render(
      <MemoryRouter initialEntries={['/minha-assinatura']}>
        <Routes>
          <Route path="/minha-assinatura" element={<MySubscription />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByText('Cancelar assinatura'))

    await waitFor(() => expect(cancelSubscriptionMock).toHaveBeenCalled())
    expect(await screen.findByText('Cancelada')).not.toBeNull()
  })

  it('mostra mensagem quando não há assinatura', async () => {
    getMySubscriptionMock.mockResolvedValueOnce(null)

    render(
      <MemoryRouter initialEntries={['/minha-assinatura']}>
        <Routes>
          <Route path="/minha-assinatura" element={<MySubscription />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Nenhuma assinatura encontrada.')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/MySubscription.test.tsx`
Expected: FAIL — `Cannot find module '../pages/MySubscription'`.

- [ ] **Step 3: Implement `MySubscription.tsx`**

Create `src/pages/MySubscription.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getMySubscription, cancelSubscription } from '../utils/subscription'
import { Subscription } from '../types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pagamento pendente',
  authorized: 'Ativa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
}

export default function MySubscription() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    if (!user) return
    setLoading(true)
    const data = await getMySubscription(user.id)
    setSubscription(data)
    setLoading(false)
  }

  const handleCancel = async () => {
    if (!window.confirm('Tem certeza que deseja cancelar sua assinatura?')) return
    setCancelling(true)
    const { ok, error } = await cancelSubscription()
    if (!ok) {
      alert(`Erro ao cancelar assinatura. ${error || ''}`)
    } else {
      alert('Assinatura cancelada.')
      await load()
    }
    setCancelling(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-purple-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <button onClick={() => navigate('/profile')} className="mr-4 p-2 rounded-lg hover:bg-white/50 transition">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Minha assinatura</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          {subscription ? (
            <>
              <div className="mb-4">
                <div className="text-sm text-gray-500">Status</div>
                <div className="text-lg font-bold text-gray-900">{STATUS_LABELS[subscription.status] || subscription.status}</div>
              </div>
              {subscription.status === 'authorized' && subscription.next_payment_date && (
                <div className="mb-6">
                  <div className="text-sm text-gray-500">Próxima cobrança</div>
                  <div className="text-gray-900">{new Date(subscription.next_payment_date).toLocaleDateString('pt-BR')}</div>
                </div>
              )}
              {subscription.status !== 'cancelled' && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {cancelling ? 'Cancelando...' : 'Cancelar assinatura'}
                </button>
              )}
            </>
          ) : (
            <p className="text-gray-600">Nenhuma assinatura encontrada.</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/MySubscription.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the route in `App.tsx`**

Add the lazy import with the others:
```ts
const MySubscription = lazy(() => import('./pages/MySubscription'))
```
Import `RequireSubscription`:
```ts
import RequireSubscription from './components/RequireSubscription'
```
Add the route, wrapped:
```tsx
          <Route path="/minha-assinatura" element={<RequireSubscription><MySubscription /></RequireSubscription>} />
```

- [ ] **Step 6: Verify the project typechecks**

Run: `npm run check`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/pages/MySubscription.tsx src/__tests__/MySubscription.test.tsx src/App.tsx
git commit -m "feat(billing): add MySubscription page and /minha-assinatura route"
```

---

### Task 11: Gate existing content routes behind `RequireSubscription`

**Files:**
- Modify: `src/App.tsx`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `RequireSubscription` (Task 8), already imported in Task 10.

- [ ] **Step 1: Wrap the content routes**

In `src/App.tsx`, wrap `/home`, `/hiit`, `/workout/:day`, `/progress`, and `/profile` in `RequireSubscription` (leave `/login`, `/register`, `/forgot`, `/reset-confirm`, `/reset`, and `/subscribe` unwrapped; leave `/admin*` wrapped only in `RequireAdmin` as today, since `RequireAdmin` already restricts to `is_admin = true`, who are unconditionally exempt):

```tsx
          <Route path="/profile" element={<RequireSubscription><Profile /></RequireSubscription>} />
          <Route path="/home" element={<RequireSubscription><Home /></RequireSubscription>} />
          <Route path="/hiit" element={<RequireSubscription><HIIT /></RequireSubscription>} />
          <Route path="/workout/:day" element={<RequireSubscription><WorkoutDay /></RequireSubscription>} />
          <Route path="/progress" element={<RequireSubscription><Progress /></RequireSubscription>} />
```

- [ ] **Step 2: Document the new environment variables**

Update `.env.example` to:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Server-only (Vercel Serverless Functions) — never prefix with VITE_, never commit real values
SUPABASE_SERVICE_ROLE_KEY=
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
MERCADOPAGO_PREAPPROVAL_PLAN_ID=
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: every billing-related test file passes (Tasks 2, 4, 5, 6, 7, 8, 9, 10 — 30 new tests total); the pre-existing unrelated failures in `Dashboard.test.tsx`/`Register.test.tsx`/`WorkoutDay.test.tsx` are the only failures (same known-unrelated set from the admin-dashboard work — confirm via `git diff main -- src/__tests__/Dashboard.test.tsx src/__tests__/Register.test.tsx src/__tests__/WorkoutDay.test.tsx` showing no changes to those files).

- [ ] **Step 4: Verify the project builds**

Run: `npm run build`
Expected: exits 0. This is the first build that also compiles `api/` (already covered by `tsconfig.json`'s `include`) — confirm no TypeScript errors surface from the new server-side files.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx .env.example
git commit -m "feat(billing): gate content routes behind RequireSubscription"
```

---

### Task 12: Vercel environment setup and live end-to-end verification — **requires live user interaction**

**Files:** none (configuration + manual verification only).

**Do not delegate this task to an autonomous subagent.** It requires the user's real Mercado Pago test Access Token and webhook secret, a real deploy, and a real browser walkthrough — the same category of action as the Supabase env var setup done earlier in this project (`vercel env add`), which the permission system blocked from being done via a relayed subagent message and required the coordinating agent to execute directly after explicit, fresh user confirmation.

- [ ] **Step 1: Deploy to a preview environment first**

Push the branch and let Vercel build a Preview deployment (do not target `main`/production yet) — confirm `npm run build`-equivalent succeeds on Vercel's infrastructure, not just locally.

- [ ] **Step 2: Configure the webhook URL in Mercado Pago**

Now that a real deployed URL exists, ask the user to go back to **Suas integrações → app → Webhooks → Configurar notificações** and set the test-mode webhook URL to `https://<preview-or-prod-domain>/api/mercadopago-webhook`, select the subscription events, save, and copy the generated secret.

- [ ] **Step 3: Add the four new environment variables to Vercel**

With explicit user confirmation for each (mirroring the earlier Supabase env var setup in this project), run for Production, Preview, and Development:
```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add MERCADOPAGO_ACCESS_TOKEN production
vercel env add MERCADOPAGO_WEBHOOK_SECRET production
vercel env add MERCADOPAGO_PREAPPROVAL_PLAN_ID production
```
(repeat for `preview` and `development`) — the coordinating agent should get the user to paste each value themselves via the CLI's interactive prompt or provide it directly at the moment of running, never asking the user to paste secrets into the chat.

- [ ] **Step 4: Redeploy**

```bash
vercel deploy --prod --yes
```
(only after explicit user confirmation, same as the earlier production redeploy in this project)

- [ ] **Step 5: Manual walkthrough with Mercado Pago test credentials**

Using a real logged-in non-admin test account:
1. Confirm `/home` redirects to `/subscribe` (no subscription yet).
2. Click "Assinar agora", complete checkout on Mercado Pago's sandbox using one of Mercado Pago's published test card numbers (ask the user to pull the current test card list from their dashboard's test-credentials page, since these values rotate).
3. Confirm the browser returns to `/subscribe` and either auto-redirects to `/home` (webhook landed fast) or shows the "confirming payment" polling state that resolves within the 45s window.
4. Confirm `/home` and other content routes now load normally.
5. Open `/minha-assinatura`, confirm status shows "Ativa" and a next-payment date.
6. Click "Cancelar assinatura", confirm the status updates to "Cancelada".
7. Confirm content routes now redirect back to `/subscribe` again.
8. Log in as the admin account, confirm **no** redirect ever happens regardless of subscription state.

- [ ] **Step 6: Confirm the RLS defense-in-depth actually holds**

Repeat Task 1 Step 4's anon-key check against `workouts` — also run it with a **real non-subscribed authenticated user's** access token (not just anon) to confirm the `AND (has_active_subscription() OR is_admin())` addition to `user_progress`'s self-view policy actually blocks a logged-in-but-unsubscribed user from reading their own progress rows via a direct API call, not just via the UI.

- [ ] **Step 7: Report results**

Confirm with the user that all checks in Steps 5–6 passed before considering the feature complete. If Mercado Pago's actual `back_url` return params differ from what `Subscribe.tsx` assumed (Task 9's flagged uncertainty), fix that specific detail now with real observed evidence rather than guessing further.

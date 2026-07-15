# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the app owner (identified as `ataide.junior.mg@gmail.com`) edit workout content (title, day video, and per-exercise fields) and view a read-only list of non-admin users, from inside the existing Musa Fit30 SPA.

**Architecture:** A new `public.profiles` table (populated by an `auth.users` trigger + one-time backfill) stores the `is_admin` flag and is the sole source of truth for authorization — enforced by Postgres RLS on `profiles`, `workouts` (UPDATE), and `user_progress` (SELECT). The React app reads `is_admin` into `authStore` after login and uses it only for UX (hiding the admin link, redirecting non-admins away from `/admin/*`); the database is what actually blocks unauthorized writes/reads.

**Tech Stack:** React 18 + TypeScript, Vite, React Router v7, Zustand, Supabase (Postgres + Auth), Tailwind CSS, lucide-react icons, Vitest + Testing Library.

## Global Constraints

- No new npm dependencies. Reordering exercises uses plain up/down buttons (no drag-and-drop library); save/error feedback uses `alert()`, matching the existing pattern in `src/utils/plans.ts` and `src/pages/Home.tsx`.
- New files use relative imports (`../utils/...`), matching the convention used everywhere in `src/pages`, `src/utils`, `src/store` (the `@/` alias exists but is only used in the unrelated `src/components/Empty.tsx` scaffold file).
- New pages live under `src/pages/admin/`; new data-access utils live under `src/utils/`, one file per concern, following the existing pattern (`workouts.ts`, `plans.ts`, etc.).
- Tests live under `src/__tests__/`, using Vitest + `@testing-library/react` + `vi.mock`, matching `WorkoutDay.test.tsx` / `Register.test.tsx`. Run single files with `npx vitest run <path>` (non-interactive; plain `npm test` starts watch mode).
- Database changes are applied only through new timestamped migration files (`supabase/migrations/<timestamp>_name.sql`) run via the already-linked Supabase CLI (`supabase db query --linked --file ...`). Never use the `service_role` key directly — the CLI's own elevated access is what applies DDL/DML here, consistent with how the `pdf_plans` RLS fix was done earlier in this project.
- The `is_admin` flag is never writable from the client (no INSERT/UPDATE/DELETE RLS policy on `profiles` for any client role) — it only changes via direct SQL run through the CLI.
- `tsconfig.json` has `strict: false` project-wide; write correctly-typed code but don't over-engineer around strict-mode edge cases the rest of the codebase doesn't handle either.
- Frontend route guards (`RequireAdmin`) are UX only — the real authorization boundary is Postgres RLS. Every task that touches access control must be understood in that light.

---

### Task 1: Database migration — `profiles`, trigger, backfill, RLS

**Files:**
- Create: `supabase/migrations/20260715090000_admin_dashboard.sql`

**Interfaces:**
- Produces: table `public.profiles(id uuid pk, email text, username text, is_admin boolean default false, created_at timestamptz)`; RLS policies gating `profiles` SELECT, `workouts` UPDATE, and an additional `user_progress` SELECT policy — all keyed off `profiles.is_admin`. Later tasks (2, 4, 7) query `profiles`, and write to `workouts`, assuming these exist.

- [ ] **Step 1: Write the migration file**

```sql
-- Admin dashboard: profiles table (role storage), auth trigger + backfill,
-- and RLS so only is_admin=true users can write workouts / read all progress.

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT ON public.profiles TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile, admins view all" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, created_at)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'username', NEW.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users (the trigger above only covers future signups)
INSERT INTO public.profiles (id, email, username, created_at)
SELECT id, email, raw_user_meta_data->>'username', created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;

GRANT UPDATE ON public.workouts TO authenticated;

CREATE POLICY "Admins can update workouts" ON public.workouts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "Admins can view all progress" ON public.user_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
```

- [ ] **Step 2: Apply the migration to the linked project**

Run: `supabase db query --linked --file supabase/migrations/20260715090000_admin_dashboard.sql`
Expected: JSON response with `"rows": []` and no `"_tag":"Error"` key.

- [ ] **Step 3: Verify structure (trigger, policies, backfill count) via the CLI**

Run:
```
supabase db query --linked "SELECT (SELECT count(*) FROM auth.users) AS auth_users_count, (SELECT count(*) FROM public.profiles) AS profiles_count, (SELECT count(*) FROM pg_trigger WHERE tgname = 'on_auth_user_created') AS trigger_count, (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.profiles'::regclass) AS profiles_policy_count, (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.workouts'::regclass AND polcmd = 'w') AS workouts_update_policy_count, (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.user_progress'::regclass AND polcmd = 'r') AS user_progress_select_policy_count;"
```
Expected row: `auth_users_count` equals `profiles_count` (backfill covered everyone), `trigger_count: 1`, `profiles_policy_count: 1`, `workouts_update_policy_count: 1`, `user_progress_select_policy_count: 2` (the pre-existing self-view policy plus the new admin-view one).

- [ ] **Step 4: Verify anonymous (unauthenticated) access is blocked**

Create `_tmp_check_profiles_anon.mjs` in the project root:
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
const { data, error } = await supabase.from('profiles').select('*');
console.log('data:', data);
console.log('error:', error);
```
Run: `node _tmp_check_profiles_anon.mjs`
Expected: `error` is not `null` (permission denied — `profiles` has no `GRANT ... TO anon`) and `data` is `null`.
Then delete the file: `rm _tmp_check_profiles_anon.mjs`

- [ ] **Step 5: Promote the initial admin account**

Run: `supabase db query --linked "UPDATE public.profiles SET is_admin = true WHERE email = 'ataide.junior.mg@gmail.com' RETURNING email, is_admin;"`
Expected: one row returned with `is_admin: true`. If zero rows are returned, STOP — it means no `auth.users` row exists yet for that email (the account hasn't signed up in this Supabase project); ask the user to confirm the correct email or sign up first before continuing.

- [ ] **Step 6: Commit the migration**

```bash
git add supabase/migrations/20260715090000_admin_dashboard.sql
git commit -m "feat(db): add profiles table, admin trigger, and admin RLS policies"
```

---

### Task 2: `authStore.isAdmin` + `utils/profile.ts` + wire into `App.tsx`

**Files:**
- Create: `src/utils/profile.ts`
- Create: `src/__tests__/profile.test.ts`
- Modify: `src/store/authStore.ts`
- Modify: `src/App.tsx:1-59`

**Interfaces:**
- Consumes: `supabase` from `../lib/supabase` (existing).
- Produces: `getIsAdmin(userId: string): Promise<boolean>` from `src/utils/profile.ts`; `useAuthStore` state gains `isAdmin: boolean` and `setIsAdmin(isAdmin: boolean): void`. Tasks 3, 5, 6, 8, 9 read `isAdmin` off `useAuthStore`.

- [ ] **Step 1: Write the failing test for `getIsAdmin`**

Create `src/__tests__/profile.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'

const singleMock = vi.fn()
const eqMock = vi.fn(() => ({ single: singleMock }))
const selectMock = vi.fn(() => ({ eq: eqMock }))
const fromMock = vi.fn(() => ({ select: selectMock }))

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

import { getIsAdmin } from '../utils/profile'

describe('getIsAdmin', () => {
  it('retorna true quando is_admin é true', async () => {
    singleMock.mockResolvedValueOnce({ data: { is_admin: true }, error: null })
    const result = await getIsAdmin('u1')
    expect(fromMock).toHaveBeenCalledWith('profiles')
    expect(eqMock).toHaveBeenCalledWith('id', 'u1')
    expect(result).toBe(true)
  })

  it('retorna false quando is_admin é false', async () => {
    singleMock.mockResolvedValueOnce({ data: { is_admin: false }, error: null })
    const result = await getIsAdmin('u2')
    expect(result).toBe(false)
  })

  it('retorna false quando há erro na consulta', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: new Error('not found') })
    const result = await getIsAdmin('u3')
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/profile.test.ts`
Expected: FAIL — `Cannot find module '../utils/profile'` (file doesn't exist yet).

- [ ] **Step 3: Implement `src/utils/profile.ts`**

```ts
import { supabase } from '../lib/supabase'

export const getIsAdmin = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()

  if (error || !data) return false
  return !!data.is_admin
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/profile.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add `isAdmin` to `authStore`**

Modify `src/store/authStore.ts` to the full contents:
```ts
import { create } from 'zustand'
import { User } from '../types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isAdmin: boolean
  setUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
  setIsAdmin: (isAdmin: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isAdmin: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  logout: () => set({ user: null, isAuthenticated: false, isAdmin: false }),
}))
```

- [ ] **Step 6: Wire `getIsAdmin` into `App.tsx`'s auth check**

Modify `src/App.tsx`. Add the import (near the other util imports at the top):
```ts
import { getIsAdmin } from './utils/profile'
```

Replace the `checkAuth` function (currently `src/App.tsx:23-56`) with:
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
          await persistCurrentSession()
        } else {
          const restored = await tryRestoreSession()
          if (restored) {
            const u = await getCurrentUser()
            if (u) {
              setUser(u)
              setIsAdmin(await getIsAdmin(u.id))
              await persistCurrentSession()
            } else {
              setUser(null)
              setIsAdmin(false)
            }
          } else {
            setUser(null)
            setIsAdmin(false)
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setUser(null)
        setIsAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }
```

Update the destructuring on `src/App.tsx:20` from:
```ts
  const { setUser, setIsLoading } = useAuthStore()
```
to:
```ts
  const { setUser, setIsLoading, setIsAdmin } = useAuthStore()
```

- [ ] **Step 7: Verify the whole project still typechecks**

Run: `npm run check`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/utils/profile.ts src/__tests__/profile.test.ts src/store/authStore.ts src/App.tsx
git commit -m "feat(auth): track isAdmin in authStore from profiles.is_admin"
```

---

### Task 3: `RequireAdmin` route guard

**Files:**
- Create: `src/components/RequireAdmin.tsx`
- Create: `src/__tests__/RequireAdmin.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore` (`isAdmin`, `isLoading`) from `../store/authStore`.
- Produces: `RequireAdmin` default export, a component taking `{ children: JSX.Element }`, used by Tasks 5, 6, 8, 9 to wrap admin routes in `App.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/RequireAdmin.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RequireAdmin from '../components/RequireAdmin'

const mockState = { isAdmin: false, isLoading: false }
vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockState,
}))

describe('RequireAdmin', () => {
  it('redireciona para /home quando não é admin', async () => {
    mockState.isAdmin = false
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin/users" element={<RequireAdmin><div>Admin Content</div></RequireAdmin>} />
          <Route path="/home" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Home Page')).toBeInTheDocument()
  })

  it('renderiza o conteúdo quando é admin', async () => {
    mockState.isAdmin = true
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin/users" element={<RequireAdmin><div>Admin Content</div></RequireAdmin>} />
          <Route path="/home" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Admin Content')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/RequireAdmin.test.tsx`
Expected: FAIL — `Cannot find module '../components/RequireAdmin'`.

- [ ] **Step 3: Implement `RequireAdmin`**

Create `src/components/RequireAdmin.tsx`:
```tsx
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function RequireAdmin({ children }: { children: JSX.Element }) {
  const { isAdmin, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-purple-600 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/home" replace />
  }

  return children
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/RequireAdmin.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/RequireAdmin.tsx src/__tests__/RequireAdmin.test.tsx
git commit -m "feat(admin): add RequireAdmin route guard"
```

---

### Task 4: `src/utils/adminWorkouts.ts`

**Files:**
- Create: `src/utils/adminWorkouts.ts`
- Create: `src/__tests__/adminWorkouts.test.ts`

**Interfaces:**
- Consumes: `supabase` from `../lib/supabase`; `Workout`, `Exercise` from `../types`.
- Produces: `listWorkoutsAdmin(): Promise<Workout[]>`, `WorkoutUpdatePayload` interface, `updateWorkoutAdmin(day: number, payload: WorkoutUpdatePayload): Promise<void>`. Tasks 5 and 6 consume these.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/adminWorkouts.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'

const orderMock = vi.fn()
const selectMock = vi.fn(() => ({ order: orderMock }))
const eqMock = vi.fn()
const updateMock = vi.fn(() => ({ eq: eqMock }))
const fromMock = vi.fn(() => ({ select: selectMock, update: updateMock }))

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

import { listWorkoutsAdmin, updateWorkoutAdmin } from '../utils/adminWorkouts'

describe('listWorkoutsAdmin', () => {
  it('retorna os treinos ordenados por dia', async () => {
    orderMock.mockResolvedValueOnce({
      data: [{ day_number: 2, title: 'Dia 2' }, { day_number: 1, title: 'Dia 1' }],
      error: null,
    })

    const result = await listWorkoutsAdmin()

    expect(fromMock).toHaveBeenCalledWith('workouts')
    expect(selectMock).toHaveBeenCalledWith('*')
    expect(orderMock).toHaveBeenCalledWith('day_number', { ascending: true })
    expect(result).toHaveLength(2)
  })

  it('lança erro quando a query falha', async () => {
    orderMock.mockResolvedValueOnce({ data: null, error: new Error('boom') })
    await expect(listWorkoutsAdmin()).rejects.toThrow('boom')
  })
})

describe('updateWorkoutAdmin', () => {
  it('atualiza o treino do dia informado', async () => {
    eqMock.mockResolvedValueOnce({ error: null })

    await updateWorkoutAdmin(3, { title: 'Novo título', video_url: '', exercises: [] })

    expect(fromMock).toHaveBeenCalledWith('workouts')
    expect(updateMock).toHaveBeenCalledWith({ title: 'Novo título', video_url: '', exercises: [] })
    expect(eqMock).toHaveBeenCalledWith('day_number', 3)
  })

  it('lança erro quando o update falha', async () => {
    eqMock.mockResolvedValueOnce({ error: new Error('falhou') })
    await expect(updateWorkoutAdmin(3, { title: '', video_url: '', exercises: [] })).rejects.toThrow('falhou')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/adminWorkouts.test.ts`
Expected: FAIL — `Cannot find module '../utils/adminWorkouts'`.

- [ ] **Step 3: Implement `src/utils/adminWorkouts.ts`**

```ts
import { supabase } from '../lib/supabase'
import { Workout, Exercise } from '../types'

export const listWorkoutsAdmin = async (): Promise<Workout[]> => {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .order('day_number', { ascending: true })

  if (error) throw error
  return (data || []) as Workout[]
}

export interface WorkoutUpdatePayload {
  title: string
  video_url: string
  exercises: Exercise[]
}

export const updateWorkoutAdmin = async (day: number, payload: WorkoutUpdatePayload): Promise<void> => {
  const { error } = await supabase
    .from('workouts')
    .update(payload)
    .eq('day_number', day)

  if (error) throw error
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/adminWorkouts.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/adminWorkouts.ts src/__tests__/adminWorkouts.test.ts
git commit -m "feat(admin): add adminWorkouts data-access utils"
```

---

### Task 5: `AdminWorkoutList` page + `/admin/workouts` route

**Files:**
- Create: `src/pages/admin/AdminWorkoutList.tsx`
- Create: `src/__tests__/AdminWorkoutList.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `listWorkoutsAdmin` from `../../utils/adminWorkouts` (Task 4); `Workout` from `../../types`; `RequireAdmin` from `./components/RequireAdmin` (Task 3, used in `App.tsx`).
- Produces: `AdminWorkoutList` default export; route `/admin/workouts` registered in `App.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/AdminWorkoutList.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminWorkoutList from '../pages/admin/AdminWorkoutList'

vi.mock('../utils/adminWorkouts', () => ({
  listWorkoutsAdmin: vi.fn(async () => ([
    { id: 'w1', day_number: 1, title: 'Treino Dia 1', video_url: '', exercises: [{ exercise: 'A', reps: '10' }], created_at: '' },
    { id: 'w2', day_number: 2, title: 'Treino Dia 2', video_url: '', exercises: [], created_at: '' },
  ])),
}))

describe('AdminWorkoutList', () => {
  it('lista os treinos com link para edição', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/workouts']}>
        <Routes>
          <Route path="/admin/workouts" element={<AdminWorkoutList />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Treino Dia 1')).toBeInTheDocument()
    const link = screen.getByText('Treino Dia 1').closest('a')
    expect(link).toHaveAttribute('href', '/admin/workouts/1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/AdminWorkoutList.test.tsx`
Expected: FAIL — `Cannot find module '../pages/admin/AdminWorkoutList'`.

- [ ] **Step 3: Implement `AdminWorkoutList`**

Create `src/pages/admin/AdminWorkoutList.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { listWorkoutsAdmin } from '../../utils/adminWorkouts'
import { Workout } from '../../types'

export default function AdminWorkoutList() {
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const data = await listWorkoutsAdmin()
      setWorkouts(data)
    } catch (error) {
      console.error('Error loading workouts:', error)
    } finally {
      setLoading(false)
    }
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
          <button onClick={() => navigate('/admin')} className="mr-4 p-2 rounded-lg hover:bg-white/50 transition">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Treinos</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workouts.map((w) => (
            <Link
              key={w.day_number}
              to={`/admin/workouts/${w.day_number}`}
              className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition block"
            >
              <div className="text-sm text-gray-500 mb-1">Dia {w.day_number}</div>
              <div className="text-lg font-bold text-gray-900 mb-1">{w.title}</div>
              <div className="text-sm text-gray-600">{w.exercises?.length || 0} exercícios</div>
            </Link>
          ))}
        </div>

        {workouts.length === 0 && (
          <p className="text-gray-600 text-center mt-8">Nenhum treino encontrado.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/AdminWorkoutList.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Wire the route in `App.tsx`**

Add this line with the other `lazy` imports near `src/App.tsx:8-17` (the `AdminDashboard` import is added later, in Task 9, alongside the component itself — adding it here would fail `npm run check` since that file doesn't exist yet):
```ts
const AdminWorkoutList = lazy(() => import('./pages/admin/AdminWorkoutList'))
```
Add the import for the guard, near the other non-lazy imports at the top of the file:
```ts
import RequireAdmin from './components/RequireAdmin'
```
Add this route inside `<Routes>` in `src/App.tsx`, right before the `<Route path="/" ...>` catch-all:
```tsx
          <Route path="/admin/workouts" element={<RequireAdmin><AdminWorkoutList /></RequireAdmin>} />
```

- [ ] **Step 6: Verify the project typechecks**

Run: `npm run check`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/AdminWorkoutList.tsx src/__tests__/AdminWorkoutList.test.tsx src/App.tsx
git commit -m "feat(admin): add AdminWorkoutList page and /admin/workouts route"
```

---

### Task 6: `AdminWorkoutEdit` page + `/admin/workouts/:day` route

**Files:**
- Create: `src/pages/admin/AdminWorkoutEdit.tsx`
- Create: `src/__tests__/AdminWorkoutEdit.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `getWorkoutByDay` from `../../utils/workouts` (existing); `updateWorkoutAdmin` from `../../utils/adminWorkouts` (Task 4); `Exercise` from `../../types`.
- Produces: `AdminWorkoutEdit` default export; route `/admin/workouts/:day` registered in `App.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/AdminWorkoutEdit.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminWorkoutEdit from '../pages/admin/AdminWorkoutEdit'

const updateWorkoutAdminMock = vi.fn(async () => {})

vi.mock('../utils/workouts', () => ({
  getWorkoutByDay: vi.fn(async () => ({
    id: 'w1',
    day_number: 1,
    title: 'Treino Dia 1',
    video_url: 'https://example.com/video.mp4',
    exercises: [
      { exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal' },
    ],
    created_at: '',
  })),
}))

vi.mock('../utils/adminWorkouts', () => ({
  updateWorkoutAdmin: (...args: unknown[]) => updateWorkoutAdminMock(...args),
}))

describe('AdminWorkoutEdit', () => {
  it('carrega o treino e salva as alterações', async () => {
    window.alert = vi.fn()

    render(
      <MemoryRouter initialEntries={['/admin/workouts/1']}>
        <Routes>
          <Route path="/admin/workouts/:day" element={<AdminWorkoutEdit />} />
        </Routes>
      </MemoryRouter>
    )

    const titleInput = await screen.findByDisplayValue('Treino Dia 1')
    fireEvent.change(titleInput, { target: { value: 'Treino Atualizado' } })

    fireEvent.click(screen.getByText('Salvar alterações'))

    await waitFor(() => {
      expect(updateWorkoutAdminMock).toHaveBeenCalledWith(1, {
        title: 'Treino Atualizado',
        video_url: 'https://example.com/video.mp4',
        exercises: [{ exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal' }],
      })
    })
  })

  it('adiciona um novo exercício vazio ao clicar em Adicionar exercício', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/workouts/1']}>
        <Routes>
          <Route path="/admin/workouts/:day" element={<AdminWorkoutEdit />} />
        </Routes>
      </MemoryRouter>
    )

    await screen.findByDisplayValue('Treino Dia 1')
    const before = screen.getAllByPlaceholderText('Nome do exercício').length
    fireEvent.click(screen.getByText('Adicionar exercício'))
    const after = screen.getAllByPlaceholderText('Nome do exercício').length
    expect(after).toBe(before + 1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/AdminWorkoutEdit.test.tsx`
Expected: FAIL — `Cannot find module '../pages/admin/AdminWorkoutEdit'`.

- [ ] **Step 3: Implement `AdminWorkoutEdit`**

Create `src/pages/admin/AdminWorkoutEdit.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, ArrowUp, ArrowDown, Plus } from 'lucide-react'
import { getWorkoutByDay } from '../../utils/workouts'
import { updateWorkoutAdmin } from '../../utils/adminWorkouts'
import { Exercise } from '../../types'

const EMPTY_EXERCISE: Exercise = { exercise: '', reps: '', sets: '', note: '', group: '', type: 'normal', video: '' }

export default function AdminWorkoutEdit() {
  const { day } = useParams<{ day: string }>()
  const navigate = useNavigate()
  const dayNumber = parseInt(day || '1')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])

  useEffect(() => {
    load()
  }, [dayNumber])

  const load = async () => {
    setLoading(true)
    try {
      const workout = await getWorkoutByDay(dayNumber)
      if (workout) {
        setTitle(workout.title)
        setVideoUrl(workout.video_url || '')
        setExercises(workout.exercises || [])
      }
    } catch (error) {
      console.error('Error loading workout:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateExercise = (index: number, patch: Partial<Exercise>) => {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)))
  }

  const moveExercise = (index: number, direction: -1 | 1) => {
    setExercises((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index))
  }

  const addExercise = () => {
    setExercises((prev) => [...prev, { ...EMPTY_EXERCISE }])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateWorkoutAdmin(dayNumber, { title, video_url: videoUrl, exercises })
      alert('Treino atualizado com sucesso!')
    } catch (error: any) {
      alert(`Erro ao salvar treino. ${error?.message || ''}`)
    } finally {
      setSaving(false)
    }
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
      <div className="max-w-4xl mx-auto px-4 py-8 pb-32">
        <div className="flex items-center mb-8">
          <button onClick={() => navigate('/admin/workouts')} className="mr-4 p-2 rounded-lg hover:bg-white/50 transition">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Editar Dia {dayNumber}</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="workout-title">Título</label>
            <input
              id="workout-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="workout-video">Vídeo do dia (URL)</label>
            <input
              id="workout-video"
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Exercícios</h2>
          <div className="space-y-4">
            {exercises.map((ex, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500">Exercício {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => moveExercise(index, -1)} aria-label="Mover para cima" className="p-1 rounded hover:bg-gray-100">
                      <ArrowUp className="w-4 h-4 text-gray-600" />
                    </button>
                    <button type="button" onClick={() => moveExercise(index, 1)} aria-label="Mover para baixo" className="p-1 rounded hover:bg-gray-100">
                      <ArrowDown className="w-4 h-4 text-gray-600" />
                    </button>
                    <button type="button" onClick={() => removeExercise(index)} aria-label="Remover exercício" className="p-1 rounded hover:bg-red-50">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nome do exercício"
                    value={ex.exercise}
                    onChange={(e) => updateExercise(index, { exercise: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Repetições"
                    value={ex.reps}
                    onChange={(e) => updateExercise(index, { reps: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Séries"
                    value={ex.sets || ''}
                    onChange={(e) => updateExercise(index, { sets: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Nota"
                    value={ex.note || ''}
                    onChange={(e) => updateExercise(index, { note: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Vídeo (URL)"
                    value={ex.video || ''}
                    onChange={(e) => updateExercise(index, { video: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Grupo (bi-set)"
                    value={ex.group || ''}
                    onChange={(e) => updateExercise(index, { group: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <select
                    value={ex.type || 'normal'}
                    onChange={(e) => updateExercise(index, { type: e.target.value as Exercise['type'] })}
                    className="border border-gray-300 rounded-lg px-3 py-2 md:col-span-2"
                  >
                    <option value="normal">Normal</option>
                    <option value="warmup">Aquecimento</option>
                    <option value="drop_set">Drop-set</option>
                    <option value="core">Core</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addExercise}
            className="mt-4 inline-flex items-center px-4 py-2 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            <Plus className="w-4 h-4 mr-1" /> Adicionar exercício
          </button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-purple-600 text-white py-4 px-6 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition font-medium text-lg"
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/AdminWorkoutEdit.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the route in `App.tsx`**

Add the lazy import next to the `AdminWorkoutList` one added in Task 5:
```ts
const AdminWorkoutEdit = lazy(() => import('./pages/admin/AdminWorkoutEdit'))
```
Add the route right after `/admin/workouts` in `src/App.tsx`:
```tsx
          <Route path="/admin/workouts/:day" element={<RequireAdmin><AdminWorkoutEdit /></RequireAdmin>} />
```

- [ ] **Step 6: Verify the project typechecks**

Run: `npm run check`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/AdminWorkoutEdit.tsx src/__tests__/AdminWorkoutEdit.test.tsx src/App.tsx
git commit -m "feat(admin): add AdminWorkoutEdit page and /admin/workouts/:day route"
```

---

### Task 7: `src/utils/adminUsers.ts`

**Files:**
- Create: `src/utils/adminUsers.ts`
- Create: `src/__tests__/adminUsers.test.ts`

**Interfaces:**
- Consumes: `supabase` from `../lib/supabase`.
- Produces: `AdminUserSummary` interface (`id`, `email`, `username`, `created_at`, `completedDays`), `listNonAdminUsers(): Promise<AdminUserSummary[]>`. Task 8 consumes both.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/adminUsers.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'

const profilesOrderMock = vi.fn()
const profilesEqMock = vi.fn(() => ({ order: profilesOrderMock }))
const profilesSelectMock = vi.fn(() => ({ eq: profilesEqMock }))

const progressEqMock = vi.fn()
const progressInMock = vi.fn(() => ({ eq: progressEqMock }))
const progressSelectMock = vi.fn(() => ({ in: progressInMock }))

const fromMock = vi.fn((table: string) => {
  if (table === 'profiles') return { select: profilesSelectMock }
  if (table === 'user_progress') return { select: progressSelectMock }
  throw new Error(`unexpected table ${table}`)
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

import { listNonAdminUsers } from '../utils/adminUsers'

describe('listNonAdminUsers', () => {
  it('retorna usuários com contagem de dias completos', async () => {
    profilesOrderMock.mockResolvedValueOnce({
      data: [
        { id: 'u1', email: 'ana@example.com', username: 'Ana', created_at: '2026-01-01' },
        { id: 'u2', email: 'bea@example.com', username: null, created_at: '2026-02-01' },
      ],
      error: null,
    })
    progressEqMock.mockResolvedValueOnce({
      data: [{ user_id: 'u1' }, { user_id: 'u1' }, { user_id: 'u2' }],
      error: null,
    })

    const result = await listNonAdminUsers()

    expect(profilesEqMock).toHaveBeenCalledWith('is_admin', false)
    expect(progressInMock).toHaveBeenCalledWith('user_id', ['u1', 'u2'])
    expect(result).toEqual([
      { id: 'u1', email: 'ana@example.com', username: 'Ana', created_at: '2026-01-01', completedDays: 2 },
      { id: 'u2', email: 'bea@example.com', username: null, created_at: '2026-02-01', completedDays: 1 },
    ])
  })

  it('retorna lista vazia sem consultar progresso quando não há usuários', async () => {
    profilesOrderMock.mockResolvedValueOnce({ data: [], error: null })

    const result = await listNonAdminUsers()

    expect(result).toEqual([])
    expect(progressSelectMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/adminUsers.test.ts`
Expected: FAIL — `Cannot find module '../utils/adminUsers'`.

- [ ] **Step 3: Implement `src/utils/adminUsers.ts`**

```ts
import { supabase } from '../lib/supabase'

export interface AdminUserSummary {
  id: string
  email: string
  username: string | null
  created_at: string
  completedDays: number
}

export const listNonAdminUsers = async (): Promise<AdminUserSummary[]> => {
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, username, created_at')
    .eq('is_admin', false)
    .order('created_at', { ascending: false })

  if (profilesError) throw profilesError
  const rows = profiles || []
  if (rows.length === 0) return []

  const ids = rows.map((p: any) => p.id)
  const { data: progress, error: progressError } = await supabase
    .from('user_progress')
    .select('user_id')
    .in('user_id', ids)
    .eq('completed', true)

  if (progressError) throw progressError

  const counts = new Map<string, number>()
  for (const row of progress || []) {
    counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1)
  }

  return rows.map((p: any) => ({
    id: p.id,
    email: p.email,
    username: p.username,
    created_at: p.created_at,
    completedDays: counts.get(p.id) || 0,
  }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/adminUsers.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/adminUsers.ts src/__tests__/adminUsers.test.ts
git commit -m "feat(admin): add adminUsers data-access utils"
```

---

### Task 8: `AdminUsers` page + `/admin/users` route

**Files:**
- Create: `src/pages/admin/AdminUsers.tsx`
- Create: `src/__tests__/AdminUsers.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `listNonAdminUsers`, `AdminUserSummary` from `../../utils/adminUsers` (Task 7).
- Produces: `AdminUsers` default export; route `/admin/users` registered in `App.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/AdminUsers.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminUsers from '../pages/admin/AdminUsers'

vi.mock('../utils/adminUsers', () => ({
  listNonAdminUsers: vi.fn(async () => ([
    { id: 'u1', email: 'ana@example.com', username: 'Ana', created_at: '2026-01-01T00:00:00.000Z', completedDays: 5 },
  ])),
}))

describe('AdminUsers', () => {
  it('lista usuárias com progresso', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin/users" element={<AdminUsers />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('ana@example.com')).toBeInTheDocument()
    expect(screen.getByText('5/30')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/AdminUsers.test.tsx`
Expected: FAIL — `Cannot find module '../pages/admin/AdminUsers'`.

- [ ] **Step 3: Implement `AdminUsers`**

Create `src/pages/admin/AdminUsers.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { listNonAdminUsers, AdminUserSummary } from '../../utils/adminUsers'

export default function AdminUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const data = await listNonAdminUsers()
      setUsers(data)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
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
          <button onClick={() => navigate('/admin')} className="mr-4 p-2 rounded-lg hover:bg-white/50 transition">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Usuárias</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Username</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Cadastro</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Progresso</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 text-gray-900">{u.email}</td>
                  <td className="px-4 py-3 text-gray-700">{u.username || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-700">{u.completedDays}/30</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <p className="text-gray-600 text-center mt-8">Nenhuma usuária cadastrada ainda.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/AdminUsers.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Wire the route in `App.tsx`**

Add the lazy import next to the others added in Tasks 5 and 6:
```ts
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
```
Add the route in `src/App.tsx`, after `/admin/workouts/:day`:
```tsx
          <Route path="/admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
```

- [ ] **Step 6: Verify the project typechecks**

Run: `npm run check`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/AdminUsers.tsx src/__tests__/AdminUsers.test.tsx src/App.tsx
git commit -m "feat(admin): add AdminUsers page and /admin/users route"
```

---

### Task 9: `AdminDashboard` page + `/admin` route + Profile.tsx entry link

**Files:**
- Create: `src/pages/admin/AdminDashboard.tsx`
- Create: `src/__tests__/AdminDashboard.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/Profile.tsx`

**Interfaces:**
- Consumes: `useAuthStore` (`isAdmin`) from `../store/authStore` (used in `Profile.tsx`).
- Produces: `AdminDashboard` default export; route `/admin` registered in `App.tsx`; a conditional "Painel Admin" link in `Profile.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/AdminDashboard.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminDashboard from '../pages/admin/AdminDashboard'

describe('AdminDashboard', () => {
  it('navega para /admin/workouts ao clicar em Treinos', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/workouts" element={<div>Workouts Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Treinos'))
    expect(screen.getByText('Workouts Page')).toBeInTheDocument()
  })

  it('navega para /admin/users ao clicar em Usuárias', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<div>Users Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Usuárias'))
    expect(screen.getByText('Users Page')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/AdminDashboard.test.tsx`
Expected: FAIL — `Cannot find module '../pages/admin/AdminDashboard'`.

- [ ] **Step 3: Implement `AdminDashboard`**

Create `src/pages/admin/AdminDashboard.tsx`:
```tsx
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Dumbbell, Users } from 'lucide-react'

export default function AdminDashboard() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <button onClick={() => navigate('/profile')} className="mr-4 p-2 rounded-lg hover:bg-white/50 transition">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Painel Admin</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/admin/workouts')}
            className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl transition"
          >
            <Dumbbell className="w-8 h-8 text-purple-600 mb-3" />
            <div className="text-lg font-bold text-gray-900 mb-1">Treinos</div>
            <div className="text-sm text-gray-600">Editar título, vídeo e exercícios de cada dia</div>
          </button>

          <button
            onClick={() => navigate('/admin/users')}
            className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl transition"
          >
            <Users className="w-8 h-8 text-purple-600 mb-3" />
            <div className="text-lg font-bold text-gray-900 mb-1">Usuárias</div>
            <div className="text-sm text-gray-600">Ver cadastros e progresso</div>
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/AdminDashboard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the `/admin` route in `App.tsx`**

Add this line with the other `lazy` admin imports in `src/App.tsx` (added in Tasks 5, 6, 8):
```ts
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
```
Add the route in `src/App.tsx`, right before the `/admin/workouts` route:
```tsx
          <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
```

- [ ] **Step 6: Add the "Painel Admin" entry link in `Profile.tsx`**

In `src/pages/Profile.tsx`, update the store destructuring on line 12 from:
```ts
  const { user, isAuthenticated } = useAuthStore()
```
to:
```ts
  const { user, isAuthenticated, isAdmin } = useAuthStore()
```
Add the `Shield` icon to the existing `lucide-react` import on line 6 — change:
```ts
import { ChevronLeft, Trophy, Calendar, Ribbon, Sparkles, Target, Share2, Info, CheckCircle2 } from 'lucide-react'
```
to:
```ts
import { ChevronLeft, Trophy, Calendar, Ribbon, Sparkles, Target, Share2, Info, CheckCircle2, Shield } from 'lucide-react'
```
Add the link right after the closing `</div>` of the "Atividade recente" block (currently ending at `src/pages/Profile.tsx:268`, i.e. right before the `<div className="fixed left-0 right-0 bottom-0 ...">` sign-out button block):
```tsx
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="w-full bg-white rounded-2xl shadow-lg p-4 mb-24 flex items-center justify-center text-purple-700 hover:bg-purple-50 font-medium"
          >
            <Shield className="w-5 h-5 mr-2" /> Painel Admin
          </button>
        )}
```
Note: this new block replaces the existing `mb-24` on the "Atividade recente" `<div>` (`src/pages/Profile.tsx:218`) — remove `mb-24` from that div's className (it currently reads `"bg-white rounded-2xl shadow-lg p-6 mb-24 animate-slide-up"`, change to `"bg-white rounded-2xl shadow-lg p-6 mb-6 animate-slide-up"`) so the new admin button (which now carries the `mb-24` bottom spacing) sits directly below it without a double gap.

- [ ] **Step 7: Verify the project typechecks**

Run: `npm run check`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: all test files pass, including every admin test file created in Tasks 2, 3, 4, 5, 6, 7, 8, 9.

- [ ] **Step 9: Commit**

```bash
git add src/pages/admin/AdminDashboard.tsx src/__tests__/AdminDashboard.test.tsx src/App.tsx src/pages/Profile.tsx
git commit -m "feat(admin): add AdminDashboard hub, /admin route, and Profile entry link"
```

---

### Task 10: Manual end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server starts on `http://localhost:5174` (or the next free port).

- [ ] **Step 2: Verify admin access**

In the browser, log in with `ataide.junior.mg@gmail.com` (the account promoted in Task 1, Step 5). Open `/profile` and confirm the "Painel Admin" button is visible. Click it, confirm `/admin` shows the two option cards.

- [ ] **Step 3: Verify the workout editor round-trip**

From `/admin`, click "Treinos", pick any day, change its title and one exercise's reps field, click "Salvar alterações", and confirm the success `alert()` appears. Navigate to the public `/workout/:day` route for that same day and confirm the new title and reps value are visible there.

- [ ] **Step 4: Verify the user list**

From `/admin`, click "Usuárias" and confirm the table renders with email, username, cadastro date, and `X/30` progress columns populated (or the "Nenhuma usuária cadastrada ainda." empty state if there truly are no non-admin users yet).

- [ ] **Step 5: Verify non-admin users are blocked**

Log out, then log in with any account that is **not** `ataide.junior.mg@gmail.com` (or register a throwaway test account). Confirm the "Painel Admin" button does **not** appear on `/profile`. Manually navigate the browser to `/admin/workouts` and confirm it redirects to `/home`.

- [ ] **Step 6: Report results**

Confirm with the user that all five checks above passed before considering the feature complete. If any step fails, stop and diagnose before proceeding — do not mark the plan done.

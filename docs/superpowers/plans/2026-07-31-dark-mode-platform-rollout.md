# Dark Mode Platform Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every page in the app renders correctly and legibly in dark mode (toggled from Profile), by extending the theme-token system already used in `WorkoutDay.tsx`/`ExerciseItem.tsx`/`Profile.tsx`/`src/components/ui/*` to the 14 remaining pages that still use hardcoded light-only Tailwind colors.

**Architecture:** Pure `className` substitutions, page by page. No logic changes, no new components, no new props, no schema/data changes. Each task is one page: apply a fixed set of exact class-string replacements (given verbatim below), verify no hardcoded light-only color survives, run the page's existing test if one exists, commit.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS (theme tokens in `tailwind.config.js` / `src/index.css`), Vitest + @testing-library/react.

## Global Constraints

- No changes to component logic, props, routing, or any file outside the 14 listed pages (`src/pages/*.tsx`, `src/pages/admin/*.tsx`).
- No changes to `src/components/ui/*`, `WorkoutDay.tsx`, `ExerciseItem.tsx`, `Profile.tsx`, `Layout.tsx`, `Empty.tsx`, the theme system itself (`tailwind.config.js`, `src/index.css`, `useTheme`, `themeStore`, `ThemeInit`), or any test file — none of them need changes for this work.
- Every substitution below is a **literal, exact string match** to apply via the Edit tool. Where a task notes "replace_all", the exact same string occurs multiple times in that file and every occurrence gets the same replacement — this is safe and intended, not a mistake.
- **Do not** run a blind file-wide find/replace on bare tokens like `bg-white` or `text-gray-600` — several files also contain compound strings (e.g. `hover:bg-white/50`, or `text-gray-600` embedded inside a longer legitimate string) that need different, specific handling, listed explicitly per task. Apply exactly the listed compound strings, nothing more.
- Established conventions reused from the already-approved `WorkoutDay.tsx` work (do not invent alternatives):
  - Page-level gradient backgrounds (`bg-gradient-to-br from-purple-50 to-pink-50`) gain `dark:from-bg dark:to-bg`.
  - The circular back-button hover treatment `hover:bg-white/50` becomes `hover:bg-black/5 dark:hover:bg-white/10` (not a token swap — this is a highlight effect on a gradient background, not a card surface).
  - Status/alert banners (colored `bg-*-50 border border-*-200 text-*-700` boxes) gain `dark:bg-*-950/30 dark:border-*-800 dark:text-*-400`.
  - Plain inline status text with no background (e.g. `text-red-600` / `text-green-600` success/error messages) gains `dark:text-red-400` / `dark:text-green-400`.
  - Tinted pill/badge buttons (`bg-*-100 text-*-700 hover:bg-*-200`) gain `dark:bg-*-950/40 dark:text-*-300 dark:hover:bg-*-900/40`.
  - Purple/pink accent text used as body text or links (`text-purple-600`, `text-purple-700`, `text-purple-800`, and their `hover:` variants) gains a `dark:` variant one shade lighter: `600`→`dark:text-purple-400`, `700`/`800`→`dark:text-purple-300` (same for `hover:text-purple-*` → `dark:hover:text-purple-*` one shade lighter).
  - Raw (non-component) `<input>` elements that currently have no explicit background/text color class need `bg-surface text-text` added alongside their existing classes, so typed text stays legible on a dark input in dark mode — this mirrors what `src/components/ui/Input.tsx` already does for form inputs built with that component.
  - Solid-fill colored buttons/gradients with white text (e.g. `bg-purple-600 text-white`, `bg-gradient-to-r from-purple-600 to-pink-500 text-white`), `bg-black`/video-overlay containers, and spinner rings (`border-pink-200 border-t-purple-600`) are left unchanged — already sufficient contrast in both themes, matches `WorkoutDay.tsx` precedent.
- Exceptions (explicitly do NOT tokenize, called out again in the relevant task):
  - `src/pages/Home.tsx`'s PDF-preview container (`<div className="flex-1 bg-white">`, wraps a literal white PDF document) stays `bg-white`.
  - `src/pages/HIIT.tsx`'s commented-out JSX block (a large `{/* ... */}` region) is dead code — do not edit anything inside it.
- Verification per task: after applying all listed substitutions to a file, grep it for `text-gray-` and `border-gray-` — zero matches must remain. Then grep it for `bg-white` — the only matches allowed are the ones explicitly called out as exceptions in that task (or, incidentally, the substring `bg-white` inside a correctly-applied `dark:hover:bg-white/10` — that's expected and correct, not a leftover).
- This repo's test runner also picks up a stale duplicate test suite under `.claude/worktrees/...` with its own broken `node_modules` if run unscoped — always run tests scoped to a specific path with `--exclude "**/.claude/**"`, e.g.:
  `npx vitest run --dir . src/__tests__/AdminUsers.test.tsx --exclude "**/.claude/**"`

---

### Task 1: `src/pages/Login.tsx`

**Files:** Modify: `src/pages/Login.tsx`. No test file exists for this page.

- [ ] **Step 1: Apply substitutions**

| # | Old (exact) | New (exact) | replace_all? |
|---|---|---|---|
| 1 | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center px-4` | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center px-4` | no |
| 2 | `flex items-center justify-center text-sm text-gray-600 mt-1` | `flex items-center justify-center text-sm text-text-muted mt-1` | no |
| 3 | `bg-white rounded-2xl shadow-xl p-8 animate-slide-up` | `bg-surface rounded-2xl shadow-xl p-8 animate-slide-up` | no |
| 4 | `text-2xl font-bold text-gray-900` | `text-2xl font-bold text-text` | no |
| 5 | `text-gray-600 text-sm` | `text-text-muted text-sm` | no |
| 6 | `bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg` | `bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg` | no |
| 7 | `block text-sm font-medium text-gray-700 mb-2` | `block text-sm font-medium text-text-muted mb-2` | **yes** (email + password labels) |
| 8 | `absolute left-3 top-1/2 -translate-y-1/2 text-gray-400` | `absolute left-3 top-1/2 -translate-y-1/2 text-text-muted` | **yes** (email + password icons) |
| 9 | `w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition` | `w-full pl-10 px-4 py-3 border border-border bg-surface text-text rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition` | no |
| 10 | `w-full pl-10 pr-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition tracking-widest` | `w-full pl-10 pr-10 px-4 py-3 border border-border bg-surface text-text rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition tracking-widest` | no |
| 11 | `absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition` | `absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition` | no |
| 12 | `text-sm text-purple-700 hover:text-purple-800 underline underline-offset-2` | `text-sm text-purple-700 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-200 underline underline-offset-2` | no |
| 13 | `text-center text-sm text-gray-600 mt-6` | `text-center text-sm text-text-muted mt-6` | no |
| 14 | `text-purple-600 hover:text-purple-700 font-medium ml-1` | `text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium ml-1` | no |

- [ ] **Step 2: Verify no leftover hardcoded colors** — grep the file per Global Constraints; zero `text-gray-`/`border-gray-` matches, zero unexpected `bg-white` matches.
- [ ] **Step 3: Run `npm run check`** and confirm clean for this file.
- [ ] **Step 4: Commit**

```bash
git add src/pages/Login.tsx
git commit -m "style: dark mode for Login page"
```

---

### Task 2: `src/pages/Register.tsx`

**Files:** Modify: `src/pages/Register.tsx`. Test: `src/__tests__/Register.test.tsx` exists — run it, it must still pass unmodified (it doesn't assert on classNames).

- [ ] **Step 1: Apply substitutions**

Apply these in the numbered order given — rows 4 and 5 (longer strings) must run before row 6 (a shorter string they both contain), or row 6 would be ambiguous.

| # | Old (exact) | New (exact) | replace_all? |
|---|---|---|---|
| 1 | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center px-4` | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center px-4` | no |
| 2 | `max-w-md w-full bg-white rounded-2xl shadow-xl p-8` | `max-w-md w-full bg-surface rounded-2xl shadow-xl p-8` | no |
| 3 | `text-3xl font-bold text-gray-900 mb-2` | `text-3xl font-bold text-text mb-2` | no |
| 4 | `flex justify-between items-center text-xs text-gray-600 mb-1` (contains `text-gray-600` as a substring — must run before row 6) | `flex justify-between items-center text-xs text-text-muted mb-1` | no |
| 5 | `text-center text-sm text-gray-600 mt-6` (contains `text-gray-600` as a substring — must run before row 6) | `text-center text-sm text-text-muted mt-6` | no |
| 6 | `text-gray-600` (bare — the standalone `<p className="text-gray-600">Crie sua conta...`; safe now that rows 4 and 5 have already consumed the strings that would otherwise also match) | `text-text-muted` | no |
| 7 | `w-full h-2 bg-pink-100 rounded-full` | `w-full h-2 bg-pink-100 dark:bg-pink-950/30 rounded-full` | no |
| 8 | `bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg` | `bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg` | no |
| 9 | `block text-sm font-medium text-gray-700 mb-2` | `block text-sm font-medium text-text-muted mb-2` | **yes** (email, password, confirm-password labels — 3x) |
| 10 | `absolute left-3 top-1/2 -translate-y-1/2 text-gray-400` | `absolute left-3 top-1/2 -translate-y-1/2 text-text-muted` | **yes** (3x, same icons) |
| 11 | `w-full pl-10 pr-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition` | `w-full pl-10 pr-10 px-4 py-3 border border-border bg-surface text-text rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition` | **yes** (email, password, confirm-password inputs — 3x identical) |
| 12 | `absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition` | `absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition` | **yes** (password + confirm show/hide buttons — 2x) |
| 13 | `text-purple-600 hover:text-purple-700 font-medium` (the "Entrar" link, not the button) | `text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium` | no |

- [ ] **Step 2: Verify no leftover hardcoded colors** (grep check per Global Constraints).
- [ ] **Step 3: Run `npx vitest run --dir . src/__tests__/Register.test.tsx --exclude "**/.claude/**"`** — must still pass (all tests), and `npm run check` clean.
- [ ] **Step 4: Commit**

```bash
git add src/pages/Register.tsx
git commit -m "style: dark mode for Register page"
```

---

### Task 3: `src/pages/Onboarding.tsx`

**Files:** Modify: `src/pages/Onboarding.tsx`. No test file exists for this page. Most of the form uses `FormField`/`Input`/`ChoiceGroup`/`Button` from `src/components/ui/*`, which are already dark-aware and untouched by this task.

- [ ] **Step 1: Apply substitutions**

| # | Old (exact) | New (exact) | replace_all? |
|---|---|---|---|
| 1 | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center px-4` | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center px-4` | no |
| 2 | `max-w-md w-full bg-white rounded-2xl shadow-xl p-8` | `max-w-md w-full bg-surface rounded-2xl shadow-xl p-8` | no |
| 3 | `text-2xl font-bold text-gray-900 mb-1` | `text-2xl font-bold text-text mb-1` | no |
| 4 | `text-gray-600 text-sm` | `text-text-muted text-sm` | no |
| 5 | `w-full h-2 bg-pink-100 rounded-full` | `w-full h-2 bg-pink-100 dark:bg-pink-950/30 rounded-full` | no |
| 6 | `bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6` | `bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6` | no |

- [ ] **Step 2: Verify no leftover hardcoded colors** (grep check per Global Constraints).
- [ ] **Step 3: Run `npm run check`**, confirm clean.
- [ ] **Step 4: Commit**

```bash
git add src/pages/Onboarding.tsx
git commit -m "style: dark mode for Onboarding page"
```

---

### Task 4: `src/pages/ForgotPassword.tsx`

**Files:** Modify: `src/pages/ForgotPassword.tsx`. No test file exists for this page.

- [ ] **Step 1: Apply substitutions**

| # | Old (exact) | New (exact) | replace_all? |
|---|---|---|---|
| 1 | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50` | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg` | no |
| 2 | `w-6 h-6 text-gray-800` | `w-6 h-6 text-text` | no |
| 3 | `bg-white rounded-2xl shadow-lg p-6` | `bg-surface rounded-2xl shadow-lg p-6` | no |
| 4 | `text-2xl font-bold text-gray-900 mb-2` | `text-2xl font-bold text-text mb-2` | no |
| 5 | `text-sm text-gray-600 mb-6` | `text-sm text-text-muted mb-6` | no |
| 6 | `absolute left-3 top-1/2 -translate-y-1/2 text-gray-400` | `absolute left-3 top-1/2 -translate-y-1/2 text-text-muted` | no |
| 7 | `w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition` | `w-full pl-10 pr-4 py-3 border border-border bg-surface text-text rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition` | no |
| 8 | `` `mt-4 text-sm ${status==='error' ? 'text-red-600' : 'text-green-600'}` `` (template literal) | `` `mt-4 text-sm ${status==='error' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}` `` | no |

- [ ] **Step 2: Verify no leftover hardcoded colors** (grep check per Global Constraints).
- [ ] **Step 3: Run `npm run check`**, confirm clean.
- [ ] **Step 4: Commit**

```bash
git add src/pages/ForgotPassword.tsx
git commit -m "style: dark mode for ForgotPassword page"
```

---

### Task 5: `src/pages/ResetPassword.tsx`

**Files:** Modify: `src/pages/ResetPassword.tsx`. No test file exists for this page.

- [ ] **Step 1: Apply substitutions**

| # | Old (exact) | New (exact) | replace_all? |
|---|---|---|---|
| 1 | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center` | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center` | no |
| 2 | `w-16 h-16 bg-purple-200 rounded-full mx-auto mb-4 animate-pulse` | `w-16 h-16 bg-purple-200 dark:bg-purple-900/40 rounded-full mx-auto mb-4 animate-pulse` | no |
| 3 | `<div className="text-gray-700">Validando link de recuperação...</div>` | `<div className="text-text-muted">Validando link de recuperação...</div>` | no |
| 4 | `<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">` (the second, main-view root — use this exact longer form, including the surrounding tag, so it doesn't collide with #1's string which it would otherwise be a substring of) | `<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg">` | no |
| 5 | `bg-white rounded-2xl shadow-lg p-6` | `bg-surface rounded-2xl shadow-lg p-6` | no |
| 6 | `text-2xl font-bold text-gray-900 mb-2` | `text-2xl font-bold text-text mb-2` | no |
| 7 | `text-sm text-gray-600 mb-6` | `text-sm text-text-muted mb-6` | no |
| 8 | `absolute left-3 top-1/2 -translate-y-1/2 text-gray-400` | `absolute left-3 top-1/2 -translate-y-1/2 text-text-muted` | **yes** (password + confirm icons — 2x) |
| 9 | `w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition` | `w-full pl-10 pr-4 py-3 border border-border bg-surface text-text rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition` | **yes** (password + confirm inputs — 2x identical) |
| 10 | `` `mt-4 text-sm ${status==='error' ? 'text-red-600' : 'text-green-600'}` `` | `` `mt-4 text-sm ${status==='error' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}` `` | no |
| 11 | `mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-center text-green-700` | `mt-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center text-green-700 dark:text-green-400` | no |

- [ ] **Step 2: Verify no leftover hardcoded colors** (grep check per Global Constraints).
- [ ] **Step 3: Run `npm run check`**, confirm clean.
- [ ] **Step 4: Commit**

```bash
git add src/pages/ResetPassword.tsx
git commit -m "style: dark mode for ResetPassword page"
```

---

### Task 6: `src/pages/ResetConfirm.tsx`

**Files:** Modify: `src/pages/ResetConfirm.tsx`. No test file exists for this page. Smallest task in this plan.

- [ ] **Step 1: Apply substitutions**

| # | Old (exact) | New (exact) | replace_all? |
|---|---|---|---|
| 1 | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center px-4` | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center px-4` | no |
| 2 | `bg-white rounded-2xl shadow-lg p-8 text-center max-w-md w-full` | `bg-surface rounded-2xl shadow-lg p-8 text-center max-w-md w-full` | no |
| 3 | `text-xl font-bold text-gray-900 mb-1` | `text-xl font-bold text-text mb-1` | no |
| 4 | `text-gray-600 text-sm` | `text-text-muted text-sm` | no |

- [ ] **Step 2: Verify no leftover hardcoded colors** (grep check per Global Constraints).
- [ ] **Step 3: Run `npm run check`**, confirm clean.
- [ ] **Step 4: Commit**

```bash
git add src/pages/ResetConfirm.tsx
git commit -m "style: dark mode for ResetConfirm page"
```

---

### Task 7: `src/pages/ProgramDays.tsx`

**Files:** Modify: `src/pages/ProgramDays.tsx`. No test file exists for this page. This page has the same loading/not-found shape as `WorkoutDay.tsx` and two template-literal ternaries that need substrings changed inside them — read carefully.

- [ ] **Step 1: Apply substitutions**

| # | Old (exact) | New (exact) | replace_all? |
|---|---|---|---|
| 1 | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center` | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center` | **yes** (identical string used for both the loading state and the not-found state) |
| 2 | `w-16 h-16 bg-purple-200 rounded-full mx-auto mb-4` | `w-16 h-16 bg-purple-200 dark:bg-purple-900/40 rounded-full mx-auto mb-4` | no |
| 3 | `h-4 bg-purple-200 rounded w-32 mx-auto mb-2` | `h-4 bg-purple-200 dark:bg-purple-900/40 rounded w-32 mx-auto mb-2` | no |
| 4 | `h-4 bg-purple-200 rounded w-24 mx-auto` | `h-4 bg-purple-200 dark:bg-purple-900/40 rounded w-24 mx-auto` | no |
| 5 | `text-2xl font-bold text-gray-900 mb-2` (in the not-found block) | `text-2xl font-bold text-text mb-2` | no |
| 6 | `className="text-purple-600 hover:text-purple-700"` (the "Voltar à Home" button) | `className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"` | no |
| 7 | `<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">` (the main-view root — use this exact longer form, including the surrounding tag, so it doesn't collide with #1's string which it would otherwise be a substring of) | `<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg">` | no |
| 8 | `mr-4 p-2 rounded-lg hover:bg-white/50 transition` | `mr-4 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition` | no |
| 9 | `w-6 h-6 text-gray-700` | `w-6 h-6 text-text` | no |
| 10 | `text-3xl font-bold text-gray-900` | `text-3xl font-bold text-text` | no |
| 11 | `<p className="text-gray-600">Escolha o dia da semana</p>` (use this exact longer form, including the surrounding tag and text, so it doesn't collide with the `'text-gray-600'` substring embedded in row 16's template literal below) | `<p className="text-text-muted">Escolha o dia da semana</p>` | no |
| 12 | `bg-white rounded-2xl shadow-lg p-6` | `bg-surface rounded-2xl shadow-lg p-6` | no |
| 13 | `'bg-white border-gray-300'` (single-quoted, inside the day-circle ternary: `` day.completed ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300' ``) | `'bg-surface border-border'` | no |
| 14 | `w-6 h-6 text-gray-400` | `w-6 h-6 text-text-muted` | no |
| 15 | `` `font-medium ${day.completed ? 'text-green-700' : day.workout ? 'text-gray-900' : 'text-gray-400'}` `` | `` `font-medium ${day.completed ? 'text-green-700 dark:text-green-400' : day.workout ? 'text-text' : 'text-text-muted'}` `` | no |
| 16 | `` `text-sm ${day.completed ? 'text-green-600' : day.workout ? 'text-gray-600' : 'text-gray-400'}` `` | `` `text-sm ${day.completed ? 'text-green-600 dark:text-green-400' : day.workout ? 'text-text-muted' : 'text-text-muted'}` `` | no |
| 17 | The full button-pill template literal:<br>`` `px-4 py-2 rounded-lg text-sm font-medium transition ${ day.completed ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-purple-100 text-purple-700 hover:bg-purple-200' }` `` | `` `px-4 py-2 rounded-lg text-sm font-medium transition ${ day.completed ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/40' : 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/40' }` `` (keep the original multi-line formatting/indentation, only the two inner class strings change) | no |

- [ ] **Step 2: Verify no leftover hardcoded colors** (grep check per Global Constraints).
- [ ] **Step 3: Run `npm run check`**, confirm clean.
- [ ] **Step 4: Commit**

```bash
git add src/pages/ProgramDays.tsx
git commit -m "style: dark mode for ProgramDays page"
```

---

### Task 8: `src/pages/HIIT.tsx`

**Files:** Modify: `src/pages/HIIT.tsx`. No test file exists for this page. **Do not touch the large commented-out JSX block** (roughly lines 85-110, a `{/* ... */}` region) — it's dead code, out of scope.

- [ ] **Step 1: Apply substitutions**

| # | Old (exact) | New (exact) | replace_all? |
|---|---|---|---|
| 1 | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50` | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg` | no |
| 2 | `mr-3 p-2 rounded-lg hover:bg-black/5 transition` | `mr-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition` | no |
| 3 | `w-6 h-6 text-gray-800` | `w-6 h-6 text-text` | no |
| 4 | `text-2xl md:text-3xl font-bold text-gray-900` | `text-2xl md:text-3xl font-bold text-text` | no |
| 5 | `bg-white rounded-2xl shadow-lg p-6 mb-6` | `bg-surface rounded-2xl shadow-lg p-6 mb-6` | no |
| 6 | `text-lg font-bold text-gray-900` | `text-lg font-bold text-text` | no |
| 7 | `text-sm text-gray-600` | `text-sm text-text-muted` | no |
| 8 | `flex items-center text-gray-700` | `flex items-center text-text-muted` | no |

- [ ] **Step 2: Verify no leftover hardcoded colors** — grep only the *active* code (outside the commented block); the commented block's `bg-white border border-gray-300 text-gray-900` occurrences are expected to remain since they're dead code.
- [ ] **Step 3: Run `npm run check`**, confirm clean.
- [ ] **Step 4: Commit**

```bash
git add src/pages/HIIT.tsx
git commit -m "style: dark mode for HIIT page"
```

---

### Task 9: `src/pages/Home.tsx`

**Files:** Modify: `src/pages/Home.tsx`. No test file exists for this page. **Exception:** the PDF-preview container `<div className="flex-1 bg-white">` (wraps a literal white PDF document, near the end of the file) stays `bg-white` — do not change it.

- [ ] **Step 1: Apply substitutions**

Apply these in the numbered order given — the order matters: several rows are deliberately sequenced so a longer/more-specific string is replaced before a shorter string it contains, avoiding double-edits.

| # | Old (exact) | New (exact) | replace_all? |
|---|---|---|---|
| 1 | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center` (loading state) | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center` | no |
| 2 | `w-16 h-16 bg-purple-200 rounded-full mx-auto mb-4` | `w-16 h-16 bg-purple-200 dark:bg-purple-900/40 rounded-full mx-auto mb-4` | no |
| 3 | `h-4 bg-purple-200 rounded w-32 mx-auto mb-2` | `h-4 bg-purple-200 dark:bg-purple-900/40 rounded w-32 mx-auto mb-2` | no |
| 4 | `h-4 bg-purple-200 rounded w-24 mx-auto` | `h-4 bg-purple-200 dark:bg-purple-900/40 rounded w-24 mx-auto` | no |
| 5 | `<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">` (main root — use this exact longer form, including the surrounding tag, so it doesn't collide with #1's string which it would otherwise be a substring of) | `<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg">` | no |
| 6 | `id="treinos" className="bg-white rounded-2xl shadow-lg p-6 mb-6"` | `id="treinos" className="bg-surface rounded-2xl shadow-lg p-6 mb-6"` | no |
| 7 | `text-xl font-bold text-gray-900 mb-4` (Treinos heading) | `text-xl font-bold text-text mb-4` | no |
| 8 | `bg-white rounded-2xl shadow-md p-5 text-left hover:shadow-lg transition transform hover:scale-[1.01]` (program card button) | `bg-surface rounded-2xl shadow-md p-5 text-left hover:shadow-lg transition transform hover:scale-[1.01]` | no |
| 9 | `text-lg font-bold text-gray-900 mb-1` (program card title — this exact string occurs only once in this file; the visually similar plan-card titles use a different string, handled by #11 below) | `text-lg font-bold text-text mb-1` | no |
| 10 | `text-sm text-gray-600 mb-4` (both plan-card descriptions, 2 identical occurrences — do this **before** #12 below, since #12's shorter string would otherwise also match inside this one) | `text-sm text-text-muted mb-4` | **yes** |
| 11 | `text-lg md:text-xl font-semibold text-gray-900 mb-1` (both plan-card titles, 2 identical occurrences — do this **before** #17 below, since #17's shorter string would otherwise also match inside this one) | `text-lg md:text-xl font-semibold text-text mb-1` | **yes** |
| 12 | `text-sm text-gray-600` (bare — "Olá, {displayName}!" line, and the program-card description "Ver os 7 dias da semana"; 2 occurrences once #10 has already consumed the `mb-4` variant) | `text-sm text-text-muted` | **yes** |
| 13 | `bg-white rounded-2xl shadow-lg p-6 mb-6` (HIIT-opcional card AND Planos-Alimentares card, 2 identical occurrences — do this **after** #6, since #6 is a longer string this one would otherwise also match inside) | `bg-surface rounded-2xl shadow-lg p-6 mb-6` | **yes** |
| 14 | `text-xl font-bold text-gray-900 mb-2` (Planos Alimentares heading — do this **before** #15 below, since #15's shorter string would otherwise also match inside this one) | `text-xl font-bold text-text mb-2` | no |
| 15 | `text-xl font-bold text-gray-900` (bare — HIIT section heading, inside the flex row with the Flame icon; safe now that #7 and #14 have already consumed the `mb-4`/`mb-2` variants) | `text-xl font-bold text-text` | no |
| 16 | `text-gray-700` (bare — matches both the paragraph "30 minutos no formato 40s ON / 20s OFF..." and, as a substring, the Trophy icon's `w-5 h-5 text-gray-700` — both are meant to become the same muted color, so replacing all occurrences of this token is correct here) | `text-text-muted` | **yes** |
| 17 | `bg-white rounded-2xl shadow-md p-5 hover:shadow-lg transition transform hover:scale-[1.01] min-h-[140px]` (both plan cards, 2 identical occurrences) | `bg-surface rounded-2xl shadow-md p-5 hover:shadow-lg transition transform hover:scale-[1.01] min-h-[140px]` | **yes** |
| 18 | `ui-hover bg-white border border-gray-300 text-gray-900 px-4 py-2 rounded-lg flex items-center` (both "Visualizar" buttons, 2 identical occurrences) | `ui-hover bg-surface border border-border text-text px-4 py-2 rounded-lg flex items-center` | **yes** |
| 19 | `bg-white rounded-2xl shadow-md p-5 hover:shadow-lg transition text-center flex items-center justify-center space-x-2` (Meu Perfil button) | `bg-surface rounded-2xl shadow-md p-5 hover:shadow-lg transition text-center flex items-center justify-center space-x-2` | no |
| 20 | `font-medium text-gray-900` (next to "Meu Perfil" span) | `font-medium text-text` | no |
| 21 | `bg-white/95 p-3 flex items-center justify-between` (PDF modal header) | `bg-surface/95 p-3 flex items-center justify-between` | no |
| 22 | `font-semibold text-gray-900` (modal title — safe now that #11 has already consumed the plan-card-title variant it would otherwise also match inside) | `font-semibold text-text` | no |
| 23 | `ui-hover bg-white border border-gray-300 text-gray-900 px-3 py-2 rounded-md flex items-center` (modal close button — distinct from #18: `px-3 py-2 rounded-md` vs `px-4 py-2 rounded-lg`) | `ui-hover bg-surface border border-border text-text px-3 py-2 rounded-md flex items-center` | no |

Do **not** touch `<div className="flex-1 bg-white">` (the PDF iframe container right after the modal header) — leave it exactly as-is.

- [ ] **Step 2: Verify no leftover hardcoded colors** — grep for `text-gray-`/`border-gray-` (zero matches) and `bg-white` (the only match should be the one PDF-container exception, plus any correct `dark:hover:bg-white/10` substrings if present — Home.tsx has none of those, so a clean file should show exactly one `bg-white` match: the PDF container).
- [ ] **Step 3: Run `npm run check`**, confirm clean.
- [ ] **Step 4: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "style: dark mode for Home page"
```

---

### Task 10: `src/pages/admin/AdminDashboard.tsx`

**Files:** Modify: `src/pages/admin/AdminDashboard.tsx`. Test: `src/__tests__/AdminDashboard.test.tsx` exists — run it, must still pass unmodified.

- [ ] **Step 1: Apply substitutions**

| # | Old (exact) | New (exact) | replace_all? |
|---|---|---|---|
| 1 | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50` | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg` | no |
| 2 | `mr-4 p-2 rounded-lg hover:bg-white/50 transition` | `mr-4 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition` | no |
| 3 | `w-6 h-6 text-gray-700` | `w-6 h-6 text-text` | no |
| 4 | `text-2xl md:text-3xl font-bold text-gray-900` | `text-2xl md:text-3xl font-bold text-text` | no |
| 5 | `bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl transition` | `bg-surface rounded-2xl shadow-lg p-6 text-left hover:shadow-xl transition` | **yes** (both nav cards — 2x identical) |
| 6 | `text-lg font-bold text-gray-900 mb-1` | `text-lg font-bold text-text mb-1` | **yes** (2x identical) |
| 7 | `text-sm text-gray-600` | `text-sm text-text-muted` | **yes** (2x identical) |

- [ ] **Step 2: Verify no leftover hardcoded colors** (grep check per Global Constraints).
- [ ] **Step 3: Run `npx vitest run --dir . src/__tests__/AdminDashboard.test.tsx --exclude "**/.claude/**"`** — must still pass, and `npm run check` clean.
- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/AdminDashboard.tsx
git commit -m "style: dark mode for AdminDashboard page"
```

---

### Task 11: `src/pages/admin/AdminProgramList.tsx`

**Files:** Modify: `src/pages/admin/AdminProgramList.tsx`. No test file exists for this page.

- [ ] **Step 1: Apply substitutions**

| # | Old (exact) | New (exact) | replace_all? |
|---|---|---|---|
| 1 | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center` (loading) | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center` | no |
| 2 | `<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">` (main root — use this exact longer form, including the surrounding tag, so it doesn't collide with #1's string which it would otherwise be a substring of) | `<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg">` | no |
| 3 | `mr-4 p-2 rounded-lg hover:bg-white/50 transition` | `mr-4 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition` | no |
| 4 | `w-6 h-6 text-gray-700` | `w-6 h-6 text-text` | no |
| 5 | `text-2xl md:text-3xl font-bold text-gray-900` | `text-2xl md:text-3xl font-bold text-text` | no |
| 6 | `bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition block` | `bg-surface rounded-2xl shadow-lg p-6 hover:shadow-xl transition block` | no |
| 7 | `text-lg font-bold text-gray-900 mb-1` | `text-lg font-bold text-text mb-1` | no |
| 8 | `text-sm text-gray-600` | `text-sm text-text-muted` | no |
| 9 | `text-gray-600 text-center mt-8` | `text-text-muted text-center mt-8` | no |

- [ ] **Step 2: Verify no leftover hardcoded colors** (grep check per Global Constraints).
- [ ] **Step 3: Run `npm run check`**, confirm clean.
- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/AdminProgramList.tsx
git commit -m "style: dark mode for AdminProgramList page"
```

---

### Task 12: `src/pages/admin/AdminUsers.tsx`

**Files:** Modify: `src/pages/admin/AdminUsers.tsx`. Test: `src/__tests__/AdminUsers.test.tsx` exists — run it, must still pass unmodified.

- [ ] **Step 1: Apply substitutions**

| # | Old (exact) | New (exact) | replace_all? |
|---|---|---|---|
| 1 | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center` (loading) | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center` | no |
| 2 | `<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">` (main root — use this exact longer form, including the surrounding tag, so it doesn't collide with #1's string which it would otherwise be a substring of) | `<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg">` | no |
| 3 | `mr-4 p-2 rounded-lg hover:bg-white/50 transition` | `mr-4 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition` | no |
| 4 | `w-6 h-6 text-gray-700` | `w-6 h-6 text-text` | no |
| 5 | `text-2xl md:text-3xl font-bold text-gray-900` | `text-2xl md:text-3xl font-bold text-text` | no |
| 6 | `bg-white rounded-2xl shadow-lg overflow-x-auto` | `bg-surface rounded-2xl shadow-lg overflow-x-auto` | no |
| 7 | `border-b border-gray-200` (thead row) | `border-b border-border` | no |
| 8 | `px-4 py-3 text-sm font-medium text-gray-500` | `px-4 py-3 text-sm font-medium text-text-muted` | **yes** (4 identical table-header cells) |
| 9 | `border-b border-gray-100 last:border-0` (tbody row) | `border-b border-border last:border-0` | no |
| 10 | `px-4 py-3 text-gray-900` | `px-4 py-3 text-text` | no |
| 11 | `px-4 py-3 text-gray-700` | `px-4 py-3 text-text-muted` | **yes** (3 identical td cells: username, cadastro, progresso) |
| 12 | `text-gray-600 text-center mt-8` | `text-text-muted text-center mt-8` | no |

- [ ] **Step 2: Verify no leftover hardcoded colors** (grep check per Global Constraints).
- [ ] **Step 3: Run `npx vitest run --dir . src/__tests__/AdminUsers.test.tsx --exclude "**/.claude/**"`** — must still pass, and `npm run check` clean.
- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/AdminUsers.tsx
git commit -m "style: dark mode for AdminUsers page"
```

---

### Task 13: `src/pages/admin/AdminWorkoutList.tsx`

**Files:** Modify: `src/pages/admin/AdminWorkoutList.tsx`. Test: `src/__tests__/AdminWorkoutList.test.tsx` exists — run it, must still pass unmodified.

- [ ] **Step 1: Apply substitutions**

| # | Old (exact) | New (exact) | replace_all? |
|---|---|---|---|
| 1 | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center` (loading) | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center` | no |
| 2 | `<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">` (main root — use this exact longer form, including the surrounding tag, so it doesn't collide with #1's string which it would otherwise be a substring of) | `<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg">` | no |
| 3 | `mr-4 p-2 rounded-lg hover:bg-white/50 transition` | `mr-4 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition` | no |
| 4 | `w-6 h-6 text-gray-700` | `w-6 h-6 text-text` | no |
| 5 | `text-2xl md:text-3xl font-bold text-gray-900` | `text-2xl md:text-3xl font-bold text-text` | no |
| 6 | `bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition block` | `bg-surface rounded-2xl shadow-lg p-6 hover:shadow-xl transition block` | no |
| 7 | `text-sm text-gray-500 mb-1` | `text-sm text-text-muted mb-1` | no |
| 8 | `text-lg font-bold text-gray-900 mb-1` | `text-lg font-bold text-text mb-1` | no |
| 9 | `text-sm text-gray-600` | `text-sm text-text-muted` | no |
| 10 | `text-lg font-bold text-purple-600 mb-1` ("+ Criar treino") | `text-lg font-bold text-purple-600 dark:text-purple-400 mb-1` | no |

- [ ] **Step 2: Verify no leftover hardcoded colors** (grep check per Global Constraints).
- [ ] **Step 3: Run `npx vitest run --dir . src/__tests__/AdminWorkoutList.test.tsx --exclude "**/.claude/**"`** — must still pass, and `npm run check` clean.
- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/AdminWorkoutList.tsx
git commit -m "style: dark mode for AdminWorkoutList page"
```

---

### Task 14: `src/pages/admin/AdminWorkoutEdit.tsx`

**Files:** Modify: `src/pages/admin/AdminWorkoutEdit.tsx`. Test: `src/__tests__/AdminWorkoutEdit.test.tsx` exists — run it, must still pass unmodified. Largest task in this plan (this is the page with the per-exercise form grid).

- [ ] **Step 1: Apply substitutions**

| # | Old (exact) | New (exact) | replace_all? |
|---|---|---|---|
| 1 | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center` (loading) | `min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center` | no |
| 2 | `<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">` (main root — use this exact longer form, including the surrounding tag, so it doesn't collide with #1's string which it would otherwise be a substring of) | `<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg">` | no |
| 3 | `mr-4 p-2 rounded-lg hover:bg-white/50 transition` | `mr-4 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition` | no |
| 4 | `w-6 h-6 text-gray-700` | `w-6 h-6 text-text` | no |
| 5 | `text-2xl md:text-3xl font-bold text-gray-900` | `text-2xl md:text-3xl font-bold text-text` | no |
| 6 | `bg-white rounded-2xl shadow-lg p-6 mb-6 space-y-4` | `bg-surface rounded-2xl shadow-lg p-6 mb-6 space-y-4` | no |
| 7 | `block text-sm font-medium text-gray-700 mb-1` | `block text-sm font-medium text-text-muted mb-1` | **yes** (título label + vídeo-do-dia label — 2x identical) |
| 8 | `w-full border border-gray-300 rounded-lg px-3 py-2` | `w-full border border-border bg-surface text-text rounded-lg px-3 py-2` | **yes** (título input + vídeo-do-dia input — 2x identical) |
| 9 | `bg-white rounded-2xl shadow-lg p-6 mb-6` (exercises card wrapper — note: distinct string from #6, no `space-y-4` suffix) | `bg-surface rounded-2xl shadow-lg p-6 mb-6` | no |
| 10 | `text-xl font-bold text-gray-900 mb-4` | `text-xl font-bold text-text mb-4` | no |
| 11 | `border border-gray-200 rounded-lg p-4` (per-exercise card wrapper) | `border border-border rounded-lg p-4` | no |
| 12 | `text-sm font-medium text-gray-500` ("Exercício {index + 1}") | `text-sm font-medium text-text-muted` | no |
| 13 | `w-4 h-4 text-gray-600` (ArrowUp + ArrowDown icons) | `w-4 h-4 text-text-muted` | **yes** (2x identical) |
| 14 | `w-4 h-4 text-red-600` (Trash2 icon) | `w-4 h-4 text-red-600 dark:text-red-400` | no |
| 15 | `border border-gray-300 rounded-lg px-3 py-2 md:col-span-2` (the type `<select>` — a superset of row 16's string below; do this one **first**, or row 16's replace_all would also incorrectly match inside this string) | `border border-border bg-surface text-text rounded-lg px-3 py-2 md:col-span-2` | no |
| 16 | `border border-gray-300 rounded-lg px-3 py-2` (exercise-grid text inputs: nome, repetições, séries, nota, vídeo, grupo; safe now that row 15 has already consumed the `<select>`'s longer variant) | `border border-border bg-surface text-text rounded-lg px-3 py-2` | **yes** (6x identical) |
| 17 | `mt-4 inline-flex items-center px-4 py-2 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50` ("Adicionar exercício") | `mt-4 inline-flex items-center px-4 py-2 rounded-lg border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40` | no |
| 18 | `fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4` | `fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4` | no |

- [ ] **Step 2: Verify no leftover hardcoded colors** (grep check per Global Constraints).
- [ ] **Step 3: Run `npx vitest run --dir . src/__tests__/AdminWorkoutEdit.test.tsx --exclude "**/.claude/**"`** — must still pass, and `npm run check` clean.
- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/AdminWorkoutEdit.tsx
git commit -m "style: dark mode for AdminWorkoutEdit page"
```

---

### Task 15: Full-suite verification

**Files:** None modified — this task only runs checks across everything Tasks 1-14 touched.

- [ ] **Step 1: Run the full test suite scoped away from the stale worktree copy**

Run: `npx vitest run --dir . src/__tests__ --exclude "**/.claude/**"`
Expected: same pass/fail shape as before this plan started — every test that passed before still passes (including the tests exercised in Tasks 2, 10, 12, 13, 14), and the pre-existing, unrelated `src/__tests__/Dashboard.test.tsx` failure (missing `../pages/Dashboard` module, present before this work) is the only failure, if any.

- [ ] **Step 2: Type-check and lint**

Run: `npm run check` — expect no errors.
Run: `npm run lint` — expect no *new* errors (this repo has pre-existing unrelated lint errors elsewhere; don't fix those, just confirm nothing new was introduced in the 14 files this plan touched).

- [ ] **Step 3: Grep sweep across all 14 files for leftover hardcoded colors**

Run (adjust to your grep tool):
```
grep -rnE "text-gray-(400|500|600|700|800|900)|border-gray-(100|200|300)" \
  src/pages/Home.tsx src/pages/Login.tsx src/pages/Register.tsx src/pages/Onboarding.tsx \
  src/pages/ForgotPassword.tsx src/pages/ResetPassword.tsx src/pages/ResetConfirm.tsx \
  src/pages/ProgramDays.tsx src/pages/HIIT.tsx \
  src/pages/admin/AdminDashboard.tsx src/pages/admin/AdminProgramList.tsx \
  src/pages/admin/AdminUsers.tsx src/pages/admin/AdminWorkoutEdit.tsx \
  src/pages/admin/AdminWorkoutList.tsx
```
Expected: zero matches (the `HIIT.tsx` commented-out block is JSX-commented text, not live `className`, and uses `border-gray-300`/`text-gray-900` inside `{/* */}` — if your grep flags it, confirm by eye that the only matches are inside that comment block, and leave them; any match in *active* code is a real gap to fix before this task closes).

- [ ] **Step 4: Commit** (only if Steps 1-3 required any fix-up; otherwise this task closes with no commit)

## Manual verification (after all tasks)

Run `npm run dev`, log in, toggle dark mode from the Profile page, and click through all 14 pages plus `Home` → `HIIT`, `Home` → a program → `ProgramDays` → a day (`WorkoutDay`, already done), `/admin`, and each admin sub-page. Confirm:
1. No page shows a leftover white card or unreadable dark-on-dark / light-on-light text.
2. Form inputs (Login, Register, ForgotPassword, ResetPassword, AdminWorkoutEdit) are legible — typed text visible against the input background.
3. Status banners (login/register errors, reset-password success) are legible in both themes.
4. The Home page's PDF preview still shows a white document page (intentional, not a bug).

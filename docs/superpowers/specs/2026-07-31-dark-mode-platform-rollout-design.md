# Dark mode rollout across the platform

## Contexto

The app already has a working theme system: CSS-variable-backed Tailwind
tokens (`bg`, `surface`, `text`, `text.muted`, `border`) defined in
`tailwind.config.js` and `src/index.css` (`:root` for light, `.dark` for
dark), a `useTheme` hook / `themeStore` / `ThemeInit` component that toggles
the `dark` class on `<html>`, and a working toggle exposed on the Profile
page (`src/pages/Profile.tsx`).

Coverage is inconsistent. A `dark:` class count per file shows:

- **Already dark-mode-aware:** `src/pages/Profile.tsx`, `src/pages/WorkoutDay.tsx`,
  `src/components/ExerciseItem.tsx`, and every component in
  `src/components/ui/` (`Button`, `Card`, `Input`, `Modal`, `PageHeader`,
  `BottomNav`, `ChoiceGroup`, `FormField`, `Skeleton`, `Spinner`) already use
  the token system.
- **Zero `dark:` coverage — hardcoded `gray`/`white` Tailwind colors
  throughout:** `src/pages/Home.tsx`, `src/pages/Login.tsx`,
  `src/pages/Register.tsx`, `src/pages/Onboarding.tsx`,
  `src/pages/ForgotPassword.tsx`, `src/pages/ResetPassword.tsx`,
  `src/pages/ResetConfirm.tsx`, `src/pages/ProgramDays.tsx`,
  `src/pages/HIIT.tsx`, `src/pages/admin/AdminDashboard.tsx`,
  `src/pages/admin/AdminProgramList.tsx`, `src/pages/admin/AdminUsers.tsx`,
  `src/pages/admin/AdminWorkoutEdit.tsx`,
  `src/pages/admin/AdminWorkoutList.tsx`.
- `src/components/Layout.tsx` and `src/components/Empty.tsx` have no
  hardcoded colors and need no change.

The color pattern is consistent across every page in the second group:
`bg-white` for card/page surfaces, `text-gray-900` for primary text,
`text-gray-600`/`text-gray-700` for secondary text, `border-gray-300` for
borders, and purple/pink brand accents (buttons, links, icons) layered on
top. This is the same shape of change already applied to `WorkoutDay.tsx`
in a prior branch (`bg-white` → `bg-surface`, `text-gray-900` → `text-text`,
`text-gray-600/700` → `text-text-muted`, `border-gray-300` → `border-border`,
page-background gradients gain `dark:from-bg dark:to-bg`, brand purple/pink
accents are kept and only gain a `dark:` variant where contrast requires
it — e.g. `text-purple-600 dark:text-purple-400`).

## Objetivo

Every page in the app renders correctly and legibly when the user has dark
mode enabled (toggled from Profile), using the existing token system —
no page should still show hardcoded light-only `white`/`gray` surfaces or
text once this work is done.

## Fora de escopo

- The theme system itself: tokens, CSS variables, the `useTheme` hook,
  `themeStore`, `ThemeInit`, and the toggle's location/UX on the Profile
  page. This work only extends token *usage* to the remaining pages.
- Any component in `src/components/ui/` — already token-based, not touched.
- `WorkoutDay.tsx`, `ExerciseItem.tsx`, `Profile.tsx` — already done.
- `Layout.tsx`, `Empty.tsx` — no hardcoded colors, nothing to change.
- Any new brand color decisions (e.g. redesigning the dark palette itself,
  changing what "dark purple" means). The existing `.dark` CSS variables in
  `src/index.css` are the palette; this work only wires more pages to them.
- Backend, data model, or Supabase changes — none of this touches data.

## Design

### Scope

14 pages, one plan, one branch, one PR:

**User-facing:** `Home.tsx`, `Login.tsx`, `Register.tsx`, `Onboarding.tsx`,
`ForgotPassword.tsx`, `ResetPassword.tsx`, `ResetConfirm.tsx`,
`ProgramDays.tsx`, `HIIT.tsx`.

**Admin:** `AdminDashboard.tsx`, `AdminProgramList.tsx`, `AdminUsers.tsx`,
`AdminWorkoutEdit.tsx`, `AdminWorkoutList.tsx`.

### Pattern (per page)

For each page, apply the same substitution rules already validated on
`WorkoutDay.tsx`:

- `bg-white` (on cards/surfaces) → `bg-surface`
- `text-gray-900` → `text-text`
- `text-gray-600`, `text-gray-700`, `text-gray-500`, `text-gray-400`
  (secondary/muted text) → `text-text-muted`
- `border-gray-300`, `border-gray-200` → `border-border`
- Page-level background gradients (`bg-gradient-to-br from-purple-50
  to-pink-50` or similar) gain a `dark:from-bg dark:to-bg` variant,
  matching `WorkoutDay.tsx`.
- Purple/pink brand accents (buttons, links, icons, focus rings) are kept
  as-is; only add a `dark:` variant where the existing shade would fail
  contrast against the dark background (judged the same way it was for
  `WorkoutDay.tsx` — e.g. `text-purple-600` on a light card becomes
  `text-purple-600 dark:text-purple-400` when used as body text/links, but
  a solid `bg-purple-600` button with white text stays as-is since it
  already has enough contrast in both themes).
- Status colors (success green, error red, warning yellow) follow the same
  `dark:bg-*-950/30 dark:border-*-800 dark:text-*-400` pattern already used
  on `WorkoutDay.tsx`'s completed-banner and warmup/drop-set exercise
  styling.

This is a pure `className` change on every page — no logic, no new props,
no new components, no test behavior changes. Existing tests must continue
to pass unmodified (none of them assert on Tailwind class names).

### Task structure

One task per page (14 tasks), each self-contained: read the page, apply
the substitution pattern to every hardcoded color, verify no `gray`/`white`
survives (grep check), run the page's existing test file if one exists,
commit. No new tests are required per task (matches how `WorkoutDay.tsx`'s
Task 3 — the equivalent pure-`className` task — was handled: no new test
file, just confirm the existing suite still passes).

### Verification

- Full test suite passes (scoped to real project tests — the pre-existing,
  unrelated `Dashboard.test.tsx` failure, present since before this work,
  is out of scope and not touched).
- `npm run check` (TypeScript) and `npm run lint` clean.
- Manual spot-check: toggle dark mode from Profile, click through each of
  the 14 pages, confirm no leftover white/gray surface or unreadable text.

## Riscos e mitigação

- **14 nearly-identical tasks risk losing precision if rushed.** Mitigation:
  each task in the implementation plan gets the exact before/after
  `className` text for that specific page (like `WorkoutDay.tsx`'s Task 3),
  not a generic instruction to "apply the pattern" — this keeps every task
  transcription-plus-verification, the same low-risk shape as prior
  mechanical tasks in this codebase.
- **Admin pages are lower-traffic and easier to get subtly wrong without
  notice.** Mitigation: same task rigor applies to admin pages as user-facing
  ones — no reduced scrutiny — plus the final whole-branch review covers
  all 14 pages together.
- **A page might have a color pattern that doesn't fit the standard
  substitution rules** (e.g. an inline SVG with a hardcoded `fill`, or a
  status color not covered by the standard list). Mitigation: task
  implementers are instructed to flag anything that doesn't map cleanly
  onto the pattern (DONE_WITH_CONCERNS) rather than invent a new rule
  silently; the controller resolves it during task review.

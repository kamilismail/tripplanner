<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth Entry Redesign

- **Plan**: context/changes/auth-entry-redesign/plan.md
- **Scope**: Phase 2 of 3
- **Reviewed phases**: 2
- **Date**: 2026-11-15
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

Diff `51d0a13` touches exactly the planned files plus `plan.md`. Nothing is missing and there are no unplanned files.
Automated criteria were re-run during review: lint 0, astro check 0 errors and 0 warnings, build 0, literal scan clean
(with `src/pages/index.ts`), grep clean, smoke 13/13 passed. Manual items 2.7–2.12 were confirmed by the user.

## Findings

### F1 — Hard-coded field ids collide when several forms render on one page

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/auth/SignInForm.tsx:59,74; src/components/auth/SignUpForm.tsx:81,96,120; src/components/auth/FormField.tsx:35-36
- **Detail**: The ids `email`, `password` and `confirmPassword` are literals. FormField derives `${id}-error` and
  `${id}-hint` from them. Phase 3 renders several SignIn and SignUp instances on `/dev/kitchen-sink`, which would
  create duplicate ids, so `htmlFor` and `aria-describedby` would resolve to the wrong instance. `GeneratorForm.tsx`
  already uses `useId()` for this.
- **Fix**: Derive the ids with `useId()` in both forms and keep the `name` attributes unchanged, so the POST body and
  smoke test stay the same.
- **Decision**: FIXED

### F2 — Plan lists the deleted src/pages/index.astro in its scan commands

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/auth-entry-redesign/plan.md:432 (2.4 command), plan.md:514 (Phase 3 `defaultFiles()` contract)
- **Detail**: Phase 1 replaced `index.astro` with the `index.ts` redirect endpoint. The 2.4 command as written exits 2
  ("Missing file"). It was run with `index.ts` instead (ADAPT). If Phase 3 copies the same path into `defaultFiles()`,
  CI `lint:ui` would break.
- **Fix**: Add a plan addendum that `src/pages/index.astro` → `src/pages/index.ts` in 2.4 and in the Phase 3 guard
  list.
- **Decision**: FIXED

### F3 — bfcache reset effect duplicated in both forms

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/auth/SignInForm.tsx:19-28; src/components/auth/SignUpForm.tsx:22-31
- **Detail**: The same `pageshow` effect appears in both forms. CLAUDE.md puts hooks in `src/components/hooks/`.
  Separately, if the user aborts navigation (Esc/Stop), `submitting` stays true until reload, because `pageshow` does
  not fire in that case.
- **Fix**: Extract `usePendingSubmit()` into `src/components/hooks/`, returning `[submitting, start]` with the pageshow
  reset.
- **Decision**: FIXED (hook `src/components/hooks/usePendingSubmit.ts`; the abort edge case is left as is)

### F4 — Password toggle combines a swapping label with aria-pressed

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/auth/PasswordToggle.tsx:17-18
- **Detail**: The label changes between "Show password" and "Hide password" and `aria-pressed` is also set, so screen
  readers announce "Hide password, pressed", which reads as a double negative.
- **Fix**: Keep a constant `aria-label="Show password"` together with `aria-pressed={visible}`.
- **Decision**: FIXED

### F5 — Auth page titles lack the app suffix, and CardTitle is always level 1

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/layouts/AuthLayout.astro:14; src/components/auth/AuthCard.astro:16
- **Detail**: The `<title>` is the bare "Sign in", while AppLayout pages use "… · TripPlanner". The CardTitle
  `aria-level={1}` will add extra h1s when Phase 3 renders AuthCard inside the kitchen sink.
- **Fix**: AuthLayout passes `${title} · TripPlanner` to Layout, and AuthCard gets an optional `headingLevel` prop
  (default 1).
- **Decision**: FIXED

### F6 — Banner AA contrast on the destructive/10 tint not recorded

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/components/Banner.astro:5
- **Detail**: The plan asked for an AA check of `text-destructive` on the chosen background. The implementer estimated
  about 4.9:1 (5.36:1 on `background`, per theme-values.md), but no measured value is recorded.
- **Fix**: Measure the ratio and note it in change.md, or in theme-values.md if it falls below 4.5.
- **Decision**: FIXED (light 4.57–4.67:1, dark 6.19:1, recorded in change.md)

### F7 — Failed client validation gives screen readers no feedback

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/auth/SignInForm.tsx:48-54; src/components/auth/SignUpForm.tsx:62-68
- **Detail**: When `validate()` fails, focus stays on the button and the error `<p>` is not a live region.
  GeneratorForm has the same gap, so this is not a regression.
- **Fix**: Focus the first invalid input in the `!validate()` branch.
- **Decision**: FIXED (`validate()` returns the invalid keys; focus moves after render via `setTimeout(0)`; `requestAnimationFrame` does not fire in a hidden pane)

### F8 — ?error= text is reflected verbatim (pre-existing)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/auth/signin.astro:7; src/pages/auth/signup.astro:7; src/pages/api/auth/{signin,signup}.ts
- **Detail**: React escapes the text, so this is not XSS. A crafted link can still place arbitrary text in the
  destructive Alert (content spoofing). Supabase `error.message` is forwarded as is, which may allow account
  enumeration on sign-up. This predates Phase 2 and is outside the plan's scope.
- **Fix**: Queue a follow-up change that passes error codes and maps them to fixed English messages.
  - Strength: Removes both spoofing and enumeration, and centralises the copy.
  - Tradeoff: Touches the API routes, the pages and the smoke assertions (`?error=` prefixes stay the same).
  - Confidence: MED — the mapping of Supabase errors needs checking.
  - Blind spot: Have not listed every Supabase error message that can reach the UI.
- **Decision**: FIXED (queued as a follow-up change in `follow-ups/review-fixes.md`)

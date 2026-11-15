<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Auth Entry Redesign Implementation Plan

- **Plan**: context/changes/auth-entry-redesign/plan.md
- **Mode**: Deep
- **Date**: 2026-09-30
- **Verdict**: REVISE → SOUND after triage
- **Findings**: 0 critical, 5 warnings, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | WARNING |
| Architectural Fitness | WARNING |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

17/17 paths ✓, 9/9 symbols ✓ (PROTECTED_ROUTES, useFormStatus, MIN_PASSWORD_LENGTH, bg-cosmic:120,
Section/Cell:91-113, alert destructive, enable_confirmations:209, ci.yml:56, AppHeader:16-23), brief↔plan ✓,
Progress↔Phase ✓

## Findings

### F1 — Pierwszy statyczny render React z Astro: ciche pułapki

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 §1 AuthLayout; Critical Implementation Details
- **Detail**: AuthLayout is the repo's first non-hydrated React render from `.astro`. `@astrojs/react/dist/server.js:55`
  deletes the `class` prop (classes vanish silently), and named slots become React props (`:57-63`), not children.
- **Fix**: Add to Critical Implementation Details: `className` on React components in `.astro`; `<slot name="footer" />`
  as the child of `<CardFooter>`.
- **Decision**: FIXED

### F2 — Kryterium 2.9 koliduje z regułą guest-only

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 Manual Verification 2.9
- **Detail**: After sign-in, Back from `/trips` either re-requests `/auth/signin` (302 → `/trips`, the button is never
  visible) or restores from bfcache. The criterion described only the second outcome.
- **Fix**: Rephrase 2.9 (phase and Progress, same number) to accept both outcomes, never a stuck disabled button.
- **Decision**: FIXED

### F3 — Session-expired (D3): niepełna lista plików i niejasne „retry”

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §7
- **Detail**: The error path also runs through `TripsPanel.tsx`, `GeneratorForm.tsx`, `PlanReview.tsx` and ~10
  fixtures in `KitchenSink.tsx`. "In place of the retry action" applies only to `ListError`.
- **Fix**: Name the files; the new prop is optional (default `false`); the link replaces "Try again" in `ListError` and
  sits next to the message elsewhere.
- **Decision**: FIXED

### F4 — Brak propsa fikstury dla stanu „Password visible”

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §1
- **Detail**: `showPassword` is local state (`SignInForm.tsx:15`) and no fixture prop seeded it.
- **Fix**: Add `initialShowPassword?: boolean` to the fixture props.
- **Decision**: FIXED

### F5 — AuthCard wyodrębniany dopiero w Phase 3

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2 §1 vs Phase 3 §2
- **Detail**: Phase 2 built the card inline in AuthLayout and Phase 3 planned to extract it — a scheduled refactor.
- **Fix**: Create `src/components/auth/AuthCard.astro` in Phase 2; Phase 3 only uses it; add it to scan 2.4.
- **Decision**: FIXED

### F6 — Scoped `html, body { height:100% }` w Layout.astro nieopisany

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §1 Layout.astro
- **Detail**: The `<style>` block (`Layout.astro:46-53`) compiles unlayered and beats Tailwind utilities, pinning body
  to 100vh.
- **Fix**: Remove the `<style>` block in favour of `m-0 flex min-h-screen flex-col` on body.
- **Decision**: FIXED

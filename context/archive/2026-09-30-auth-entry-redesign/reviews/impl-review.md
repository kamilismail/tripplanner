<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth Entry Redesign

- **Plan**: context/changes/auth-entry-redesign/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-15
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

The scope was `b7e3cb9..HEAD`: 40 files across 5 commits. Every Desired End State bullet holds, and every "What We're
NOT Doing" boundary was respected. The changes outside the plan are documented adaptations: `index.ts`,
`lib/auth.ts`, `usePendingSubmit`, `ConfirmEmailBody`, and the Banner screenshot replaced by the kitchen-sink cell
(user decision).

The automated criteria of all phases were re-run during review:

- lint:ui (extended defaults): clean
- lint: 0
- astro check: 0 errors and 0 warnings
- build: 0
- smoke: all steps passed
- the `dashboard|Welcome|Topbar` and `bg-cosmic|useFormStatus` greps: clean
- screenshots: 8 files

All 31 Progress rows are `[x]`. Cross-phase checks (guest-only rule vs `/api/auth/*`, trailing slashes, open
redirects, CSRF via `checkOrigin`, session-expired flags, fixture props unused in production) are clean.

Items from the phase 1 and phase 2 reviews and the `?error=` follow-up are not repeated here.

## Findings

### F1 — Production 404 of /dev/kitchen-sink rests on one guard and is untested

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/middleware.ts:11; src/pages/dev/kitchen-sink.astro
- **Detail**: Only the middleware prefix check keeps the kitchen sink out of production. The page has no
  `import.meta.env.DEV` guard, and smoke does not assert the 404, although CI runs smoke against the production
  preview. A middleware refactor would silently ship the page. The page holds fixtures only, so the impact is low,
  but the CLAUDE.md guarantee is not tested.
- **Fix A ⭐ Recommended**: Add a second guard in the page frontmatter that returns a 404 outside DEV.
  - Strength: Defence in depth at the page itself, independent of the middleware. It is a 2-line change.
  - Tradeoff: Still not tested.
  - Confidence: HIGH — Astro pages can return a `Response` from the frontmatter.
  - Blind spot: ESLint may object to `return` in the frontmatter (Phase 1 hit this on `index.astro`). A rewrite to
    `/404` avoids it.
- **Fix B**: Add a smoke step that expects a 404, enabled by an env flag that CI sets for the production preview.
  - Strength: It is a real regression test in CI.
  - Tradeoff: Smoke locally runs against dev, where the page is 200, so the step needs a flag (for example
    `SMOKE_PROD=1`) plus a CI workflow edit.
  - Confidence: MED — this touches `.github/workflows/ci.yml`.
  - Blind spot: The step would not run locally.
- **Decision**: FIXED via Fix A (`Astro.response.status = 404` plus `{isDev && …}`; `return` in the frontmatter
  crashes typescript-eslint)

### F2 — The literal scan silently skips missing guarded files and doesn't recurse

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/check-ui-literals.mjs:31-36,57
- **Detail**: `defaultFiles().filter(existsSync)` and `listDir` (which returns `[]` for a missing dir) shrink the
  coverage without a message when a guarded file is renamed. This is the same class as phase 2 F2, and now it fails
  silently. `listDir` is also non-recursive.
- **Fix**: Print `skipped (missing): …` for default entries that don't exist, or exit 2.
- **Decision**: FIXED (a warning on stderr for missing files and dirs; the exit code is unchanged)

### F3 — The kitchen-sink page itself is not in the literal scan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: package.json:67; scripts/check-ui-literals.mjs `defaultFiles()`
- **Detail**: `src/pages/dev/kitchen-sink.astro` now contains hand-written markup (the Banner mirror and link classes)
  but is in neither the default list nor the lint-staged glob.
- **Fix**: Add `src/pages/dev/*.astro` to both lists.
- **Decision**: FIXED (`defaultFiles()`, the lint-staged glob checked with picomatch, and the scan-scope lines in
  CLAUDE.md)

### F4 — Kitchen sink duplicates the AuthCard frame and the Banner content

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/auth/AuthKitchenSink.tsx:12-23; src/pages/dev/kitchen-sink.astro:44-63 vs src/layouts/Layout.astro:28-40
- **Detail**: `AuthFrame` is a React copy of `AuthCard.astro`, and the Banner cell copies the warning, message and
  link markup from `Layout.astro`. If the originals change, the visual gate keeps showing the old look.
- **Fix**: Extract the Banner content into `src/components/BannerContent.astro`, used by both `Layout` and the
  kitchen sink, and add a "keep in sync with AuthCard.astro" comment on `AuthFrame`.
- **Decision**: FIXED (as `src/components/ConfigBanner.astro`, which renders the whole Banner for one config entry
  and is used by Layout and the kitchen sink and is added to the scan lists; plus the sync comment on `AuthFrame`)

### F5 — Sign-up placeholder hard-codes the minimum length

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/auth/SignUpForm.tsx (password `placeholder="Min. 6 characters"`)
- **Detail**: `MIN_PASSWORD_LENGTH` is centralised in `src/lib/auth.ts`, and validation and the hint use it, but the
  placeholder is the literal 6.
- **Fix**: Use ``placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}``.
- **Decision**: FIXED

### F6 — Smoke doesn't cover guest-only /auth/signup or the trailing-slash form

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/smoke.mjs:38-76
- **Detail**: For a signed-in user only `/auth/signin` is asserted. Nothing exercises `/auth/signup` or
  `/auth/signin/`. The confirm-email branch cannot run locally, because confirmations are off.
- **Fix**: Add signed-in steps `/auth/signup` → 302 `/trips` and `/auth/signin/` → 302 `/trips`.
- **Decision**: FIXED (2 steps added; smoke now has 15 steps, all passing)

### F7 — /dev/* production 404 has an empty body

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/middleware.ts:12
- **Detail**: `new Response(null, { status: 404 })` shows a blank page instead of the app's 404 handling. This
  predates this change; Phase 1 only kept it.
- **Fix**: Use `context.rewrite("/404")`, or leave it as is.
- **Decision**: FIXED (verified on a production preview: `/dev/kitchen-sink` → 404 "404: Not Found"; smoke passes
  against the preview)

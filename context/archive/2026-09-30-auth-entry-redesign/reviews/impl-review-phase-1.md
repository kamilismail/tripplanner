<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth Entry Redesign

- **Plan**: context/changes/auth-entry-redesign/plan.md
- **Scope**: Phase 1 of 3
- **Reviewed phases**: 1
- **Date**: 2026-11-15
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Notes: 0 MISSING, 0 intent DRIFT. The known adaptations are `src/pages/index.ts` instead of `index.astro`, and "Try again" hidden in `GeneratorForm` when the session expired; the user approved the second. Automated gates (lint, astro check, build, lint:ui, smoke 12/12, grep) passed on commit 3f444cd. Manual checks 1.7–1.9 were confirmed by the user.

## Findings

### F1 — Sign-out ignores signOut() error; guest-only rule bounces the user back

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signout.ts:9
- **Detail**: `await supabase.auth.signOut()` result is ignored. On a network/API error supabase-js returns early without clearing the local session, so cookies survive; the redirect to `/auth/signin` then hits the new guest-only rule (`middleware.ts:29`) and bounces to `/trips`. The user silently cannot sign out. Before this phase the redirect went to `/`, so no bounce existed.
- **Fix**: Call `supabase.auth.signOut({ scope: "local" })`, which clears the session cookies without depending on the API call succeeding.
- **Decision**: DISMISSED — the installed auth-js (`GoTrueClient._signOut`) already removes the local session when `admin.signOut` fails (any scope except `others`), so the bounce does not happen. Only a session-read error returns early, and `scope: "local"` would not change that path.

### F2 — PlanReview keeps "Accept" active when the session expired

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/components/trips/PlanReview.tsx:71
- **Detail**: `TripList` and `GeneratorForm` hide their retry when `sessionExpired`, but `PlanReview` keeps Accept (the save retry) enabled. Clicking again in the same tab gives another 401. The "Sign in" link is a full navigation that discards the unsaved plan.
- **Fix A ⭐ Recommended**: Leave Accept enabled, add a code comment explaining why
  - Strength: The user can sign in in another tab and press Accept again, so the generated plan is saved. Hiding Accept would make losing the plan the only path.
  - Tradeoff: Inconsistent with the other two alerts.
  - Confidence: MED — cookies are shared across tabs, so a retry after signing in elsewhere should succeed; not tested.
  - Blind spot: Not verified manually end to end.
- **Fix B**: Hide/disable Accept when `sessionExpired`, matching GeneratorForm and TripList
  - Strength: Consistent behaviour across the three alerts.
  - Tradeoff: Removes the only way to rescue an unsaved plan.
  - Confidence: HIGH — trivial change.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix B (Accept disabled while `sessionExpired`; Discard stays enabled)

### F3 — Kitchen sink lacks session-expired cells for GeneratorForm and PlanReview

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/trips/KitchenSink.tsx:249
- **Detail**: Only the Trip list section got a "Session expired" cell. CLAUDE.md says "a new view state or component = a new section in the kitchen sink". GeneratorForm and PlanReview gained a new state with no cells.
- **Fix**: Add "Session expired" cells to the GeneratorForm and PlanReview sections (`sessionExpired` + error message).
- **Decision**: FIXED — "Session expired" cells added to the Generator form and Plan review sections (verified in /dev/kitchen-sink)

### F4 — "Sign in" link placement differs between alerts

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/trips/TripList.tsx (ListError), GeneratorForm.tsx:134, PlanReview.tsx:57
- **Detail**: `ListError` renders the link below the alert in place of "Try again". The other two render it inside `AlertDescription` with `cn(..., "h-auto p-0")`. The plan prescribed this split, so it is not drift, but the same state looks different in three places.
- **Fix**: Leave as is; revisit if a shared `SessionExpiredLink` becomes useful.
- **Decision**: SKIPPED — placement follows the plan

### F5 — Middleware uses normalized path for guest-only but raw pathname for protected

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/middleware.ts:27, :33
- **Detail**: The two route lists use different path forms. Harmless today: `startsWith` already covers `/trips/`, and the API checks `locals.user` again.
- **Fix**: Use one normalized path for both checks.
- **Decision**: FIXED — protected and /api checks use the normalized path

### F6 — Raw zod messages for missing form fields

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signin.ts:16, signup.ts:19
- **Detail**: A missing field (only reachable by a crafted POST) shows zod's default "Invalid input: expected string, received undefined" in the alert.
- **Fix**: Add `{ error: "Email is required" }` / `{ error: "Password is required" }` to the `z.string()` calls.
- **Decision**: FIXED — `z.string({ error: "... is required" })` on email/password in signin and signup (missing email → "Email is required")

### F7 — MIN_PASSWORD_LENGTH duplicated between route and form

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/auth/signup.ts:7, src/components/auth/SignUpForm.tsx:8
- **Detail**: The same constant lives in two places, linked only by a comment, so the two can drift apart.
- **Fix**: Move the constant to `src/lib/` and import it in both places.
- **Decision**: FIXED — `MIN_PASSWORD_LENGTH` moved to `src/lib/auth.ts`, imported by signup.ts and SignUpForm.tsx

### F8 — Smoke does not cover the /api/trips 401 contract; useTrips comment overstates the redirect path

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs, src/components/hooks/useTrips.ts:42
- **Detail**: The session-expired UI relies on middleware returning JSON 401 for `/api/*`, and no smoke step asserts it. The `response.redirected` branch is defensive and does not trigger today.
- **Fix**: Add the smoke step "GET `/api/trips` anonymous → 401" and reword the comment to name 401 as the primary signal.
- **Decision**: FIXED — smoke step "trips API rejects anonymous user" (GET /api/trips → 401, now 13 steps); useTrips comment names the 401 as the primary signal

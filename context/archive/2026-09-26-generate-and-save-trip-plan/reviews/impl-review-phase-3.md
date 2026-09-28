<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Generate and Save a Trip Plan

- **Plan**: context/changes/generate-and-save-trip-plan/plan.md
- **Scope**: Phase 3 of 5
- **Reviewed phases**: 3
- **Date**: 2026-09-27
- **Verdict**: REJECTED
- **Findings**: 1 critical, 1 warning, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Expired session shows false "trip saved" success

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/trips/TripGeneratorFlow.tsx:105-121 (root cause src/middleware.ts:18-21)
- **Detail**: `/api/trips` is in `PROTECTED_ROUTES`. The middleware answers an unauthenticated API call with a 302 to `/auth/signin`. `fetch` follows the redirect and gets the sign-in HTML page with a 200. `handleAccept` checks only `response.ok`, so it clears the plan and shows "Your N-day trip to X has been saved." In reality nothing was persisted and the generated plan is lost. The same redirect makes `generate()` fail on JSON parsing and show the generic network error. As a result, the 401 branches in the client (L33, L42) and the JSON 401s in the API routes can never be reached.
- **Fix A ⭐ Recommended**: The middleware returns a JSON 401 for `/api/*` paths instead of redirecting. The client also treats `response.redirected` as an expired session.
  - Strength: API routes already return JSON 401s, which then become reachable. The fix covers both generate and save, plus Phase 4's GET.
  - Tradeoff: Touches `middleware.ts` from Phase 2, and changes the redirect behaviour that manual check 2.6 accepted for the API.
  - Confidence: HIGH — the cause is confirmed by reading the middleware and handler code.
  - Blind spot: `/api/auth/*` routes are not in `PROTECTED_ROUTES`, so they are unaffected. This has not been re-tested in the browser.
- **Fix B**: Client-only change: treat `response.redirected` (or a non-JSON body / missing `id`) as a session-expired error.
  - Strength: Smallest diff; only this phase's file changes.
  - Tradeoff: Every future API caller (e.g. Phase 4 TripList) must remember the same guard. The server's 401 code paths stay dead.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A — middleware returns JSON 401 for /api/*; client treats response.redirected as 401)

### F2 — Server accepts whitespace-only / unbounded city

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/trips/generate.ts:8, src/pages/api/trips/index.ts:9
- **Detail**: The client trims the city, but the server's `z.string().min(1)` has no trim and no maximum length. A direct API call can send `"   "` or a very long string, which ends up in the Gemini prompt (cost and prompt-injection surface) and in the DB. This is a Phase 2 gap that the Phase 3 client-side validation made visible.
- **Fix**: Use `z.string().trim().min(1).max(100)` in both schemas.
- **Decision**: FIXED

### F3 — `onTripSaved` cannot be passed from the .astro page

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/components/trips/TripGeneratorFlow.tsx:13-16, src/pages/trips.astro:19
- **Detail**: A `.astro` page cannot pass function props to an island. Phase 4's plan already allows for this ("same client island or lifted-state wrapper"), so a React wrapper island that holds both the generator and the list is needed.
- **Fix**: In Phase 4, add a `TripsPage.tsx` wrapper island that owns the refresh key and passes `onTripSaved`.
- **Decision**: SKIPPED — handled in Phase 4 (wrapper island)

### F4 — Loading/error/review states poorly announced to assistive tech

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/ui/spinner.tsx:9-10, src/components/trips/TripGeneratorFlow.tsx:250-255, 169, 136-139
- **Detail**: `Spinner` has `role="status"` even inside buttons, and it is nested inside another `role="status"`. The live region only mounts while loading, so screen readers may not announce it. `ServerError` has no `role="alert"`. Focus is lost when the view switches to the review screen.
- **Fix**: Mark `Spinner` `aria-hidden` when it is decorative, keep one always-mounted live region, add `role="alert"` to errors, and focus the review heading on entry.
- **Decision**: FIXED

### F5 — shadcn `aria-invalid` border overrides the glass-style red; mixed input patterns

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/trips/TripGeneratorFlow.tsx:215, 238; src/components/ui/input.tsx:13
- **Detail**: tailwind-merge keeps `aria-invalid:border-destructive`, which is more specific than `border-red-400/60`. Invalid fields therefore get the light-theme destructive border instead of the red used by `FormField`. `FieldError` duplicates the error markup from `FormField`, and `ServerError` is imported across domains from `components/auth`.
- **Fix**: Add `aria-invalid:border-red-400/60` to the override classes. Leave the shared-component cleanup for later.
- **Decision**: FIXED (aria-invalid:border-red-400/60 in inputClass; shared-component cleanup deferred)

### F6 — Day-count bounds duplicated between client and server

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/hooks/useTripGenerationForm.ts:5-6; src/pages/api/trips/generate.ts:9; src/pages/api/trips/index.ts:10
- **Detail**: The hook defines `MIN_TRIP_DAYS`/`MAX_TRIP_DAYS`, while both API schemas hardcode `1`/`14`. The two can drift apart silently.
- **Fix**: Move the constants to `src/lib/services/itinerary-schema.ts` and use them in the hook and both zod schemas.
- **Decision**: FIXED (constants moved to itinerary-schema.ts)

### F7 — Generate response cast without shape check

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/trips/TripGeneratorFlow.tsx:78
- **Detail**: The response is used via `(await response.json()) as GeneratedTripPlan` without validation. If `days` were missing, `[...plan.days]` (L137) would throw during render, and there is no error boundary. The risk is low because the server validates with zod.
- **Fix**: Guard with `Array.isArray(body?.days)` before `setPlan`, and otherwise go to the error state.
- **Decision**: FIXED

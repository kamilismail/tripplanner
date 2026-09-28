<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Generate and Save a Trip Plan

- **Plan**: context/changes/generate-and-save-trip-plan/plan.md
- **Scope**: Phase 4 of 5
- **Reviewed phases**: 4
- **Date**: 2026-09-27
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Just-saved trip can be overwritten by an in-flight GET

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/hooks/useTrips.ts:50 (setTrips(body)) with :66-68 (addTrip)
- **Detail**: `addTrip` prepends the saved trip to local state but does not reconcile with a `GET /api/trips` that is already in flight. If that GET was answered before the POST committed and resolves after `addTrip`, `setTrips(body)` replaces the list with a snapshot that lacks the new trip — it disappears (and loses its highlight) until reload, although it is persisted. Requires the initial GET or the `refresh()` fallback to outlast a full generate → review → accept cycle, so it is unlikely but possible on slow networks / cold Worker.
- **Fix**: In `useTrips`, remember locally added trip ids in a ref and, when a fetch resolves, keep those added trips that are missing from the response at the top of the list.
- **Decision**: FIXED — `addedTripsRef` in useTrips; fetched lists are merged with locally added trips missing from the response.

### F2 — Approved Phase 4 adaptations not recorded in the change docs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/changes/generate-and-save-trip-plan/change.md (Notes)
- **Detail**: Three user-approved deviations from the Phase 4 contract are documented nowhere: (a) fetch logic lives in `useTrips` owned by the `TripsPanel` wrapper; `TripList` is presentational (plan: TripList fetches on mount); (b) after save the POST 201 body is prepended via `addTrip` instead of re-fetching (dev server re-fetch took ~7 s), which changed Phase 3's `onTripSaved` signature to `(trip: TripWithPoints | null) => void`; (c) UI extras — collapsible cards, auto-expand/scroll/highlight of the new trip, "N places" count. Phases 1–3 recorded their ADAPTs in `change.md` Notes; future reviews (and Phase 5) will otherwise read the plan as ground truth and flag these as drift.
- **Fix**: Add a dated "Phase 4, ADAPT" note to `change.md` Notes listing (a)–(c) and the reason.
- **Decision**: FIXED — "Phase 4, ADAPT" note added to change.md Notes.

### F3 — Failed initial load has no retry; new trip shown under a stale error

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/trips/TripList.tsx:41, :53; src/components/hooks/useTrips.ts:70-72
- **Detail**: If the first `GET /api/trips` fails, the list shows only the error and there is no way to retry short of reloading. If the user then saves a trip, `addTrip` shows `[trip]` with "We couldn't load your trips" still above it — honest, but looks like a partial list. `refresh()` is exposed but no UI uses it.
- **Fix**: Render a "Try again" button next to the list error that calls `refresh()`.
- **Decision**: FIXED — `ListError` in TripList renders the error with a "Try again" button wired to `refresh()` via `TripsPanel` (`onRetry`); a retried first load shows the loading state instead of the stale error.

### F4 — Highlight can stick if a second trip is saved within 2.5 s

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/trips/TripList.tsx:78-88
- **Detail**: When `isNew` flips to false before the timer fires, the effect cleanup clears the timer and `setHighlighted(false)` never runs, so the earlier card keeps its highlight. Practically unreachable: a second save needs a full Gemini round trip (~8 s+).
- **Fix**: Skip for now; if needed, derive the highlight from `isNew` plus a timer instead of independent state.
- **Decision**: SKIPPED

### F5 — Shallow response shape checks and unreachable redirect branches

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/hooks/useTrips.ts:37-47; src/components/trips/TripGeneratorFlow.tsx:34-41
- **Detail**: API bodies are only shape-checked (array / `id` + `trip_points` array) and then cast; nested elements are not validated. The `response.redirected` branches are effectively dead since the middleware returns a JSON 401 for `/api/*`. Both match the existing pattern in `TripGeneratorFlow` and the data comes from our own server.
- **Fix**: No change needed — keep consistent with the existing pattern.
- **Decision**: SKIPPED

<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Generate and Save a Trip Plan

- **Plan**: context/changes/generate-and-save-trip-plan/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-09-28
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 4 observations

Focus of this full review: cross-phase issues and the Phase 5 scope addition (model pin + 503 retry). Findings already triaged in `impl-review-phase-{1..4}.md` are not repeated.

Automated criteria re-run on HEAD 0d290cf: `npx astro check` 0 errors, `npm run lint` exit 0, `npm run build` exit 0; `npm run smoke` 8/8 in the Phase 5 gate on identical code. All Manual rows (1.3–5.7) are checked; Phase 5 rows backed by browser evidence recorded in the session (signup/signin → generate 5.4 s → review → Accept 201 → refresh persists).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — 503 retry loop has no overall deadline

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/gemini.ts:93-116
- **Detail**: Each of up to 6 attempts gets its own `AbortSignal.timeout(20_000)`, and a 503 is retried however long it took to arrive. The comment assumes 503s are fast, but nothing enforces it: worst case ≈ 6 × 20 s + 5 × 1 s ≈ 125 s of spinner (the client fetch in TripGeneratorFlow.tsx:83 has no timeout). Correctness otherwise checked fine (1 + 5 attempts, `response` definitely assigned, retried bodies cancelled).
- **Fix**: Create one deadline before the loop (e.g. 40 s total), pass `AbortSignal.timeout(remaining)` per attempt and only retry when enough time remains; also `await response.body?.cancel()` on the final non-OK response.
- **Decision**: FIXED (differently: shared deadline raised to 60 s per the user — `GENERATION_DEADLINE_MS`; per-attempt timeout `min(ATTEMPT_TIMEOUT_MS, remaining)`, retry only if time remains after the 1 s pause; final non-OK body cancelled)

### F2 — Nothing in the app links to `/trips`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/Topbar.astro:10
- **Detail**: Desired End State: "A logged-in user can navigate to a trip-generation view". The Topbar links only to `/dashboard`, sign-in redirects to `/` (signin.ts:19), and dashboard.astro is unchanged — the trips page is reachable only by typing the URL. The plan never said to add a link, so this is a plan gap as much as an implementation one.
- **Fix**: Add a "Trips" link next to "Dashboard" in Topbar.astro (same classes).
- **Decision**: FIXED via Fix now ("Trips" link added before "Dashboard"; Topbar is rendered on the landing page, where sign-in redirects)

### F3 — `POST /api/trips` accepts unbounded point text and count

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/trips/index.ts:8-11 (schema from src/lib/services/itinerary-schema.ts:20-34)
- **Detail**: The save body is client-controlled (nothing ties it to what `/generate` returned). `name`/`description` have no max length, points per day are unbounded, and the DB columns are plain `text`, so a signed-in user can store arbitrarily large payloads. Authz is fine (user_id from session, RLS + trigger).
- **Fix**: Add `.max()` limits in the save schema only (e.g. name ≤ 200, description ≤ 2000, ≤ 20 points/day) so Gemini-side validation stays lenient.
- **Decision**: FIXED via Fix now (save-only `savePointSchema`/`saveRequestSchema` in index.ts: name ≤ 200, description ≤ 2000, 1–20 points/day, ≤ 14 days; `pointSchema`/`daySchema` now exported from itinerary-schema.ts)

### F4 — No per-user limit on generation; retry multiplies upstream calls

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/trips/generate.ts:13-59, src/lib/services/gemini.ts:26
- **Detail**: Any signed-in user can call `/api/trips/generate` without limit, and each call can now make up to 6 Gemini requests on the shared (now free-tier) key. A script or a spike can exhaust the RPM/RPD quota for everyone. The fixed 1 s pause has no jitter, so concurrent requests retry in lockstep during a 503 spike.
- **Fix A ⭐ Recommended**: Accept as MVP risk now; add jitter to the retry pause (e.g. 500–1500 ms) and record rate limiting as a follow-up.
  - Strength: PRD expects a small user base; jitter is a one-line change inside code already being touched for F1.
  - Tradeoff: Quota abuse remains possible until the follow-up lands.
  - Confidence: MED — depends on how public the deployment is.
  - Blind spot: Actual free-tier RPM/RPD for gemini-3.1-flash-lite not checked.
- **Fix B**: Add a simple per-user rate limit (e.g. N generations/minute) now.
  - Strength: Closes the abuse path before deploy.
  - Tradeoff: Needs state across Workers isolates (KV binding or a Supabase table + policy) — new infra, beyond this slice's plan.
  - Confidence: MED — KV `SESSION` binding exists, but no counter pattern in the repo yet.
  - Blind spot: KV eventual consistency makes a strict limit unreliable.
- **Decision**: FIXED via Fix A (retry pause jittered to 0.5–1.5 × 1 s; per-user rate limit accepted as MVP risk and queued in follow-ups/review-fixes.md)

### F5 — Undocumented "write in Polish" prompt instruction

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/lib/services/gemini.ts:68
- **Detail**: The prompt tells Gemini to write `name`/`description` in Polish (since 85bf653). Neither plan.md, change.md nor earlier reviews mention it; the rest of the UI is English ("Day 1", "3 days · 6 places"), so saved trips mix languages.
- **Fix**: Record the decision in change.md Notes (or drop the instruction if unintended).
- **Decision**: FIXED (differently, per the user: prompt now asks for `name`/`description` in English, matching the English UI)

### F6 — Failed points insert leaves an empty trip

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/trips/index.ts:87-94
- **Detail**: Trip and points are two inserts; if the second fails the trip row stays with zero points, and users cannot delete trips yet (S-03). Accepted as a risk in plan-brief; `trips_delete_own` policy now makes a cleanup cheap.
- **Fix**: Best-effort `delete().eq("id", trip.id)` before returning `save_failed`.
- **Decision**: FIXED via Fix now

### F7 — Upstream fetch not tied to the client request's abort signal

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/gemini.ts:97
- **Detail**: On Workers the runtime cancels subrequests when the client disconnects, so this is mostly harmless in production; under a Node preview the loop could keep retrying after the user left.
- **Fix**: Pass `context.request.signal` into `generateItinerary` and combine with the deadline via `AbortSignal.any`.
- **Decision**: SKIPPED

### F8 — CLAUDE.md environment section omits `GEMINI_API_KEY`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: CLAUDE.md (Environment section)
- **Detail**: Phase 1 planned a docs note for the new key; `.env.example` and `astro.config.mjs` have it, but CLAUDE.md still lists only `SUPABASE_URL`/`SUPABASE_KEY`, including for `.dev.vars` and the CI secrets.
- **Fix**: Add `GEMINI_API_KEY` to the Environment and CI lines of CLAUDE.md.
- **Decision**: FIXED via Fix now (Environment line only — the key is `optional: true` in env.schema and ci.yml doesn't use it, so the CI line stays accurate)

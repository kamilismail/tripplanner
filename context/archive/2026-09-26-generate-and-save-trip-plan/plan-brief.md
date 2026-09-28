# Generate and Save a Trip Plan — Plan Brief

> Full plan: `context/changes/generate-and-save-trip-plan/plan.md`

## What & Why

Build the product's north-star flow (roadmap S-01): a logged-in user enters a city and a day count, reviews an AI-generated day-grouped sightseeing itinerary, accepts it, and sees it saved in their trip panel. This is the PRD's Primary Success Criterion — nothing else in the roadmap validates the core hypothesis (that AI-generated, day-grouped plans are worth saving and reusing) until this works.

## Starting Point

The persistence foundation already exists: `trips`/`trip_points` tables with per-user RLS (F-01), and the app is deployable (F-02). Auth (sign in/up/out, `/dashboard` protection) is fully wired. Nothing else exists yet — no Gemini integration, no `/api/trips/*` routes, no trip UI beyond a static dashboard welcome card.

## Desired End State

A user on `/trips` submits a city + day count, sees continuous loading feedback while Gemini generates a plan, reviews it read-only, and either accepts (saving it and seeing it appear at the top of a trip list immediately) or discards (returning to the form with input preserved). A generation failure shows a clear error with a working retry.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Gemini call method | Plain `fetch()` REST, no SDK | Avoids Node-runtime-oriented SDK risk on Cloudflare Workers (`workerd`), flagged in tech-stack.md | Plan |
| Response contract | Gemini `responseSchema` (structured output) + server-side zod re-validation | Eliminates most parse failures at the source; zod is a second line of defense since schema conformance ≠ semantic correctness | Plan |
| Gemini failure handling | Show error + manual "Try again", no server-side auto-retry | Simple, predictable, avoids doubling latency and risking Cloudflare Worker time limits | Plan |
| Day-count bound | 1–14, enforced client + server | Typical trip length; bounds prompt size, latency, and AI cost | Plan |
| Unsaved plan storage | Client React state only, no server draft row | No extra `status` column or draft cleanup needed; PRD guardrails only protect *accepted* plans | Plan |
| Loading UX | Blocking spinner + status text, no streaming | Simple, satisfies the "no silent hang >2s" NFR without complicating structured-output parsing | Plan |
| Review-screen editing | Read-only review, accept or discard only | Keeps point editing in its own roadmap slice (S-02), avoiding scope creep the roadmap explicitly flags as this slice's main risk | Plan |
| Trip list order | `created_at DESC` (newest first) | Matches "appears in trip panel immediately after acceptance"; PRD defers sorting/filtering UI | Plan |
| Lat/long from AI | Requested optionally, saved if present and valid | Uses existing nullable columns without blocking a save when the model omits them | Plan |
| Landing page (`index.astro`) cleanup | Out of scope — separate task | Cosmetic starter-boilerplate cleanup is unrelated to any FR in this slice | Plan (user redirect) |

## Scope

**In scope:**
- Gemini integration service with a strict, validated day-grouped JSON contract
- `POST /api/trips/generate`, `POST /api/trips`, `GET /api/trips`
- `/trips` page: generation form → loading → review → accept/discard, plus a trip panel list
- Route protection for the new page/API via `src/middleware.ts`

**Out of scope:**
- Editing saved/generated points (S-02), deleting points or trips (S-03)
- Server-side draft persistence, streaming responses, auto-retry on AI failure
- Sorting/filtering the trip list beyond newest-first
- Any change to `src/pages/index.astro` or other landing-page content
- Map/geocoding UI using the stored lat/long values

## Architecture / Approach

`src/lib/services/gemini.ts` owns the external AI call (REST `fetch`, structured output, zod validation) behind `generateItinerary(city, dayCount)`. Three Astro API routes sit on top of it and Supabase, following the existing `src/pages/api/auth/*.ts` conventions. A React island on a new `/trips` page drives a client-only state machine (form → loading → review → accept/error) and a separate list component that refetches after a successful accept.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Gemini integration service | Validated `generateItinerary()` with a strict day-grouped JSON contract | Structured-output support and edge-runtime `fetch` behavior for the Gemini REST API need real-key verification |
| 2. Trip API routes | `generate`/save/list endpoints, route protection | Insert-order failure between `trips` and `trip_points` rows (no transaction) |
| 3. Generation and review UI | Form → loading → review → accept/discard flow | Loading-state UX must stay visible for the whole round trip (NFR) |
| 4. Trip panel | Newest-first list, refreshes on accept | List must not go stale after accept without a full reload |
| 5. End-to-end verification | Full browser walkthrough + smoke/build/lint pass | New `GEMINI_API_KEY` schema field must not break CI's build step |

**Prerequisites:** F-01 schema (done), a `GEMINI_API_KEY` for local/manual testing.
**Estimated effort:** ~5 sessions across 5 phases (after-hours solo pace).

## Open Risks & Assumptions

- Assumes the Gemini REST API's `responseSchema` support behaves the same under Cloudflare Workers' `fetch` as it does from Node — not yet verified with a real key against `workerd`.
- Assumes a non-transactional two-step insert (`trips` then `trip_points`) is an acceptable MVP risk; a partial failure leaves an empty trip the user can't yet delete (S-03 not built) until that slice lands.
- Assumes 1–14 days is an acceptable hard cap; not explicitly stated in the PRD, confirmed as a planning decision.
- Accepts that the 1–14 day-count cap is enforced only at the API layer (zod), not as a DB check constraint — the `trips` table only enforces `day_count > 0`. Low risk today since the API is the only write path; revisit if a second write path (e.g. an admin tool or direct DB script) is ever added.

## Success Criteria (Summary)

- A logged-in user can generate, review, accept, and immediately see a day-grouped trip in their trip panel, with visible feedback throughout generation.
- A second user never sees the first user's trips.
- A Gemini failure never silently hangs — it always resolves to review or a retryable error.

---
date: 2026-11-18T15:54:39+01:00
researcher: Claude (Sonnet 5.5)
git_commit: 9217a359f69d240bb177ce89234d720fea84bdad
branch: main
repository: tripplaner
topic: "Rollout Phase 1 of test-plan.md: test runner + Gemini boundary (Risk #1)"
tags: [research, codebase, gemini, generate-route, test-runner, vitest, astro-env]
status: partial
last_updated: 2026-11-18
last_updated_by: Claude (Sonnet 5.5)
---

# Research: Test runner + Gemini boundary (Risk #1)

**Date**: 2026-11-18T15:54:39+01:00
**Researcher**: Claude (Sonnet 5.5)
**Git Commit**: 9217a359f69d240bb177ce89234d720fea84bdad (working tree has uncommitted `.claude/` skill changes and `context/` files only; no `src/` changes)
**Branch**: main
**Repository**: tripplaner

## Research Question

Ground rollout Phase 1 of `context/foundation/test-plan.md`. Risk #1: on Gemini "busy", empty and malformed JSON responses the user gets a clear error or a valid plan after retry, and nothing is persisted. Verify (not accept) the response guidance: challenge "it works after a few retries" ≠ retry exhaustion is handled; avoid stubs that always return valid JSON. Also: choose the cheapest useful test layer and a runner for Astro 7 + Cloudflare workerd.

Scope: local work only (the code path is 4 files, all read in full). No sub-agents were used. Build/tests were not run. The runner question is only partly answered (see Open Questions).

## Summary

- **Risk #1 is real and its failure path is short.** One function, `generateItinerary` (`src/lib/services/gemini.ts:81`), does the whole Gemini call; one route, `POST /api/trips/generate` (`src/pages/api/trips/generate.ts:13`), maps its outcome to HTTP. The plan's hot-spot dirs (`src/pages/api`) point at the right area, but the logic under test lives in `src/lib/services/gemini.ts`, not in the route.
- **"Nothing is persisted" holds by construction on the inspected path.** `generate.ts` and `gemini.ts` import no Supabase client (grep of `src/lib/services` and `generate.ts` for `supabase`: no match in `generate.ts`; `gemini.ts` mentions none). Persistence happens only in `POST /api/trips` (`src/pages/api/trips/index.ts:34`), reached only when the user clicks Accept (`TripGeneratorFlow.tsx:143-150`). So a test for "nothing persisted" on this phase is a negative assertion about the route's imports/behavior, not a database test; it is cheap at the route level and does not need local Supabase.
- **Every failure mode in the risk statement already ends in a typed error and HTTP 502** — `ItineraryGenerationError` (`upstream` or `invalid_response`) → `{error:"generation_failed"}`, status 502 (`generate.ts:48-53`). The client shows a message for that code (`TripGeneratorFlow.tsx:47-49`). No silent failure was found on the inspected path. The value of the tests is therefore regression protection for this mapping, not discovery of a present bug.
- **The retry assumption in the plan is correct and has a precise shape** (below): only HTTP 503 is retried, at most 5 retries (6 requests), bounded by a 60 s shared deadline; exhaustion falls through to the generic non-OK branch and is reported as `upstream`. That is the behavior to pin, including the boundary (6th response still 503).
- **No test runner is installed.** `node_modules` has no `vitest`, `jest` or `msw`; no `*.test.*`/`*.spec.*` or `vite.config*`/`vitest*` file exists outside `.claude/`. Runner choice is still open and needs a short spike (see Open Questions).

## Detailed Findings

### Gemini call boundary and retry policy (`src/lib/services/gemini.ts`)

- The only network edge is a global `fetch` to a fixed endpoint, `GEMINI_ENDPOINT` (`gemini.ts:24`), with header `x-goog-api-key` (`:108`). No client object or injection seam exists: the function reads the module-level `GEMINI_API_KEY` imported from the virtual module `astro:env/server` (`:2`) and the global `fetch`. A "stubbed Gemini client" therefore means stubbing global `fetch` (and the `astro:env/server` module), not injecting a client.
- Missing key: throws `upstream` before any fetch (`:82-84`). Test needs both key-present and key-absent cases only if the module mock supports toggling it.
- Retry loop (`:99-126`), on this inspected path:
  - A thrown `fetch` (network error, abort/timeout) → `upstream`, **no retry** (`:113-115`).
  - Status exactly 503 and `attempt < MAX_UNAVAILABLE_RETRIES (5)` and `Date.now() + retryDelay < deadline` → body cancelled, sleep `1000 × (0.5 + Math.random())` ms, retry (`:117-125`). So at most 6 requests (attempts 0..5).
  - Any other status (including 429, 500, 4xx) → loop exits immediately; non-2xx → `upstream` with message `Gemini API returned HTTP <status>.` (`:120-121`, `:128-131`). 429 is not retried (confirmed by the condition `response.status !== 503`).
  - Retry exhaustion: when the final response is still 503 and `canRetry` is false, the loop `break`s and the same `!response.ok` branch throws `upstream` (`:120-131`). There is no separate exhaustion code path; exhaustion is handled, but only by falling into the generic branch. A test must therefore assert the *sixth* 503 yields an error, and that exactly 6 `fetch` calls were made — a stub that answers 503 a fixed number of times then 200 would never exercise this.
  - Real-time cost: delays total up to ~5 × 1.5 s of real `setTimeout` in a naive test. Tests need fake timers and/or a fixed `Math.random`. `AbortSignal.timeout` (`:111`) is not controlled by Vitest fake timers (this is an assumption about Vitest, not verified here), so deadline-expiry cases need care.
- Response validation chain after a 2xx (each step throws `invalid_response`):
  1. `response.json()` fails → "not valid JSON" (`:133-138`).
  2. Envelope parse (`geminiEnvelopeSchema`, `:10-22`) then `candidates[0].content.parts[0].text`; missing candidates, empty `candidates: []`, no `parts`, non-string or empty-string `text` → "no usable candidate" (`:54-60`, `:145-148`). This covers the **empty** response and the safety-block response (`promptFeedback.blockReason` with no candidates).
  3. `JSON.parse(text)` fails → "not valid JSON" (`:150-155`). This covers **malformed JSON**, including truncated output.
  4. `geminiRawItineraryResponseSchema.safeParse` fails → schema error (`:157-160`).
  5. `city_recognized === false` → error (`:162-164`).
  6. `hasValidDayCount` false (wrong length, duplicate or missing day numbers) → error (`:170-175`; function at `itinerary-schema.ts:100-114`).
- `finishReason` is not read anywhere in `src/lib/services` or the route (grep for `finishReason`: only the comment at `gemini.ts:142`). Consequence on this path: a 200 response whose `finishReason` is non-`STOP` but whose text is nevertheless valid, schema-conformant JSON would be accepted. Whether that is a defect is a product question, not decided here.
- Only `parts[0].text` is read (`:59`); later parts are ignored. Not obviously a problem; noted because a stub returning multi-part content would behave differently from one returning a single part.

### Route mapping (`src/pages/api/trips/generate.ts`)

- Order: 401 if no `locals.user` (`:14`), 400 `invalid_json` (`:21-29`), 400 `invalid_input` via zod (`:31-37`; city trimmed, 1–100 chars, day_count int 1–14), then `generateItinerary`.
- `ItineraryGenerationError` (either cause) → 502 `generation_failed` (`:48-53`); the `cause` is not exposed to the client. Any other thrown error → 500 `unexpected_error` (`:54-57`).
- Consequence for tests: at the route level the six upstream/invalid variants are indistinguishable by status/body; the distinction (`upstream` vs `invalid_response`) is observable only at the service level (`error.cause`, `error.message`). Plan test layers accordingly: service-level for failure classification and retry counts; route-level for "user gets a clear error (502 + `generation_failed`, no plan fields) and nothing persisted".
- The route builds a `Response` and needs an `APIContext` (`context.locals.user`, `context.request`). Invoking the exported `POST` directly with a minimal fake context is possible (it uses only `locals.user` and `request.json()`); this was not tried.

### Client-side handling of the error (`src/components/trips/TripGeneratorFlow.tsx`)

- Non-OK (or redirected) response → message from `generationErrorMessage` (`:44-51`): `generation_failed` → "We couldn't generate a plan for that city. Check the city name or try again." This text suggests a city problem even when the cause is Gemini being busy; the message is clear but not cause-specific.
- A 200 whose body lacks an array `days` → generic error (`:113-119`). The generated plan is held in React state only and is "never persisted as a draft" (`:64`). A save request is sent only from `handleAccept` (`:143-153`).
- Client behavior is out of scope for this phase's `integration (stubbed Gemini client)` type; the plan's anti-pattern (happy-path-only stubs) applies to the service/route tests. UI rendering of the error is already covered by the kitchen sink (`test-plan.md` §7).

### Existing tests, runner and environment

- No application tests: no `*.test.*`/`*.spec.*`/`vitest*`/`vite.config*` found outside `node_modules` and `.claude/`; `npm run smoke` covers the sign-in flow only (`package.json` scripts; `test-plan.md` §4).
- `node_modules` contains none of `vitest`, `msw`, `jest` (ls check), only `undici` and `@cloudflare/{kv-asset-handler,unenv-preset,vite-plugin,workerd-windows-64}`. `@cloudflare/vite-plugin` and `workerd` are present as adapter dependencies; whether `@cloudflare/vitest-pool-workers` is needed was not established.
- Versions in lockfile: astro 7.3.2, vite 8.3.0 (`package-lock.json`). Local Node is v22.12.0 and `.nvmrc` says 22.14.0 (CLAUDE.md); CI uses Node 22 (`.github/workflows/ci.yml`).
- `astro.config.mjs` declares `GEMINI_API_KEY` as an optional server secret via `envField` (`:18-20`); `gemini.ts` imports it from `astro:env/server`. Under a plain Node test runner this virtual module will not resolve unless the runner uses Astro's Vite config or the module is mocked/aliased.
- Web lookup (one standard search, 2026-11-18): Astro's testing guide documents Vitest with `getViteConfig()` from `astro/config` (config inherited, second argument overrides). A GitHub issue (withastro/astro#16790, against Astro 6.3.5 + `@astrojs/cloudflare` 13.5.2) reports the Cloudflare adapter is not fully compatible with `astro:env`. I did not find a documented way to resolve `astro:env/server` under tests with the Cloudflare adapter, nor whether that issue is fixed in Astro 7.3.2. Treat the runner choice as unverified.

### Verification of the test plan's Risk #1 guidance

| Plan statement | Verdict | Evidence |
|---|---|---|
| Failure scenario: "busy", empty, malformed JSON | Supported; each maps to a distinct, reachable branch | `gemini.ts:99-175` |
| "user sees a silent failure or an empty plan" | Not reproduced on the inspected path: every branch throws a typed error, route returns 502 with no `days` | `generate.ts:48-53` |
| "nothing is persisted" | True by construction for generate; persistence only on Accept | `generate.ts` (no DB import), `index.ts:34-131` |
| Challenge: "works after a few retries" ≠ exhaustion handled | Valid challenge. Exhaustion is handled via the generic non-OK branch after 6 requests; tests must hit the 6th-503 boundary and the deadline cutoff | `gemini.ts:119-131` |
| Hot-spot evidence `src/pages/api` | Misleading as a locator: the logic is in `src/lib/services/gemini.ts` and `itinerary-schema.ts`; the route is a thin mapper | `generate.ts` (60 lines) |
| Cheapest layer: integration with stubbed client | Refine: no client object exists. Cheapest layer is a service-level test of `generateItinerary` with stubbed global `fetch`, plus a thin route-level test. No Supabase/Docker needed | `gemini.ts:104` |
| Anti-pattern: stub that always returns valid JSON | Applies; the stub must be a scripted sequence of responses (503, 503, …, 200/invalid) | — |

## Code References

- `src/lib/services/gemini.ts:81-178` — `generateItinerary`: retry loop, validation chain.
- `src/lib/services/gemini.ts:24-31` — endpoint, timeout (20 s), max retries (5), base delay (1 s), deadline (60 s).
- `src/lib/services/gemini.ts:44-52` — `ItineraryGenerationError` and `cause` union.
- `src/lib/services/gemini.ts:54-60` — `extractCandidateText` (reads `candidates[0].content.parts[0].text` only).
- `src/lib/services/itinerary-schema.ts:47-49,100-114` — raw response schema with `city_recognized`; `hasValidDayCount`.
- `src/pages/api/trips/generate.ts:13-59` — route; 502 `generation_failed` mapping.
- `src/pages/api/trips/index.ts:34-131` — save route (only place that writes to the DB).
- `src/components/trips/TripGeneratorFlow.tsx:44-51,90-129,143-177` — client error mapping, generate and accept flow.
- `astro.config.mjs:18-20` — `GEMINI_API_KEY` env schema.
- `context/foundation/test-plan.md:57-62,74,82-96,120-141` — risk guidance, Phase 1 row, stack, cookbook TBDs.

## Architecture Insights

- The Gemini boundary has two seams that are not injectable: global `fetch` and the `astro:env/server` module. Tests must stub both; do not refactor production code just to add a client seam in this phase (a decision for `/10x-plan`, listed in Open Questions).
- The service is the source of truth for classification (`upstream` vs `invalid_response`); the route intentionally collapses them. Tests asserting only HTTP status cannot distinguish failure causes.
- Retry decisions depend on wall-clock (`Date.now`) and `Math.random`; deterministic tests need control of both.

## Historical Context (from prior changes)

- `context/archive/2026-09-26-generate-and-save-trip-plan/plan-brief.md:23` and `plan.md:42` — original decision: no server-side auto-retry (manual "Try again" only). **Superseded** for 503 by the later Phase 5 scope addition (`change.md:20`: every model returned 503 on most requests during e2e verification), which added the retry loop now in `gemini.ts`. The "no auto-retry" statement is contradicted for HTTP 503 only; it still holds for timeouts, 4xx and other 5xx (`gemini.ts:97-98,120`).
- `plan-brief.md:75` — "A Gemini failure never silently hangs — it always resolves to review or a retryable error." Supported on the inspected path (typed error → 502 → client error state), but only evidenced here by reading, not by a test.
- `context/archive/2026-09-26-generate-and-save-trip-plan/reviews/impl-review.md:28-35` — F1 review finding led to the shared 60 s deadline; the deadline cutoff is therefore a known past defect class worth a regression test.
- `context/archive/2026-09-26-generate-and-save-trip-plan/follow-ups/review-fixes.md:7` — notes each generation can make up to 6 Gemini requests and no per-user limit exists (Risk #5, out of scope for this phase).
- `context/archive/.../reviews/impl-review-phase-1.md:103-105` — Phase 1 validated the safety-block and 503 cases manually via a temporary debug route; no automated test was added.
- `context/foundation/lessons.md` does not exist (checked).

## Related Research

None under `context/changes/**/research.md` or `context/archive/**/research.md` addresses testing; not searched beyond the grep above.

## Open Questions

1. **Runner (blocking for the plan).** Is Vitest with `getViteConfig()` workable under Astro 7.3.2 + `@astrojs/cloudflare` 14.3.1 + Vite 8.3.0, and does `astro:env/server` resolve there or must it be mocked (`vi.mock`) / aliased? Needs a short spike in the plan (install, one trivial test importing `gemini.ts`). Fallback: Vitest with a plain config plus an alias for `astro:env/server`. Whether `@cloudflare/vitest-pool-workers` is warranted (running in workerd) is undecided; plan's §7 says nothing about it; cost vs. signal suggests plain Node first, since the service uses only `fetch`, `AbortSignal.timeout`, `setTimeout`.
2. Can `AbortSignal.timeout` and `Date.now` be controlled under the chosen runner's fake timers, so the 60 s deadline path is testable without real waiting? Unverified.
3. Product decision (not this phase's to settle): should a 200 response with non-`STOP` `finishReason` and valid JSON be accepted? Currently accepted (`finishReason` is never read).
4. Product decision: should 429 be retried? Currently not (`gemini.ts:120`).
5. Should route-level tests invoke the exported `POST` with a fake `APIContext`, or go through `astro dev`/`preview` over HTTP? Direct invocation looks cheaper (route uses only `locals.user` and `request.json()`); not tried. Via HTTP, Gemini would also need to be stubbed, which is hard across a process boundary.
6. Cookbook sections 6.1, 6.2, 6.5 in `test-plan.md` stay TBD until the plan's final sub-phase updates them.

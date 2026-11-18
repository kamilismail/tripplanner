# Test runner and Gemini boundary tests Implementation Plan

## Overview

Rollout Phase 1 of `context/foundation/test-plan.md`: add a test runner (Vitest, plain Node) and the first application tests, covering Risk #1. The tests prove that when Gemini answers "busy" (HTTP 503), returns an empty response or malformed JSON, the user gets either a clear error or a valid plan after retry, and nothing is persisted. They also pin the retry-exhaustion boundary, which "it works after a few retries" does not prove.

## Current State Analysis

- No test runner and no application tests exist: no `vitest`/`jest`/`msw` in `node_modules`, no `*.test.*` or `vite.config*` outside `.claude/` (research.md, "Existing tests, runner and environment"). Only `npm run smoke` (auth flow) exists.
- The whole Gemini failure path is `generateItinerary` in `src/lib/services/gemini.ts:81-178` plus a thin route `src/pages/api/trips/generate.ts:13-59` that maps every `ItineraryGenerationError` (cause `upstream` or `invalid_response`) to `502 {"error":"generation_failed"}`.
- Retry policy: only HTTP 503 is retried, at most 5 retries (6 requests), with a shared 60 s deadline; a thrown `fetch`, 429, other 4xx/5xx are not retried (`gemini.ts:99-131`). Exhaustion has no separate code path: the final 503 falls into the generic non-OK branch (`gemini.ts:128-131`).
- Validation chain after a 2xx: non-JSON body, missing/empty candidate text, malformed JSON text, schema mismatch, `city_recognized: false`, wrong day count/numbering (`gemini.ts:133-175`).
- The generate route imports no Supabase client; persistence happens only in `POST /api/trips` on Accept (`src/pages/api/trips/index.ts:34-131`, `TripGeneratorFlow.tsx:143-153`).
- There is no injectable Gemini client. The only seams are global `fetch` and the virtual module `astro:env/server` (`gemini.ts:2,104`).

## Desired End State

`npm test` runs a Vitest suite locally and in CI. The suite contains service-level tests of `generateItinerary` driven by scripted response sequences (never an always-valid stub) and route-level tests of `POST /api/trips/generate`. Deliberately breaking the retry logic or a validation step makes at least one test fail (checked once by hand). The `test-plan.md` cookbook (§6.1, 6.2, 6.5, 6.6) and stack table (§4, §5) describe the pattern so the next phase can copy it.

### Key Discoveries:

- Retry is bounded by `MAX_UNAVAILABLE_RETRIES = 5` and a 60 s deadline; both are testable without real waiting by faking timers and having the stub advance the fake clock (`gemini.ts:26-31,119`).
- `AbortSignal.timeout` (`gemini.ts:111`) is not driven by Vitest fake timers (assumption, verified in Phase 1); deadline tests therefore rely on the fake `Date.now`, not on the abort signal.
- At the route level all failure causes look identical (502, same body); classification (`error.cause`) is observable only at the service level (`generate.ts:48-53`). So retry counts and causes are asserted in service tests, the user-visible contract in route tests.
- Files under `src/pages/` become routes in Astro, so test files must not live there; they go in a top-level `tests/` directory.
- Hot-spot evidence in the test plan points at `src/pages/api`, but the logic is in `src/lib/services/gemini.ts` (research.md, verification table).

## What We're NOT Doing

- No refactor of production code to add a Gemini client seam or dependency injection; stub global `fetch` and mock `astro:env/server` instead.
- No `@cloudflare/vitest-pool-workers` / workerd test environment, and no HTTP-level tests against `astro dev`.
- No change to production behavior: 429 stays non-retried, and `finishReason` stays unread. The 429 non-retry is pinned by a test; `finishReason` handling is left undecided (product question, recorded in Open Risks).
- No Supabase or persistence tests (rollout Phase 2), no data-isolation, auth-route, input-abuse or rate-limit tests (rollout Phase 3, Risk #5), no secret-leak scan (Risk #6).
- No client/React tests and no UI error-rendering tests (covered by the kitchen sink).
- No pre-commit test hook and no coverage thresholds (rollout Phase 4).

## Implementation Approach

Plain Vitest in Node. A `vitest.config.ts` (separate from `astro.config.mjs`) aliases `@/` to `src/` and includes `tests/**/*.test.ts`. `astro:env/server` is mocked per test file with `vi.mock`; for the "no API key" case the module is re-imported with `vi.doMock` + `vi.resetModules`. Phase 1 is a spike: if plain Vitest cannot import `gemini.ts`, fall back to Vitest with `getViteConfig()` from `astro/config` and record the decision. Test data and expected values are literals written from the contract in research.md (6 calls, `upstream` vs `invalid_response`, 502 body), not imported from or computed by production constants, to avoid the oracle problem. A shared helper scripts the `fetch` stub as an ordered list of responses and fails the test if the code under test makes more calls than scripted.

## Phase 1: Runner and spike

### Overview

Install Vitest, configure it for this repo, and prove one trivial test can import `gemini.ts` with `astro:env/server` mocked.

### Changes Required:

#### 1. Dependency and scripts

**File**: `package.json`

**Intent**: Add Vitest as a devDependency (latest version compatible with Vite 8.3 and Node >=22.12) and a `test` script.

**Contract**: `"test": "vitest run"`; devDependency `vitest`. No other script changes.

#### 2. Vitest config

**File**: `vitest.config.ts` (new)

**Intent**: Run tests in Node with the project's `@/*` alias and a top-level `tests/` directory, independent of the Astro build.

**Contract**: `include: ["tests/**/*.test.ts"]`, `environment: "node"`, `resolve.alias` mapping `@` to `src`. Must not be picked up by `astro build` or break `astro check`.

#### 3. Smoke test and fallback

**File**: `tests/services/gemini.smoke.test.ts` (new)

**Intent**: One test that mocks `astro:env/server` (`GEMINI_API_KEY: "test-key"`), stubs `fetch` to return a valid minimal Gemini response and checks `generateItinerary("Paris", 1)` returns one day. Proves the runner, alias and mock work.

**Contract**: If this cannot run under plain Vitest, switch `vitest.config.ts` to `getViteConfig()` from `astro/config` (fallback decided in research.md Open Question 1) and note the reason in the commit message. This smoke file is deleted or folded into Phase 2's happy-path test once Phase 2 lands.

### Success Criteria:

#### Automated Verification:

- `npm test` passes and runs the smoke test
- Linting passes: `npm run lint`
- Type check passes: `npx astro check`
- Production build still succeeds: `npm run build`

#### Manual Verification:

- Removing the `astro:env/server` mock makes the smoke test fail (the test is not vacuous)
- The chosen runner setup (plain Vitest or `getViteConfig` fallback) and any `astro:env` finding are written in the commit message for later use in the cookbook

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Gemini service tests

### Overview

Cover `generateItinerary` with scripted response sequences, including retry success, retry exhaustion, deadline expiry and each invalid-response variant.

### Changes Required:

#### 1. Scripted fetch helper

**File**: `tests/helpers/gemini-stub.ts` (new)

**Intent**: Build a `fetch` stub from an ordered list of steps (status + body, or a thrown error). Each call consumes one step; a call beyond the scripted list fails the test with a clear message, and the helper exposes the call count and requested URLs.

**Contract**: `scriptFetch(steps)` installs via `vi.stubGlobal("fetch", ...)` and returns `{ calls, urls }`. Steps may run a callback (to advance the fake clock). Plus a hand-written `validGeminiBody(days)` fixture builder that does not use `itinerarySchema` or production constants.

#### 2. Service tests

**File**: `tests/services/gemini.test.ts` (new; replaces the smoke test)

**Intent**: One test per scenario below, each with its own scripted sequence, asserting the thrown `ItineraryGenerationError` `cause` (or the returned plan) and the exact number of `fetch` calls. Use fake timers; advance them with `vi.advanceTimersByTimeAsync`.

**Contract**: Expected values are literals:
- Control: one valid 200 response returns the plan (1 call).
- 503, 503, then valid → returns the plan (3 calls).
- 503 then 200 with invalid content → `invalid_response`, not retried again (2 calls).
- Six consecutive 503 → `upstream` after exactly 6 calls (retry exhaustion).
- Deadline: each scripted 503 advances the fake clock by 25 s → `upstream` after exactly 3 calls.
- `fetch` rejects (network error) → `upstream`, 1 call, no retry.
- HTTP 429 and HTTP 500 → `upstream`, 1 call each, no retry (pins the "only 503 retried" boundary).
- 200 with a non-JSON body → `invalid_response`.
- 200 with no candidates, with `promptFeedback.blockReason`, and with an empty-string candidate text → `invalid_response` (the "empty" case).
- 200 with candidate text that is truncated/malformed JSON → `invalid_response`.
- 200 with valid JSON that fails the schema (missing `days`, empty point name) → `invalid_response`.
- 200 with `city_recognized: false` → `invalid_response`.
- 200 with a plan whose day count or numbering does not match the request (too few days, duplicate day number) → `invalid_response`.
- Missing `GEMINI_API_KEY` → `upstream` and zero `fetch` calls (re-import via `vi.doMock` + `vi.resetModules`).
Every failure test also asserts that no plan is returned.

### Success Criteria:

#### Automated Verification:

- `npm test` passes with all service scenarios present
- Every scenario above has its own named test (no scenario shares a single always-valid stub)
- Linting passes: `npm run lint`
- Type check passes: `npx astro check`

#### Manual Verification:

- A reviewer confirms each test scripts its own response sequence and that no expected value is imported from `gemini.ts` or `itinerary-schema.ts`
- Full suite runs in a few seconds, with no real waiting on retry delays

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Generate route tests

### Overview

Prove the user-visible contract of `POST /api/trips/generate`: a clear error for every failure, a plan on success, and nothing persisted.

### Changes Required:

#### 1. Route tests

**File**: `tests/api/trips-generate.test.ts` (new)

**Intent**: Call the exported `POST` directly with a minimal fake `APIContext` (`locals.user`, `request`), `astro:env/server` mocked and `fetch` scripted via the Phase 2 helper. Also mock `@/lib/supabase` and assert `createClient` is never called.

**Contract**:
- No `locals.user` → 401 `{"error":"unauthorized"}`; no `fetch` call.
- Invalid JSON body → 400 `invalid_json`; empty city or `day_count` of 0 → 400 `invalid_input`; no `fetch` call.
- Valid request with a valid Gemini response → 200 with `city`, `day_count`, `days`.
- Each failure scripted at the Gemini edge (six 503, empty candidate, malformed JSON text, schema mismatch, `city_recognized: false`, wrong day count) → 502 `{"error":"generation_failed"}` and the body has no `days` field.
- A non-`ItineraryGenerationError` thrown by `generateItinerary` (the service is spied for this single test) → 500 `{"error":"unexpected_error"}`.
- For every case above, all `fetch` calls go only to the Gemini endpoint (no Supabase request) and `createClient` is not called ("nothing persisted").

### Success Criteria:

#### Automated Verification:

- `npm test` passes with all route cases present
- Linting passes: `npm run lint`
- Type check passes: `npx astro check`
- Production build still succeeds: `npm run build`

#### Manual Verification:

- Reviewer confirms no test file lives under `src/pages/` and `npm run build` output has no stray test route
- Reviewer confirms each failure case asserts both the 502 body and the absence of Supabase calls

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 4: Gate and cookbook

### Overview

Make the suite part of CI, document the pattern for later phases, and prove the tests catch a real regression.

### Changes Required:

#### 1. CI step

**File**: `.github/workflows/ci.yml`

**Intent**: Run `npm test` in the `ci` job after lint so a broken Gemini boundary blocks merge. Test-plan §5 already marks unit + integration as required after rollout Phase 1.

**Contract**: One added step `- run: npm test` in the `ci` job; no new secrets (tests mock the key).

#### 2. Repo docs

**File**: `AGENTS.md`, `CLAUDE.md`

**Intent**: Replace "No unit/integration test suite exists yet" with the real command and the `tests/` location convention; keep `smoke` described as the auth-flow check.

**Contract**: `npm test` listed under commands; testing guideline names `tests/` (not `src/pages/`) as the place for tests.

#### 3. Test plan cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Update §4 (runner row, API-mocking row), §5 (unit + integration gate now wired), and fill §6.1, §6.2, §6.5 and §6.6 with the pattern shipped: location, how to mock `astro:env/server`, the scripted-fetch helper, fake-timer approach, literal expected values. Set the §3 Phase 1 status to `complete`.

**Contract**: Edits only in the named sections; the frozen strategy sections (§1–§3 text other than the status cell) stay as they are.

### Success Criteria:

#### Automated Verification:

- `npm test` passes locally
- `npm run lint`, `npx astro check` and `npm run build` pass
- The `ci` job in `.github/workflows/ci.yml` contains an `npm test` step

#### Manual Verification:

- Temporarily changing `MAX_UNAVAILABLE_RETRIES` to 2 (or removing the 503 retry) makes the retry tests fail; restoring it makes them pass
- Temporarily removing the empty-candidate guard (`gemini.ts:146-148`) makes at least one service test fail; restoring it makes them pass
- CI run on the branch is green including the new test step
- `test-plan.md` §6.1, §6.2, §6.5 and §6.6 read as usable instructions for adding the next test

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Not a separate layer here: service tests of `generateItinerary` with a stubbed global `fetch` are the cheapest useful layer (research.md, verification table).
- Key edge cases: retry success, exhaustion at the sixth 503, deadline expiry, no-retry statuses, each invalid-response variant, missing API key.

### Integration Tests:

- Route-level tests calling the exported `POST` with a fake context and a scripted Gemini edge; assert 502 body, 200 body and absence of any non-Gemini `fetch`/`createClient` call.
- No local Supabase needed in this phase.

### Manual Testing Steps:

1. Run `npm test`, confirm all suites pass quickly.
2. Break the retry count and the empty-candidate guard one at a time; confirm tests fail; restore.
3. Check the CI run shows the `npm test` step green.

## Performance Considerations

Fake timers must avoid real retry waits (delays of 0.5–1.5 s each, up to five). Suite target: a few seconds in total.

## Migration Notes

None. Only a devDependency, config, tests, a CI step and docs are added; production code is unchanged.

## References

- Related research: `context/changes/testing-gemini-boundary/research.md`
- Test plan: `context/foundation/test-plan.md` (§2 Risk #1, §3 Phase 1, §4–§6)
- Code under test: `src/lib/services/gemini.ts:81-178`, `src/pages/api/trips/generate.ts:13-59`
- Prior work: `context/archive/2026-09-26-generate-and-save-trip-plan/change.md` (503 retry and deadline additions)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Runner and spike

#### Automated

- [x] 1.1 `npm test` passes and runs the smoke test — 5c2f980
- [x] 1.2 Linting passes: `npm run lint` — 5c2f980
- [x] 1.3 Type check passes: `npx astro check` — 5c2f980
- [x] 1.4 Production build still succeeds: `npm run build` — 5c2f980

#### Manual

- [x] 1.5 Removing the `astro:env/server` mock makes the smoke test fail (the test is not vacuous) — 5c2f980
- [x] 1.6 The chosen runner setup and any `astro:env` finding are written in the commit message for later use in the cookbook — 5c2f980

### Phase 2: Gemini service tests

#### Automated

- [x] 2.1 `npm test` passes with all service scenarios present — 41a7ba6
- [x] 2.2 Every scenario above has its own named test (no scenario shares a single always-valid stub) — 41a7ba6
- [x] 2.3 Linting passes: `npm run lint` — 41a7ba6
- [x] 2.4 Type check passes: `npx astro check` — 41a7ba6

#### Manual

- [x] 2.5 A reviewer confirms each test scripts its own response sequence and that no expected value is imported from `gemini.ts` or `itinerary-schema.ts` — 41a7ba6
- [x] 2.6 Full suite runs in a few seconds, with no real waiting on retry delays — 41a7ba6

### Phase 3: Generate route tests

#### Automated

- [x] 3.1 `npm test` passes with all route cases present
- [x] 3.2 Linting passes: `npm run lint`
- [x] 3.3 Type check passes: `npx astro check`
- [x] 3.4 Production build still succeeds: `npm run build`

#### Manual

- [x] 3.5 Reviewer confirms no test file lives under `src/pages/` and `npm run build` output has no stray test route
- [x] 3.6 Reviewer confirms each failure case asserts both the 502 body and the absence of Supabase calls

### Phase 4: Gate and cookbook

#### Automated

- [ ] 4.1 `npm test` passes locally
- [ ] 4.2 `npm run lint`, `npx astro check` and `npm run build` pass
- [ ] 4.3 The `ci` job in `.github/workflows/ci.yml` contains an `npm test` step

#### Manual

- [ ] 4.4 Temporarily changing `MAX_UNAVAILABLE_RETRIES` to 2 (or removing the 503 retry) makes the retry tests fail; restoring it makes them pass
- [ ] 4.5 Temporarily removing the empty-candidate guard (`gemini.ts:146-148`) makes at least one service test fail; restoring it makes them pass
- [ ] 4.6 CI run on the branch is green including the new test step
- [ ] 4.7 `test-plan.md` §6.1, §6.2, §6.5 and §6.6 read as usable instructions for adding the next test

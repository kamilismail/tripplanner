<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Test runner and Gemini boundary tests

- **Plan**: context/changes/testing-gemini-boundary/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-18
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Success criteria re-run: `npm test` 33/33, `npx astro check` 0 errors, `npm run build` OK, new files lint-clean after CRLF normalisation (repo-wide `npm run lint` fails locally only on CRLF, CI is green on 0b94eab incl. `npm test`).

## Findings

### F1 — "Nothing persisted" assertion cannot fail

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: tests/api/trips-generate.test.ts:57-63
- **Detail**: The route never imports `@/lib/supabase`, so `createClient` not being called is true by construction. The fetch-URL check only catches a non-Gemini `fetch`; a regression that persists via `locals.supabase` or another import would pass.
- **Fix**: Add a throwing `locals.supabase` proxy to `makeContext` and make the mocked `createClient` throw, so any persistence attempt fails the test.
  - Strength: turns a vacuous guard into a real one for Risk #1.
  - Tradeoff: slightly more test scaffolding.
  - Confidence: MED — depends on how future persistence is wired (locals vs. import).
  - Blind spot: Phase 2 of the rollout will change how persistence is reached.
- **Decision**: FIXED — throwing locals.supabase proxy + throwing createClient mock

### F2 — Gemini timeout and empty-part responses untested

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/services/gemini.test.ts (missing cases); src/lib/services/gemini.ts:111-114
- **Detail**: The 20 s per-attempt timeout ("Gemini slow") is not covered, nor `candidates: [{}]` / empty `parts`. Fake timers do not drive `AbortSignal.timeout`, so the stub must reject with a `TimeoutError` DOMException.
- **Fix**: Add a step `{ throws: new DOMException("", "TimeoutError") }` (expect `upstream`, 1 call) and invalid cases for `candidates: [{}]` and empty `parts`.
- **Decision**: FIXED — timeout step, candidate without content, empty parts

### F3 — `settle()` can loop forever and leak into later tests

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/helpers/timers.ts:14-16
- **Detail**: If the call never settles, `while (!state.done)` keeps running after the test times out; after `useRealTimers` the next `advanceTimersByTimeAsync` throws inside the leaked loop and the error is attributed to a later test.
- **Fix**: Bound the loop (e.g. 100 iterations, then throw "call did not settle").
- **Decision**: FIXED — settle() bounded to 100 steps

### F4 — Step 4.5 is ticked although its wording was not met

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/testing-gemini-boundary/plan.md:329
- **Detail**: The empty-candidate guard (`gemini.ts:146-148`) is behaviorally redundant (`JSON.parse` throws and maps to `invalid_response`), so removing it cannot fail a test. 4.5 was ticked on the basis of replacement break-checks (city_recognized, day-count). Recorded in commit b43bca0 and test-plan §6.6, but not in the plan.
- **Fix**: Add a short addendum note to the plan (Progress step titles stay unchanged).
- **Decision**: FIXED — addendum in plan.md

### F5 — Route input edge cases not pinned

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/api/trips-generate.test.ts
- **Detail**: No tests for `day_count` above the maximum, non-integer/string `day_count`, city over 100 characters, trimming (`" Paris "` → `"Paris"` in the 200 body), or a missing API key at route level (502). Input abuse belongs to rollout Phase 3 (Risk #5), so this is optional here.
- **Fix**: Add a few `it.each` rows, or leave for rollout Phase 3.
- **Decision**: FIXED — input edge rows, trimming, missing-key route test

### F6 — Test hygiene and flakiness margins

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: vitest.config.ts; tests/services/gemini.test.ts:79-87
- **Detail**: (a) `Math.random` jitter is not stubbed; margins hold (3 calls, 5+ s of slack) but are undocumented. (b) Cleanup is a hand-written `doUnmock` list; `unstubGlobals`/`restoreMocks` in the config would make it declarative. (c) The 25 s step and "6 calls" literals are intentionally hand-copied; a one-line comment deriving why 3 calls would make a constant change diagnosable. (d) No `engines.node` for Node >=22.12 (`.nvmrc` covers it).
- **Fix**: Stub `Math.random` to 0.5, set `unstubGlobals: true` and `restoreMocks: true`, add the derivation comment.
- **Decision**: FIXED — Math.random pinned, unstubGlobals/restoreMocks, deadline comment (engines.node left to .nvmrc)

### F7 — Stale doc text near the edited lines

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: AGENTS.md (CI line, "single initial commit" note); CLAUDE.md (CI section)
- **Detail**: Docs say CI runs on pushes/PRs to `master`, while `ci.yml` triggers on `main`; AGENTS.md still says the repo has a single initial commit. Pre-existing, outside the plan.
- **Fix**: Change `master` to `main` and drop the stale commit note, or leave as a separate chore.
- **Decision**: FIXED — master→main, stale commit note replaced

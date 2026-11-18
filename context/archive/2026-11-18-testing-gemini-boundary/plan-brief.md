# Test runner and Gemini boundary tests — Plan Brief

> Full plan: `context/changes/testing-gemini-boundary/plan.md`
> Research: `context/changes/testing-gemini-boundary/research.md`

## What & Why

Add a test runner and the first application tests, covering Risk #1 of the test plan: when Gemini answers "busy" (503), empty, or with malformed JSON, the user must get a clear error or a valid plan after retry, and nothing must be saved. The tests must also pin what happens when retries run out, because "it works after a few retries" does not prove that case is handled.

## Starting Point

There are no application tests and no runner today; only `npm run smoke` for sign-in. The Gemini call is one function (`src/lib/services/gemini.ts`) with a 503-only retry loop, and one thin route that maps every failure to `502 generation_failed`. The route never touches the database; saving happens only when the user clicks Accept.

## Desired End State

`npm test` runs locally and in CI. Scripted-response tests prove retry success, retry exhaustion (six 503s), deadline expiry, no retry for network errors/429/500, and every invalid-response variant. Route tests prove the user-visible 502/200 contract and that no Supabase call happens. Breaking the retry or a validation guard on purpose makes a test fail. The test plan's cookbook explains the pattern.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Test layer | Service tests with stubbed global `fetch`, plus route tests | There is no Gemini client object; `fetch` is the real network edge and no Docker is needed | Research |
| Route test scope | Call exported `POST` directly with a fake context | Cheap, proves 502 body and no persistence without a server or middleware | Plan |
| Runner | Plain Vitest in Node, `astro:env/server` mocked; `getViteConfig` as fallback | Service uses only `fetch`, timers and `AbortSignal`, and `astro:env` has a known Cloudflare adapter issue | Plan |
| Test location | Top-level `tests/` | Files under `src/pages/` would become Astro routes | Research |
| Expected values | Literals from the contract, not imported from production code | Avoids copying the implementation into the oracle | Plan |
| 429 and `finishReason` | Pin 429 as non-retried; leave `finishReason` out | 429 non-retry is documented intent; `finishReason` is an undecided product question | Plan |
| Production code | Unchanged | A phase about tests should not change behavior | Plan |

## Scope

**In scope:** Vitest setup and spike; service tests; route tests; CI step; AGENTS.md/CLAUDE.md and test-plan cookbook updates; one manual regression-catch check.

**Out of scope:** Gemini client refactor, workerd test pool, HTTP-level tests, any change to retry/`finishReason` behavior, Supabase/persistence and auth tests, rate limiting, secret scan, pre-commit hook, coverage thresholds, UI tests.

## Architecture / Approach

Tests live in `tests/`. `vitest.config.ts` aliases `@/` to `src/`. Each file mocks `astro:env/server` and installs a scripted `fetch` stub (an ordered list of responses that fails if the code calls `fetch` more often than scripted). Fake timers and a stub that advances the fake clock make retry delays and the 60 s deadline instant. Route tests mock `@/lib/supabase` and assert it is never called.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Runner and spike | Vitest, config, `npm test`, one smoke test | Plain Vitest may not resolve `astro:env/server`; fallback is `getViteConfig` |
| 2. Gemini service tests | Retry, exhaustion, deadline and invalid-response scenarios | Fake timers may not cover `AbortSignal.timeout` |
| 3. Generate route tests | 401/400/200/502/500 contract and no-persistence checks | Fake `APIContext` may need more fields than expected |
| 4. Gate and cookbook | `npm test` in CI, docs, regression-catch check | CI environment differences |

**Prerequisites:** Node >=22.12 (`.nvmrc` 22.14.0); network access to install Vitest.
**Estimated effort:** ~3 sessions across 4 phases; Phase 1 is the least certain.

## Open Risks & Assumptions

- Assumption: plain Vitest works with the Astro 7 / Cloudflare setup; Phase 1 verifies it.
- Assumption: Vitest fake timers do not control `AbortSignal.timeout`, so the deadline test relies on a fake `Date.now`.
- Open product question (not decided here): a 200 response with a non-`STOP` `finishReason` and valid JSON is currently accepted.
- Tests running in Node do not catch workerd-specific runtime differences.

## Success Criteria (Summary)

- A failing Gemini response (busy, empty, malformed) always ends in a clear 502 error or a valid plan after retry, and tests prove it.
- Retry exhaustion at the sixth 503 and deadline expiry are covered.
- Deliberately breaking retry or a validation guard turns the suite red.

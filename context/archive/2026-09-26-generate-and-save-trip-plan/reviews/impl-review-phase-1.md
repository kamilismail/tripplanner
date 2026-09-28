<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Generate and Save a Trip Plan

- **Plan**: context/changes/generate-and-save-trip-plan/plan.md
- **Scope**: Phase 1 of 5
- **Reviewed phases**: 1
- **Date**: 2026-09-26
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 1 observation

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

### F1 — No timeout on the Gemini `fetch()` call

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/gemini.ts:69-82
- **Detail**: `fetch(GEMINI_ENDPOINT, {...})` has no `AbortSignal`/timeout. On Cloudflare Workers, a hung upstream connection can burn through the Worker's CPU/wall-clock budget instead of failing cleanly into `ItineraryGenerationError`. This repo's own `context/foundation/tech-stack.md` explicitly flags edge-runtime time constraints as a risk area for this integration.
- **Fix**: Add `signal: AbortSignal.timeout(20_000)` (or similar) to the fetch options; an abort already surfaces through the existing `catch { throw new ItineraryGenerationError(..., "upstream") }` block, so no other code path changes.
- **Decision**: FIXED

### F2 — `response.json()` failure isn't normalized to `ItineraryGenerationError`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/gemini.ts:91
- **Detail**: `const body: unknown = await response.json();` sits outside any try/catch. A non-JSON 200 body throws a raw `SyntaxError` instead of the function's stated invariant that every failure mode becomes `ItineraryGenerationError`, which is the one gap in an otherwise fully-normalized error contract.
- **Fix**: Wrap the call in try/catch and throw `ItineraryGenerationError("Gemini response was not valid JSON.", "invalid_response")` on failure, matching the pattern already used for `JSON.parse(text)` two lines below.
- **Decision**: FIXED

### F3 — Missing/empty `GEMINI_API_KEY` reaches the network instead of failing fast

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/gemini.ts:73
- **Detail**: `"x-goog-api-key": GEMINI_API_KEY ?? ""` means an unconfigured key still triggers a real outbound HTTP request (which comes back as a 400/401, correctly classified as `"upstream"` — not a crash, just wasted I/O for a purely local misconfiguration knowable before any network call).
- **Fix**: Add an early guard before the fetch — `if (!GEMINI_API_KEY) throw new ItineraryGenerationError("GEMINI_API_KEY is not configured.", "upstream");` — mirroring how `src/lib/supabase.ts` guards `!SUPABASE_URL || !SUPABASE_KEY` before constructing a client.
- **Decision**: FIXED

### F4 — Untrusted `city` interpolated into the Gemini prompt with no delimiting

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/gemini.ts:54-64 (`buildPrompt`)
- **Detail**: `city` is spliced directly into the prompt template literal with no escaping, length cap, or delimiter separating untrusted input from instructions. Once Phase 2 wires this to a client-supplied field, a crafted `city` value could attempt instruction override — and since `city_recognized` is entirely self-reported by the model with no independent check (geocoding was explicitly declined in favor of this lightweight approach), a successful injection could flip `city_recognized` to `true` for a bogus input, undermining the one semantic guard that exists. Not exploitable yet (no code path reaches `generateItinerary` with user input until Phase 2), so this is a forward-looking risk, not a live one.
- **Fix A ⭐ Recommended**: Add a simple length cap and delimiter now in `buildPrompt` (e.g. `City to plan for (untrusted, may not be a real place): """${city.slice(0, 100)}"""`), even though it's not reachable yet — cheap, and lands the mitigation before the input becomes reachable rather than after.
  - Strength: Fixes it once, in the one place that builds the prompt, before any caller exists.
  - Tradeoff: Speculative work on code with no live exploit path yet; wording may need to be revisited once Phase 2's actual validation (zod non-empty string, no length bound per the plan) is in place.
  - Confidence: MED — delimiting reduces but doesn't eliminate prompt-injection risk against an LLM.
  - Blind spot: Haven't verified whether Phase 2's plan already intends a length cap on `city` at the API boundary, which would make this partially redundant.
- **Fix B**: Defer to Phase 2, track as a follow-up once `city` is actually reachable from a client request and the real input-validation boundary (zod schema) is visible.
  - Strength: Avoids guessing at mitigation shape before the real caller/contract exists.
  - Tradeoff: Risk sits in the codebase unmitigated for at least one more phase, and could be forgotten.
  - Confidence: MED — reasonable given Phase 1 is explicitly scoped as "the external-AI boundary" in isolation.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A

### F5 — `change.md` documents the model-swap adaptation but not the `city_recognized` adaptation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/changes/generate-and-save-trip-plan/change.md (## Notes)
- **Detail**: The `city_recognized` field is a scope addition beyond the plan's original Phase 1 contract, added mid-implementation at the user's request ("can we protect against a nonsense city"). It's correctly implemented and internally consistent (confirmed by both review agents — no bypass, validated before `hasValidDayCount`, stripped from the returned `ItineraryPlan`), but it directly reverses Phase 1's own documented manual-verification item ("Requesting an invalid/nonsense city still returns a schema-valid response ... confirms the validation layer doesn't reject on content"). `change.md`'s Notes section documents the model-endpoint swap thoroughly but has no corresponding entry for this second, equally consequential adaptation. Since `plan.md`'s Phase 1 block is read-only/immutable per this project's rules, `change.md` is the only place this reversal can be recorded for a future reader.
- **Fix**: Add a second `## Notes` entry to `change.md` (same 2026-09-26/Phase 1/ADAPT style as the existing one) documenting: what `city_recognized` is, why it was added, and that it reverses the plan's documented behavior for manual-verification item 1.4.
- **Decision**: FIXED

## Observations

### F6 — Repo-wide `npm run lint` fails on pre-existing CRLF errors (already accepted this session)

- **Severity**: OBSERVATION
- **Dimension**: Success Criteria
- **Location**: repo-wide (not specific to Phase 1's files)
- **Detail**: `npm run lint` fails with ~1091 `prettier/prettier` "Delete ␍" errors caused by local `core.autocrlf=true` with no `.gitattributes`, confirmed present on a clean `main`@HEAD stash-test before any Phase 1 changes existed. Phase 1's own new/changed files (`gemini.ts`, `itinerary-schema.ts`) lint clean; `astro.config.mjs`'s one added line inherits the file's pre-existing CRLF state. The user explicitly decided to treat this as a known pre-existing condition and proceed, scoping the lint gate to Phase 1's own files. Recorded here for the review's own record, not a fresh finding requiring a decision — logged as already resolved.
- **Decision**: ACCEPTED (resolved earlier in this session, not re-triaged)

## Success Criteria Verification

**Automated** (from Phase 1's own criteria):
- `npm run build` — PASS
- `npm run lint` — scoped to Phase 1's own files (`gemini.ts`, `itinerary-schema.ts`): PASS. Repo-wide: pre-existing failure, see F6.

**Manual** (from `## Progress`, all checked `[x]`, commit `85bf653`):
- 1.3 `generateItinerary` returns a valid N-day plan for a real city — confirmed by user (`Kraków, Poland`, 3 days).
- 1.4 Invalid/nonsense city handling — confirmed by user, but note the *actual* verified behavior is now the opposite of the checkbox title's literal wording (rejects rather than accepts), per the approved `city_recognized` adaptation — see F5.
- 1.5 Invalid API key causes a typed `upstream` error — confirmed by user.
- 1.6 Safety-filter-blocked response causes a typed `invalid_response` error — confirmed by user.

No signs of a hollow checkmark: all four manual items were exercised via a temporary debug route the user hit directly, with real API responses observed (503s, a `city_recognized: false` response, etc.) discussed live in this session before being checked off.

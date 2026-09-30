<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: `/trips` Design-System Contract and Light Travel Theme

- **Plan**: context/changes/app-layout-redesign/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-09-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Automated criteria re-run on 2026-09-30:
- `lint:ui`: 0 hits, exit 0.
- `lint`: exit 0.
- `build`: exit 0.
- The class-constant grep returns nothing.
- Card, Alert and Skeleton exist.
- In the preview build, `GET /dev/kitchen-sink` returns 404 and `/trips` without a session redirects.
- 5.1 was verified during Phase 5: the pre-commit hook blocks a staged `text-purple-300` probe.

## Findings

### F1 — Full-opacity focus ring addendum never applied

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence / Success Criteria
- **Location**: src/styles/global.css:126, src/components/ui/button.tsx:8, src/components/ui/input.tsx:12, src/components/AppHeader.astro:20
- **Detail**:
  - impl-review-phase-2 F1 was marked "FIXED via Fix A (queued as Phase 4 addendum)". `follow-ups/review-fixes.md` lists the edits.
  - All four locations still use `ring-ring/50` / `outline-ring/50`, and `button.tsx`/`input.tsx` have no commits in this change.
  - The rendered ring stays around 1.84:1 against `--background`, below the 3:1 that WCAG 1.4.11 requires.
  - 4.6 is ticked although its addendum check ("rendered ring ≥ 3:1") cannot have passed.
  - `CLAUDE.md` names `ring-ring` as the canonical class.
- **Fix**: `outline-ring/50` → `outline-ring` in global.css. `focus-visible:ring-ring/50` → `focus-visible:ring-ring` in button.tsx, input.tsx and the AppHeader logo link. Then re-check the ring contrast on `/dev/kitchen-sink`.
- **Decision**: FIXED (ring-ring/outline-ring at full opacity in button, input, AppHeader logo and global.css; rendered ring verified as 3px --ring on /dev/kitchen-sink)

### F2 — Kitchen-sink page ships in the production bundle, guarded only by middleware

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/middleware.ts:9-11, src/pages/dev/kitchen-sink.astro
- **Detail**:
  - After the gate moved to middleware (phase-4 F1), `dist/server/chunks/kitchen-sink_*.mjs` holds the full render with fixtures.
  - The middleware gate is not bypassable: Astro decodes and normalises the pathname, and routes are case-sensitive.
  - The phase-4 record's claim that the page body is dropped as dead code no longer holds.
- **Fix**: Accept as is. Correct the note in reviews/impl-review-phase-4.md (F1) so it does not claim the template is tree-shaken.
- **Decision**: FIXED (accepted as is; stale dead-code note corrected in impl-review-phase-4.md)

### F3 — `lint:ui` runs only in pre-commit, not in CI

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: .github/workflows/ci.yml:23
- **Detail**: The CI lint job runs `lint`, `astro check` and `build`. Two paths skip the literal scan: `git commit --no-verify` and commits made outside the hook, such as a web edit.
- **Fix**: Add `- run: npm run lint:ui` after `npm run lint` in the CI lint job.
- **Decision**: FIXED (`npm run lint:ui` step added to the CI lint job)

### F4 — Focus drops to `<body>` after a generation error

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/trips/TripGeneratorFlow.tsx:66-73
- **Detail**:
  - During loading, `<fieldset disabled>` disables the focused submit button, so focus falls to `<body>`.
  - The effect restores focus for `review` and for Accept/Discard → `idle`, but not for `error`.
  - The Alert announces the error, but the keyboard position is lost.
  - The bug predates this change; phase-4 F6 covered only Accept/Discard.
- **Fix**: In the status effect, add `if (status === "error") cityInputRef.current?.focus({ preventScroll: true });`.
- **Decision**: FIXED (status effect focuses the city input with preventScroll on "error")

### F5 — Pre-existing reliability edge cases in generate/list

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/trips/TripGeneratorFlow.tsx:96, src/components/trips/TripList.tsx:111-121
- **Detail**:
  - (a) A 200 response with a body that is not JSON throws inside `response.json()` and is shown as "Network error", which is misleading.
  - (b) If `newTripId` moves from trip A to trip B within `HIGHLIGHT_MS`, the cleanup clears A's timer and A keeps `ring-primary`. This needs two saves within 2.5 s.
  - Both predate this UI change and are out of its scope.
- **Fix**: Queue as a follow-up outside this change: wrap the body read like `readSavedTrip`, and reset `highlighted` when `isNew` turns false.
- **Decision**: FIXED differently (fixed in code now instead of a follow-up: `readGeneratedPlan` wraps the 200 body read like `readSavedTrip`; the highlight ring requires `highlighted && isNew`)

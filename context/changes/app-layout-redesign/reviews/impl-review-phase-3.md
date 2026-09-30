<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: `/trips` Design-System Contract and Light Travel Theme

- **Plan**: context/changes/app-layout-redesign/plan.md
- **Scope**: Phase 3 of 5
- **Reviewed phases**: 3
- **Date**: 2026-09-30
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Evidence: commit `09cd644` touches the 7 planned files and `src/components/ui/alert.tsx`. The `success` variant is the one justified extra: the plan requires a success `Alert` without literals. No file crosses the "What We're NOT Doing" boundaries, and no Phase 4 work was done.

Criteria results:
- `lint:ui` finds 0 hits, `lint` passes, `build` passes, and the leftover-class grep finds nothing.
- The user confirmed manual checks 3.5–3.8.
- Auth boundaries, the sign-out POST (Astro `checkOrigin`), escaping, landmarks, heading order, `aria-current`, the live region and focus management were checked, with no regressions.
- Every token class maps to an entry in `@theme inline`.

## Findings

### F1 — Header merges classes with `class:list`, without `cn()`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/AppHeader.astro:23
- **Detail**: `class:list={[buttonVariants({ variant: "ghost", size: "sm" }), isTrips && "bg-accent text-accent-foreground"]}` joins the classes the way clsx does, with no tailwind-merge step. `CLAUDE.md` requires `cn()` for merged or conditional classes. It works today only because the ghost variant has no conflicting `bg-*` class, so a future conflicting override would fail silently. The implementer avoided `class={cn(...)}` because of the `astro/prefer-class-list-directive` lint warning.
- **Fix**: `class:list={[cn(buttonVariants({ variant: "ghost", size: "sm" }), isTrips && "bg-accent text-accent-foreground")]}` (satisfies both the lint rule and `cn()`).
- **Decision**: FIXED

### F2 — A newly saved trip can scroll under the sticky header

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/trips/TripList.tsx:99 (the `scrollIntoView` call on the trip `<article>`)
- **Detail**: This phase added a sticky `h-14` header. `scrollIntoView({ block: "nearest" })` on a highlighted trip that sits above the viewport leaves its top edge under the header, because the article has no scroll margin. The usual flow scrolls down, where this does not happen.
- **Fix**: Add `scroll-mt-20` to the trip `<article>` className (the same step as the generator Card).
- **Decision**: FIXED

### F3 — `DayPointsList` redeclares day and point types

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/trips/DayPointsList.tsx:3-11
- **Detail**: The local `DayPoint` and `Day` interfaces duplicate shapes that already exist in `@/types` (`GeneratedTripPlan["days"]`) and in `TripDay` (TripList.tsx). `CLAUDE.md` puts shared types in `src/types.ts`.
- **Fix**: Move a structural `DayWithPoints` type to `src/types.ts` and reuse it in `DayPointsList` and `TripList`.
- **Decision**: FIXED

### F4 — `CardTitle` wraps an `<h2>`

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/trips/TripsPanel.tsx:44-48
- **Detail**: `CardTitle` renders a `div`, and the h2 inside it sets its own size and weight. The markup is semantically valid, but it nests a heading in a wrapper and inherits `leading-none`, which is tight if the title wraps.
- **Fix**: Render `<h2 data-slot="card-title" id="saved-trips-heading" className="text-xl leading-none font-semibold">` in place of `CardTitle` + `h2`.
- **Decision**: FIXED

### F5 — `aria-current` misses `/trips/`

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/AppHeader.astro:6
- **Detail**: `Astro.url.pathname === "/trips"` is a strict match. `astro.config.mjs` does not set `trailingSlash`, so the default `ignore` also serves `/trips/`, and on that URL the header loses the active state.
- **Fix**: `const isTrips = Astro.url.pathname.replace(/\/$/, "") === "/trips";`
- **Decision**: FIXED

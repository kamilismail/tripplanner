<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: `/trips` Design-System Contract and Light Travel Theme

- **Plan**: context/changes/app-layout-redesign/plan.md
- **Scope**: Phase 4 of 5
- **Reviewed phases**: 4
- **Date**: 2026-09-30
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Automated criteria were re-run during the review: `lint:ui` 0 hits, `lint` passes, `build` passes. The preview returned 404 for `/dev/kitchen-sink` during implementation. `dist/server/chunks/kitchen-sink_*.mjs` contains only the 404 return, so `import.meta.env.DEV` was replaced with `false` and the template was removed as dead code. `/dev/kitchen-sink` is not in `PROTECTED_ROUTES`.

## Findings

### F1 — eslint rule disabled file-wide in kitchen-sink.astro

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/dev/kitchen-sink.astro:7-8
- **Detail**: `/* eslint @typescript-eslint/no-misused-promises: "off" */` turns the rule off for the whole file. The crash is real: without the directive, the rule fails with "Expected node to have a parent" on the top-level `return` in the frontmatter. `eslint-disable-next-line` would not help, because the rule would still run and crash. The file holds 3 lines of TypeScript, but the directive has no link to an upstream issue, so nobody will know when it can be removed.
- **Fix A ⭐ Recommended**: Move the dev-only gate to `src/middleware.ts` (`if (!import.meta.env.DEV && pathname.startsWith("/dev/")) return new Response(null, { status: 404 })`), and remove the top-level `return` and the directive from the page.
  - Strength: No lint exception at all. It covers every future `/dev/*` page, and route gating stays in one place next to `PROTECTED_ROUTES`.
  - Tradeoff: It moves away from the plan's letter ("the page returns 404"), although the intent is the same. The middleware gets one more condition.
  - Confidence: HIGH — the middleware already handles route gating on every request.
  - Blind spot: Not yet checked whether Vite also removes the page body as dead code when the page has no guard of its own. The page would still be unreachable in production.
- **Fix B**: Keep the directive and add a link to the upstream typescript-eslint / astro-eslint-parser issue in the comment.
  - Strength: Zero code change; matches the plan literally.
  - Tradeoff: The lint exception stays until someone checks the upstream issue.
  - Confidence: MEDIUM — the upstream issue has to be found first.
  - Blind spot: No upstream issue has been identified yet.
- **Decision**: FIXED (Fix A — /dev/* gate moved to src/middleware.ts; page return and eslint directive removed)

### F2 — Logo link focus ring is 2px, other controls are 3px

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/components/AppHeader.astro:19
- **Detail**: The TripPlanner logo link keeps its own `focus-visible:ring-ring/50 focus-visible:ring-2`. The colour is the token, but it is thinner than the `Button` ring (3px). Check 4.6 ("same ring on every control") was confirmed, but the difference is visible up close.
- **Fix**: Change `focus-visible:ring-2` to `focus-visible:ring-3`. That is a Tailwind 4 scale class, not an arbitrary value, so `lint:ui` passes.
- **Decision**: FIXED (logo ring-2 → ring-3)

### F3 — Field errors not linked with aria-describedby

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/trips/GeneratorForm.tsx:75-77, 97-99, 132-139
- **Detail**: The inputs set `aria-invalid`, but the `FieldError` text has no id and is not referenced by `aria-describedby`. A screen reader announces "invalid" without the reason. The gap existed before this phase and is not a regression. With `useId` in place it is now cheap to fix.
- **Fix**: Give `FieldError` an id (`${id}-city-error`, `${id}-day-count-error`) and pass `aria-describedby` to the input when there is an error.
- **Decision**: FIXED (FieldError ids + aria-describedby on both inputs)

### F4 — userEmail prop overrides the session user without a dev guard

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/AppHeader.astro:11, src/layouts/AppLayout.astro:8
- **Detail**: `Astro.props.userEmail ?? Astro.locals.user?.email` cannot be spoofed through a request, because the prop comes only from server-side `.astro` code and `{email}` is escaped. If a future page passes the prop by mistake, though, the header silently shows a different email than the signed-in user's. Only the kitchen sink passes it today.
- **Fix**: `const email = (import.meta.env.DEV ? Astro.props.userEmail : undefined) ?? Astro.locals.user?.email;`
- **Decision**: FIXED (userEmail override honoured only when import.meta.env.DEV)

### F5 — KitchenSink island is emitted as a public client asset

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dev/kitchen-sink.astro:15 (dist/client/_astro/KitchenSink.*.js)
- **Detail**: The server page returns 404 in production, but Vite still builds the `client:load` island chunk into the public `dist/client/_astro/`. It contains only fixture data: no secrets and no API calls. It can be fetched only by someone who knows the hashed name.
- **Fix**: Accept it, and add one sentence to the page comment that the client chunk is still emitted but holds fixtures only.
- **Decision**: FIXED (accepted; page comment documents the fixtures-only client chunk)

### F6 — Focus drops to body after Accept / Discard

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/trips/TripGeneratorFlow.tsx:136-153
- **Detail**: After Accept or Discard, `PlanReview` unmounts and keyboard focus lands on `<body>`. The live region announces the save, but the keyboard position is lost. Behaviour is identical to before the split, as the plan required, so this is not a regression.
- **Fix**: Queue it to follow-ups: move focus to the city input or the success Alert after returning to the form.
- **Decision**: FIXED (flow returns focus to the city input with preventScroll after Accept/Discard; GeneratorForm gets optional cityInputRef)

### F7 — Skeleton rows lack bg-card; the refreshing list has a second dim value

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/trips/TripList.tsx:44-53, 78
- **Detail**: The skeleton rows have the right height, but they have no `bg-card`, while a collapsed trip item does (:129). The list dims with `opacity-60` while it refreshes, and the disabled state uses 50. That leaves two "dim" values in the view.
- **Fix**: Add `bg-card` to the skeleton rows, and change the refresh opacity to `opacity-50`.
- **Decision**: FIXED (bg-card on skeleton rows; refresh dim opacity-60 → opacity-50)

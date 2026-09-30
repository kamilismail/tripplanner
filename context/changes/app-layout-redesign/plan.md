# `/trips` Design-System Contract and Light Travel Theme: Implementation Plan

## Overview

This plan moves the `/trips` view off hand-rolled "cosmic" palette literals and onto the repo's shadcn token contract, with a light beach/travel palette. It adds the missing shared components (`Card`, `Alert`, `Skeleton`), the signed-in app header, a consistent 7-state treatment, a dev-only kitchen-sink page as the visual gate, and a rule plus a pre-commit scan so the next agent keeps to the contract. It is driven by charges C1–C4 in `research.md`. Scope is one view plus global tokens (`change.md` → "UI contract scope").

## Current State Analysis

- The token source is `src/styles/global.css`. Default neutral shadcn values sit in `:root` (6-34) and are correctly published via `@theme inline` (72-111). No view reads them: the 4 view files contain 0 token utility classes and 37 literal-scan lines (research → "Source → view counts").
- `bg-cosmic` (`global.css:113-115`, hex literals) paints over `body { bg-background }` (`global.css:123`).
- `Button` and `Input` are token-driven (`src/components/ui/button.tsx:7-33`, `input.tsx:10-15`), but every use in the view overrides them with literal class constants (`TripGeneratorFlow.tsx:19-22`, a copy at `TripList.tsx:81`).
- There is no `Card`. Card chrome is duplicated at `TripsPanel.tsx:12`, `TripGeneratorFlow.tsx:201`, `TripList.tsx:59` and `TripList.tsx:116`. The day/point list is duplicated at `TripGeneratorFlow.tsx:199-218` and `TripList.tsx:150-169`.
- `/trips` renders no header (`src/pages/trips.astro:8-21`). `Topbar` is used only by `Welcome.astro`.
- States drift: there are three focus treatments, a stacked disabled opacity, red literals for errors, a text-only empty state, and a list-load layout jump (research C4 and the 7-state matrix).
- Tooling: `lint-staged` is configured in `package.json`. There is no Playwright and no Storybook. `components.json` is shadcn `new-york` with `cssVariables: true` pointing at `src/styles/global.css`.

## Desired End State

A signed-in user on `/trips` sees:
- a light, sand-toned page with an orange primary accent in Plus Jakarta Sans;
- a header with the compass logo, "My trips", "New trip", their email and "Sign out", which collapses to icon buttons on mobile;
- the generator and the saved trips as shadcn `Card`s.

Every control in the view has a token-driven hover, a single `--ring` focus-visible indicator, one disabled treatment, `destructive` errors, a real empty state with a call to action, and a skeleton while the list loads. `npm run lint:ui` reports 0 hits on the view files. `/dev/kitchen-sink` (dev only) shows all 7 states side by side. `CLAUDE.md` tells the next agent where tokens and components live, and a pre-commit hook fails on new literals in the cleaned files.

### Key Discoveries:

- `@theme inline` wiring is already correct (`global.css:72-111`). A theme change is a value edit in `:root`, not new plumbing. `.dark` is never applied (`Layout.astro:14`), so dark mode stays untouched.
- Every other page keeps its own literals: `SubmitButton.tsx:18` hardcodes purple, and the auth pages and `dashboard.astro` hardcode `bg-cosmic`. Changing `:root` therefore reaches them only through the global `* { outline-ring/50 }` (`global.css:120`) and `Button`/`Input` focus rings, which become orange. That is acceptable, and intended.
- Astro cannot pass slot HTML to Radix `Slot`, so `asChild` does not work from `.astro`. Header links use `buttonVariants()` from `button.tsx:50` on a plain `<a>`, which is the shadcn pattern for non-React markup.
- `TripGeneratorFlow` keeps all states internal (`TripGeneratorFlow.tsx:59-68`). The kitchen sink can render them only if the form and review markup are presentational components driven by props.

## What We're NOT Doing

- Splitting `/trips` into a list and `/trips/new`, the post-accept redirect, or the unsaved-plan warning (`change.md` → Deferred). "New trip" points to `/trips#new-trip` until then.
- `/` routing, removing `Welcome.astro` or `/dashboard`, and redirects after sign-in or sign-out (`signin.ts:19`, `signout.ts:9`).
- Restyling the auth screens, `AuthLayout`, sign-up auto sign-in, or `ServerError` itself (the auth forms still use it on a dark background). `/trips` stops importing it and uses `Alert` instead.
- `Banner.astro`, Polish banner copy, the default title in `Layout.astro:10`.
- Removing `@utility bg-cosmic`, which other pages still use.
- Dark mode values (`.dark`), a theme toggle, a Playwright or screenshot-test dependency, Storybook.
- A sign-in link in session-expired messages (research D3).

## Implementation Approach

Follow the `/10x-ui` order: environment/library → token values → one view → states → guard.
- Phase 1 only adds building blocks, so nothing visual changes.
- Phase 2 changes values in the single token source, which `/trips` still ignores until Phase 3.
- Phase 3 rewires the view onto tokens and components and adds the shell.
- Phase 4 makes every state deliberate and builds the kitchen-sink gate.
- Phase 5 leaves the rule and the check behind.

After each visual phase (3 and 4), take screenshots at desktop and 375 px width and re-run `npm run lint:ui`.

## Critical Implementation Details

- **Kitchen-sink guard.** `src/pages/dev/kitchen-sink.astro` must return a 404 unless `import.meta.env.DEV` is true. The app is SSR on Cloudflare, so a bare page would otherwise ship to production. It must not be added to `PROTECTED_ROUTES`: it uses fixture data and needs no session.
- **Anchor target.** "New trip" and the empty-state CTA link to `#new-trip`. The generator `Card` carries `id="new-trip"` and `scroll-margin-top` sized to the sticky header, so the heading is not hidden under the header after the jump.
- **`aria-current`.** On `/trips`, only "My trips" gets `aria-current="page"`, because "New trip" is an in-page anchor for now.

## Phase 1: Environment and library

### Overview

Add the shared primitives and the font token, and create the literal-scan script. There is no visual change to any page.

### Changes Required:

#### 1. shadcn primitives

**File**: `src/components/ui/card.tsx`, `src/components/ui/alert.tsx`, `src/components/ui/skeleton.tsx` (new)

**Intent**: Provide the missing shared components identified in C2 and C4, through the stack's own path.

**Contract**: Created by `npx shadcn@latest add card alert skeleton` (no `init`). The generated files must use only token classes. If the CLI rewrites `global.css` or `components.json`, revert the unrelated edits.

#### 2. Font token

**File**: `src/layouts/Layout.astro`, `src/styles/global.css`

**Intent**: Load Plus Jakarta Sans and expose it as the default sans family through the token layer.

**Contract**: In `Layout.astro` `<head>`: `preconnect` links to `fonts.googleapis.com` and `fonts.gstatic.com` (crossorigin), plus a stylesheet for `Plus Jakarta Sans` weights 400;500;600;700 with `display=swap`. In `@theme inline`: `--font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;`.

#### 3. Literal scan script

**File**: `scripts/check-ui-literals.mjs` (new), `package.json`

**Intent**: Make the `/10x-ui` hardcoded-value scan runnable, and later enforceable, without a new dependency.

**Contract**: `node scripts/check-ui-literals.mjs [files...]`. The default file set is `src/pages/trips.astro`, `src/layouts/AppLayout.astro`, `src/components/AppHeader.astro` and `src/components/trips/*.tsx`. Non-existent files are skipped. It prints `file:line: match` for each hit and exits 1 if there are any. It applies the regex from the `/10x-ui` skill (hex, `rgb/hsl/oklch(`, `-[Npx|rem]` arbitrary values, and Tailwind palette classes for bg/text/border/ring/outline/from/via/to/fill/stroke/shadow/divide), and never scans `src/styles/global.css`. The `package.json` script is `"lint:ui": "node scripts/check-ui-literals.mjs"`.

### Success Criteria:

#### Automated Verification:

- `src/components/ui/card.tsx`, `alert.tsx` and `skeleton.tsx` exist
- `npm run lint` passes
- `npm run build` passes
- `npm run lint:ui` runs and reports the current baseline (37 lines on the 4 view files) with exit code 1

#### Manual Verification:

- `/trips` and the auth pages look unchanged apart from the font

**Implementation Note**: After this phase passes automated verification, pause for manual confirmation before the next phase.

---

## Phase 2: Token values

### Overview

Replace the neutral `:root` values with the beach/travel palette, add a `success` role, and record the values and their source in the change folder.

### Changes Required:

#### 1. Palette values

**File**: `src/styles/global.css`

**Intent**: Give every existing role a travel-themed value: sand/warm neutrals for surfaces and orange for primary and focus. A comment above `:root` names `context/changes/app-layout-redesign/theme-values.md` as the source.

**Contract**:
- Edit only `:root` values for `--background`, `--foreground`, `--card(-foreground)`, `--popover(-foreground)`, `--primary(-foreground)`, `--secondary(-foreground)`, `--muted(-foreground)`, `--accent(-foreground)`, `--destructive`, `--border`, `--input`, `--ring`.
- Add `--success` and `--success-foreground` to `:root`, and add `--color-success` and `--color-success-foreground` to `@theme inline`.
- Leave `.dark`, `--chart-*` and `--sidebar-*` unchanged.
- Colours are OKLCH, and no raw colour goes into `@theme inline`.

#### 2. Recorded values

**File**: `context/changes/app-layout-redesign/theme-values.md` (new)

**Intent**: Keep the chosen values and their reasoning in the repo so the next session does not reinvent them.

**Contract**: A table with token, OKLCH value, role and the contrast ratio of each text/background pair (`foreground`/`background`, `card-foreground`/`card`, `muted-foreground`/`background`, `primary-foreground`/`primary`, `destructive`/`card`, `success-foreground`/`success`), plus a line naming the source (the beach/travel palette agreed in `change.md`, values chosen in this change).

### Success Criteria:

#### Automated Verification:

- `npm run build` passes
- `theme-values.md` exists and lists every edited token
- Every text pair in `theme-values.md` is ≥ 4.5:1 (AA), and `--ring` against `--background` is ≥ 3:1

#### Manual Verification:

- Apart from orange focus rings, the auth pages, `/` and `/dashboard` look unchanged (they still use literals and `bg-cosmic`)

**Implementation Note**: Pause for manual confirmation before the next phase.

---

## Phase 3: The `/trips` view on tokens and components

### Overview

Add the app shell and rebuild the view from tokens and shadcn components. This addresses C1, C2 and C3.

### Changes Required:

#### 1. App layout and header

**File**: `src/layouts/AppLayout.astro` (new), `src/components/AppHeader.astro` (new)

**Intent**: Give signed-in pages a shared shell with navigation and sign-out, fixing C3.

**Contract**:
- `AppLayout` takes the props `{ title: string }`. It wraps `Layout` and renders a sticky `AppHeader`, then a `<main>` container (`max-w-3xl`, centred, token background).
- `AppHeader` reads `Astro.locals.user` and `Astro.url.pathname` and renders:
  - a `Compass` icon (lucide) with the "TripPlanner" wordmark linking to `/trips`;
  - "My trips" (`/trips`, `buttonVariants({ variant: "ghost" })`, `aria-current="page"` when the path is `/trips`);
  - "New trip" (`/trips#new-trip`, `buttonVariants()` default/filled);
  - the email as `text-muted-foreground`, hidden below `sm`;
  - "Sign out" as a POST form to `/api/auth/signout` with a `Button`-styled submit (`variant: "outline"`).
- Below `sm`, the three actions become compact buttons (icon plus short label or icon only, each with an accessible name). No hamburger menu.

#### 2. Page

**File**: `src/pages/trips.astro`

**Intent**: Use the new shell and remove the cosmic wrapper and gradient heading.

**Contract**: It renders `<AppLayout title="My trips · TripPlanner">` around `TripsPanel`. The slot heading uses `text-foreground` and the intro uses `text-muted-foreground`. The "Signed in as" line is removed because the header shows the email.

#### 3. Panel and cards

**File**: `src/components/trips/TripsPanel.tsx`

**Intent**: Replace `cardClass` with `Card`, fixing C2.

**Contract**:
- The generator is wrapped in `Card` with `id="new-trip"` and `scroll-mt-*`.
- The list section is a `Card` with `CardHeader`/`CardTitle` "Your trips".
- `cardClass` is deleted.

#### 4. Shared day list

**File**: `src/components/trips/DayPointsList.tsx` (new), `TripGeneratorFlow.tsx`, `TripList.tsx`

**Intent**: One component for "Day N" plus its points, used by both the plan review and a saved trip. This removes the duplicate identified in C2.

**Contract**: Props are `{ days: { day_number: number; points: { name: string; description?: string | null }[] }[]; headingLevel: "h3" | "h4" }`. The day label uses `text-primary` and the point name uses `text-foreground`. Descriptions and the `MapPin` icon use `text-muted-foreground`.

#### 5. Generator and list on tokens

**File**: `src/components/trips/TripGeneratorFlow.tsx`, `src/components/trips/TripList.tsx`

**Intent**: Remove every palette literal and class constant. Buttons use variants and inputs use the stock `Input`. This fixes C1 and C2.

**Contract**:
- `inputClass`, `primaryButtonClass` and `secondaryButtonClass` are deleted, as is the copy at `TripList.tsx:81`.
- Primary actions (Generate, Accept) use `Button` default; Discard and Try again use `variant="outline"`.
- The success message uses `Alert` with the success role, and errors use `Alert variant="destructive"`. `ServerError` is no longer imported by these files.
- The day card in review and each trip item use `Card` or token classes (`bg-card`, `border-border`).
- The new-trip highlight uses `ring-2 ring-primary` in place of the literal box-shadow at `TripList.tsx:117`.

### Success Criteria:

#### Automated Verification:

- `npm run lint:ui` exits 0 (0 hits on the default file set)
- `npm run lint` passes
- `npm run build` passes
- `grep -n "inputClass\|primaryButtonClass\|secondaryButtonClass\|cardClass\|bg-cosmic" src/components/trips src/pages/trips.astro` returns nothing

#### Manual Verification:

- Signed in: `/trips` shows the header, light theme and cards. "Sign out" signs out, and "New trip" scrolls to the generator with its heading visible below the sticky header
- Logged out, opening `/trips` directly redirects to `/auth/signin`
- Generate → review → Accept still works end to end, and the saved trip appears highlighted in the list
- Screenshots at desktop and 375 px: the header fits on one row on mobile without the email

**Implementation Note**: Pause for manual confirmation before the next phase.

---

## Phase 4: States and the visual gate

### Overview

Make each of the 7 states deliberate for the form, the review actions and the list (C4). Then build the dev-only kitchen sink that shows all of them.

### Changes Required:

#### 1. Presentational split of the generator

**File**: `src/components/trips/GeneratorForm.tsx` (new), `src/components/trips/PlanReview.tsx` (new), `TripGeneratorFlow.tsx`

**Intent**: Let the kitchen sink render idle, loading, field-error, error and review states without network calls. `TripGeneratorFlow` keeps the state and the fetching.

**Contract**:
- `GeneratorForm` props: `{ city, dayCount, cityError, dayCountError, canSubmit, isLoading, submitted, error, successMessage, onCityChange, onDayCountChange, onSubmit, onTryAgain }`.
- `PlanReview` props: `{ plan, isSaving, saveError, headingRef, onAccept, onDiscard }`.
- Behaviour, focus management and the live region stay identical, and the live region remains in `TripGeneratorFlow`.

#### 2. State treatments

**File**: `GeneratorForm.tsx`, `PlanReview.tsx`, `TripList.tsx`

**Intent**: Each state gets exactly one token-driven treatment.

**Contract**:
- **focus-visible**: no per-control ring colours remain, so every control uses the component's `ring-ring`. The trip toggle becomes a `Button variant="ghost"` with layout-only overrides (`h-auto w-full justify-between whitespace-normal p-4 text-left`), so it inherits the focus ring from `button.tsx:8`. Arbitrary values such as `ring-[3px]` in views would trip `lint:ui`.
- **hover**: the trip toggle gets `hover:bg-accent` from the ghost variant.
- **disabled**: remove `disabled:opacity-60` from the `fieldset`, so only the component's own `disabled:opacity-50` applies.
- **error**: field errors use `text-destructive` with the icon; inputs rely on `aria-invalid` styling from `input.tsx:13`.
- **empty**: a `Card`-style block with a short friendly message and a "Plan your first trip" `Button asChild` → `<a href="#new-trip">`.
- **loading (list)**: a first-load skeleton of 2–3 `Skeleton` rows with the same height as a collapsed trip item. `role="status"` and the sr-only text stay.
- **loading (generate)**: unchanged behaviour, with the spinner in `text-primary`.

#### 3. Kitchen sink

**File**: `src/pages/dev/kitchen-sink.astro` (new), `src/components/trips/KitchenSink.tsx` (new, optional wrapper)

**Intent**: A single page showing every state of the view side by side. This is the visual gate and the review evidence.

**Contract**:
- It returns `new Response(null, { status: 404 })` when `!import.meta.env.DEV`.
- It renders inside `AppLayout` (fixture email) with labelled sections:
  - `GeneratorForm` in the default, field-error, disabled/loading, error and success states;
  - `PlanReview` in the default, saving and save-error states;
  - `TripList` in the loading skeleton, empty, error-with-list and list states (one item expanded and highlighted);
  - a row of `Button` variants in default and disabled, for hover and focus checks.
- The fixture trips are typed as `TripWithPoints` and live in the same file or next to it.

### Success Criteria:

#### Automated Verification:

- `npm run lint:ui` exits 0, including on `GeneratorForm.tsx`, `PlanReview.tsx` and `DayPointsList.tsx` (covered by the `trips/*.tsx` glob)
- `npm run lint` passes
- `npm run build` passes
- `npm run preview`, then `GET /dev/kitchen-sink` returns 404

#### Manual Verification:

- In `npm run dev`, `/dev/kitchen-sink` shows every cell of the 7-state matrix, or it is marked N/A with a reason (form empty: N/A, the form always renders; review empty: N/A, it renders only with a plan)
- Tabbing through the kitchen sink shows the same orange focus ring on every control, including the trip toggle and the header buttons
- Disabled inputs during loading are still readable
- Screenshots at desktop and 375 px width of the kitchen sink and `/trips` are saved to `context/changes/app-layout-redesign/screenshots/`
- The real empty state on `/trips` (a user with no trips) shows the CTA, and the CTA jumps to the generator

**Implementation Note**: Pause for manual confirmation before the next phase.

---

## Phase 5: Guard

### Overview

Leave a rule and a check so the next agent keeps to the contract.

### Changes Required:

#### 1. Agent rule

**File**: `CLAUDE.md` (the existing `## UI` section, outside the `<!-- BEGIN @przeprogramowani/10x-cli -->` block)

**Intent**: Tell the next agent where tokens, components and the gate live, and forbid literals in views.

**Contract**: Extend `## UI` with these points:
- tokens: `:root` in `global.css`, with values recorded in `context/changes/app-layout-redesign/theme-values.md`;
- components: `src/components/ui` (add via `npx shadcn@latest add <name>`, never `init`);
- no literal colours, palette classes or arbitrary values in views;
- signed-in pages use `AppLayout`;
- the kitchen sink at `/dev/kitchen-sink`;
- `npm run lint:ui`.

Keep the existing two lines, and do not create a second rules file.

#### 2. Pre-commit check

**File**: `package.json` (`lint-staged`)

**Intent**: Fail a commit that reintroduces literals in the cleaned files.

**Contract**: Add a `lint-staged` entry for `src/pages/trips.astro`, `src/layouts/AppLayout.astro`, `src/components/AppHeader.astro` and `src/components/trips/*.tsx` that runs `node scripts/check-ui-literals.mjs` (lint-staged appends the staged file paths). No new dependency.

### Success Criteria:

#### Automated Verification:

- Staging a file in `src/components/trips/` that contains `text-purple-300` makes the pre-commit hook fail; reverting the file lets it pass
- `npm run lint` passes

#### Manual Verification:

- The `CLAUDE.md` `## UI` section names the token source, the components directory, the literal ban, `AppLayout`, the kitchen sink and `lint:ui`, and sits outside the CLI block

**Implementation Note**: After this phase, run `/10x-impl-review app-layout-redesign`.

---

## Testing Strategy

### Unit Tests:

- None. The repo has no test suite (`CLAUDE.md`), and test strategy comes in Module 3.

### Integration Tests:

- `npm run smoke` against `npm run preview` after Phase 3, to confirm the auth flow still works with the new layout.

### Manual Testing Steps:

1. Sign in, open `/trips`, and check the header, cards and theme at desktop and 375 px.
2. Generate a plan, then Accept; the trip appears highlighted. Generate again, then Discard; the form refills.
3. With the network offline, generate to see the error Alert and "Try again".
4. Use a new user with no trips to see the empty state and its CTA.
5. Tab through `/trips` and `/dev/kitchen-sink` and check that the focus ring is visible and consistent.
6. Sign out from the header, then open `/trips` directly; it redirects to sign-in.

## Performance Considerations

- One extra Google Fonts stylesheet request, mitigated with `preconnect` and `display=swap`. No other runtime cost.

## Migration Notes

- Not applicable: no data or schema changes.

## References

- Research: `context/changes/app-layout-redesign/research.md` (charges C1–C4, 7-state matrix, deferred D1–D6)
- Change scope and agreed UI decisions: `context/changes/app-layout-redesign/change.md`
- Token source: `src/styles/global.css:6-34, 72-111`
- Token-driven components: `src/components/ui/button.tsx:7-50`, `src/components/ui/input.tsx:10-15`
- UI checklist: `.claude/skills/10x-ui/references/ui-quality-checklist.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Environment and library

#### Automated

- [x] 1.1 `src/components/ui/card.tsx`, `alert.tsx` and `skeleton.tsx` exist — 24da09d
- [x] 1.2 `npm run lint` passes — 24da09d
- [x] 1.3 `npm run build` passes — 24da09d
- [x] 1.4 `npm run lint:ui` runs and reports the current baseline (37 lines on the 4 view files) with exit code 1 — 24da09d

#### Manual

- [x] 1.5 `/trips` and the auth pages look unchanged apart from the font — 24da09d

### Phase 2: Token values

#### Automated

- [x] 2.1 `npm run build` passes
- [x] 2.2 `theme-values.md` exists and lists every edited token
- [x] 2.3 Every text pair in `theme-values.md` is ≥ 4.5:1 (AA), and `--ring` against `--background` is ≥ 3:1

#### Manual

- [x] 2.4 Apart from orange focus rings, the auth pages, `/` and `/dashboard` look unchanged (they still use literals and `bg-cosmic`)

### Phase 3: The `/trips` view on tokens and components

#### Automated

- [ ] 3.1 `npm run lint:ui` exits 0 (0 hits on the default file set)
- [ ] 3.2 `npm run lint` passes
- [ ] 3.3 `npm run build` passes
- [ ] 3.4 `grep -n "inputClass\|primaryButtonClass\|secondaryButtonClass\|cardClass\|bg-cosmic" src/components/trips src/pages/trips.astro` returns nothing

#### Manual

- [ ] 3.5 Signed in: `/trips` shows the header, light theme and cards. "Sign out" signs out, and "New trip" scrolls to the generator with its heading visible below the sticky header
- [ ] 3.6 Logged out, opening `/trips` directly redirects to `/auth/signin`
- [ ] 3.7 Generate → review → Accept still works end to end, and the saved trip appears highlighted in the list
- [ ] 3.8 Screenshots at desktop and 375 px: the header fits on one row on mobile without the email

### Phase 4: States and the visual gate

#### Automated

- [ ] 4.1 `npm run lint:ui` exits 0, including on `GeneratorForm.tsx`, `PlanReview.tsx` and `DayPointsList.tsx` (covered by the `trips/*.tsx` glob)
- [ ] 4.2 `npm run lint` passes
- [ ] 4.3 `npm run build` passes
- [ ] 4.4 `npm run preview`, then `GET /dev/kitchen-sink` returns 404

#### Manual

- [ ] 4.5 In `npm run dev`, `/dev/kitchen-sink` shows every cell of the 7-state matrix, or it is marked N/A with a reason (form empty: N/A, the form always renders; review empty: N/A, it renders only with a plan)
- [ ] 4.6 Tabbing through the kitchen sink shows the same orange focus ring on every control, including the trip toggle and the header buttons
- [ ] 4.7 Disabled inputs during loading are still readable
- [ ] 4.8 Screenshots at desktop and 375 px width of the kitchen sink and `/trips` are saved to `context/changes/app-layout-redesign/screenshots/`
- [ ] 4.9 The real empty state on `/trips` (a user with no trips) shows the CTA, and the CTA jumps to the generator

### Phase 5: Guard

#### Automated

- [ ] 5.1 Staging a file in `src/components/trips/` that contains `text-purple-300` makes the pre-commit hook fail; reverting the file lets it pass
- [ ] 5.2 `npm run lint` passes

#### Manual

- [ ] 5.3 The `CLAUDE.md` `## UI` section names the token source, the components directory, the literal ban, `AppLayout`, the kitchen sink and `lint:ui`, and sits outside the CLI block

# `/trips` Design-System Contract and Light Travel Theme: Plan Brief

> Full plan: `context/changes/app-layout-redesign/plan.md`
> Research: `context/changes/app-layout-redesign/research.md`

## What & Why

The `/trips` view, the main screen after sign-in, was built feature by feature with palette literals on a dark "cosmic" glass theme. It ignores the shadcn tokens the repo already ships. It also has no header, so a signed-in user cannot sign out or navigate from it. This change puts the view on the design-system contract (tokens plus shared components) with a light beach/travel theme, and leaves a rule and a check behind so it stays that way.

## Starting Point

`src/styles/global.css` has correctly wired but unused shadcn tokens (default grey). The 4 view files contain 0 token classes and 37 literal-scan lines. `Button` and `Input` are overridden by literal class constants, there is no `Card`, and card chrome and the day list are copy-pasted (research charges C1–C4).

## Desired End State

`/trips` shows a sand-toned page with an orange accent in Plus Jakarta Sans, a header (logo, My trips, New trip, email, Sign out) that compacts on mobile, and the generator and saved trips as `Card`s. Every control has one deliberate treatment for each of the 7 states. `/dev/kitchen-sink` (dev only) shows all of them at once. `npm run lint:ui` reports 0 literals in the view, and a pre-commit hook plus a `CLAUDE.md` rule keep it that way.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | One view (`/trips`) plus global tokens; routing, auth screens and Banner deferred | `/10x-ui`: one view per change, no MVP-wide rebrand | Plan (user, 2026-09-30) |
| Contract variant | Fresh starter with a dead token file: wire the view to tokens, then change values | Tokens and `@theme inline` already exist; nothing reads them | Research |
| Palette | Sand/warm neutrals, orange primary and ring, new `success` role, AA contrast | Agreed travel theme; a new colour means a new token | change.md |
| Font | Plus Jakarta Sans via Google Fonts, token `--font-sans` | Modern, warm, readable | Plan |
| Header "New trip" | Links to `/trips#new-trip` until `/trips/new` exists | Header ships in its final shape and the button works today | Plan |
| Header links in Astro | `buttonVariants()` on `<a>`, not `asChild` | Radix `Slot` can't wrap Astro slot HTML | Plan |
| Alerts on `/trips` | shadcn `Alert` (destructive/success); `ServerError` left for auth | Keeps the auth pages untouched | Plan |
| Visual gate | Dev-only `/dev/kitchen-sink` (404 in production) with fixture data | No Playwright in the repo; no leak to users | Plan |
| Kitchen-sink enabler | Split `GeneratorForm` / `PlanReview` / `DayPointsList` out of the flow | Internal state can't be forced otherwise; removes the duplicate | Plan |
| Guard | `scripts/check-ui-literals.mjs` + `lint:ui` + lint-staged on cleaned files; `CLAUDE.md` `## UI` rule | A failing check beats a forgotten rule; no new dependency | Plan |

## Scope

**In scope:**
- `:root` palette and font token
- `Card`, `Alert` and `Skeleton` via shadcn
- `AppLayout` and `AppHeader`
- `/trips` rebuilt from tokens and components
- The 7 states
- The kitchen sink, the scan script and the rule

**Out of scope:**
- The `/trips/new` split and the unsaved-plan warning
- `/` routing and removing `Welcome` and `/dashboard`
- Auth screens and `AuthLayout`
- `Banner` and its Polish copy
- Removing `bg-cosmic`
- Dark mode
- Playwright or Storybook
- A sign-in link in session-expired messages

## Architecture / Approach

The token source (`:root` → `@theme inline`) is the only place values change. Views use role classes (`bg-card`, `text-muted-foreground`, `bg-primary`) and components from `src/components/ui`. `AppLayout` wraps `Layout` with a static Astro `AppHeader`. `TripsPanel` keeps the state. `GeneratorForm`, `PlanReview`, `DayPointsList` and `TripList` are presentational, so the kitchen sink renders them from fixtures.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Environment and library | card/alert/skeleton, font token, `lint:ui` script (baseline 37) | shadcn CLI touching `global.css` |
| 2. Token values | Travel palette + `success` in `:root`, `theme-values.md` with contrast | Orange primary failing AA with white text |
| 3. `/trips` on tokens | Header, Cards, Button variants, `DayPointsList`, Alerts; scan = 0 | Mobile header crowding |
| 4. States and gate | Single focus/disabled/error treatment, empty CTA, skeleton, kitchen sink, screenshots | Refactor regressing focus management or the live region |
| 5. Guard | `CLAUDE.md` UI rule + lint-staged scan | lint-staged glob not matching `.astro` paths |

**Prerequisites:** local Supabase running (`npx supabase start`) and `GEMINI_API_KEY` for manual generate checks.
**Estimated effort:** about 2–3 sessions across 5 phases.

## Open Risks & Assumptions

- Changing `--ring` also turns focus rings orange on the untouched auth pages. That is accepted.
- Orange primary buttons with white text may need a darker orange to reach 4.5:1. `theme-values.md` records the final value.
- The kitchen sink depends on the presentational split preserving behaviour (focus to the review heading, the live region).

## Success Criteria (Summary)

- A signed-in user on `/trips` can navigate and sign out from a header, and sees a light, consistent theme at desktop and on mobile.
- Keyboard users see the same visible focus ring on every control. The empty and loading states are real states.
- `npm run lint:ui` reports 0 on the view, and a commit that adds a literal there fails.

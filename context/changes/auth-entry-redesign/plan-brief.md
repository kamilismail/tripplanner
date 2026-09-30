# Auth Entry Redesign — Plan Brief

> Full plan: `context/changes/auth-entry-redesign/plan.md`
> Research: `context/changes/auth-entry-redesign/research.md`

## What & Why

Today the app's front door is starter leftovers: a `Welcome` page on `/`, a `/dashboard`, and dark "cosmic" auth
screens that use no design tokens. This change makes `/` route by session and moves sign-in, sign-up and
confirm-email onto the light travel theme's contract (tokens + `src/components/ui`). It also puts the auth screens
under the same visual gate and literal scan as `/trips`. This is change A of two; change B splits `/trips` and
`/trips/new`.

## Starting Point

- `/` renders `Welcome` for everyone.
- Sign-in and sign-out redirect to `/`, and sign-up always goes to "check your email", even when Supabase returns a
  session.
- The three auth pages duplicate a `bg-cosmic` wrapper and contain 22 literal lines.
- The "Signing in…" state never renders (`useFormStatus` doesn't fire on native string-URL forms).
- The missing-config Banner is hex-styled and in Polish.

## Desired End State

- **Routing.** Signed out, `/` and the protected pages lead to `/auth/signin`. Signed in, `/`, `/auth/signin` and
  `/auth/signup` lead to `/trips`.
- **Auth flows.**
  - Sign-up with a session signs the user in and lands on `/trips`; without one it shows "Check your email".
  - Sign-out lands on sign-in.
  - Invalid input returns `?error=` via zod.
- **Screens.**
  - All auth screens share one `AuthLayout` (a centered `Card` with the Compass wordmark), built from `Input`,
    `Button`, `Spinner` and `Alert`.
  - The screens have a real pending state and wired `aria-*` / `autocomplete`.
- **Banner.** It is English and styled with tokens.
- **Session expired.** The error on `/trips` links to sign-in.
- **Gate.** Kitchen-sink sections and screenshots exist, `lint:ui` / pre-commit cover the auth files, and the smoke
  test proves the whole flow.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Post-login / post-signup target | `/trips` (→ `/trips/new` in change B) | `/trips/new` does not exist yet | Research (change.md) |
| Sign-up auto sign-in | Redirect on `data.session`, otherwise "Check your email" | Works locally now and degrades safely in hosted envs | Research (change.md) |
| Signed-out `/` | 302 → `/auth/signin` | One canonical sign-in URL; `?error=` always lands there | Plan |
| Sign-out target | Straight to `/auth/signin` | One hop, explicit, and the smoke assertion becomes meaningful | Plan |
| Signed-in on `/auth/signin` or `/auth/signup` | 302 → `/trips` (exact paths, not `/api/auth/*` or confirm-email) | Prevents a second sign-in or sign-up inside an active session | Plan |
| Pending state | Real: local `submitting` + `pageshow` reset | Blocks double submit; the state is reachable and shown in the kitchen sink | Plan |
| Banner variants | Only error, on `destructive` tokens | `info`/`warning` have 0 consumers; no new tokens or AA rows | Plan |
| confirm-email DEV branch | Removed | With session-aware sign-up, "Check your email" is always the true copy | Plan |
| Adjacent fixes included | autocomplete + aria, zod in auth routes, session-expired link (D3) | Cheap while rewriting, and closes CLAUDE.md convention gaps | Plan |
| Adjacent fixes excluded | Scanner regex blind spots | The literals they target disappear in this change anyway | Plan |
| `ServerError` location | Stays in `auth/` | `/trips` no longer imports it (D6 premise gone) | Research |

## Scope

**In scope:**

- `/` redirect and the guest-only middleware rule
- zod validation and new redirect targets in signin, signup and signout
- removing `dashboard`, `Welcome`, `Topbar` and `bg-cosmic`
- `AuthLayout` and `AuthCard`, and restyling the three pages and six auth components
- the Banner and its English copy, and "TripPlanner" as the default title
- the D3 sign-in link
- the smoke rewrite (12 steps), the kitchen-sink auth sections and screenshots
- extending `lint:ui` / lint-staged, and fixing stale CLAUDE.md lines

**Out of scope:**

- the `/trips` split, highlight and unsaved-plan warning (change B)
- split-screen auth, password reset, OAuth, dark mode toggle
- `--warning`/`--info` tokens
- scanner regex changes
- return-to parameters, `emailRedirectTo`, `supabase/config.toml` URLs
- the hosted "Confirm email" setting (a manual step)

## Architecture / Approach

The auth flow stays as it is: native form POST → route → 302 (`?error=` on failure). All behavior changes sit in
`index.astro`, `middleware.ts` and the three route files; the React forms get no navigation logic.

The visual layer is one Astro `AuthLayout` wrapping a shared `AuthCard`, which is reused by the kitchen sink. The
form components are thin wrappers over `ui` primitives. The body of `Layout.astro` becomes a flex column so the
Banner no longer pushes the panel off-screen.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Routing and auth routes | Final redirects, zod, starter removal, D3 link, 12-step smoke | The guest-only rule accidentally catching `/api/auth/*` |
| 2. Auth screens on the UI contract | `AuthLayout`, primitives, real pending state, Banner, `bg-cosmic` removed | The `Layout.astro` body change shifting `AppLayout`; a bfcache-stuck disabled button |
| 3. Visual gate and guard | Kitchen-sink auth states, screenshots, extended `lint:ui` / pre-commit, CLAUDE.md | Extending the scan before Phase 2 is clean would fail CI (hence last) |

**Prerequisites:** local Supabase running (`npx supabase start`) for smoke; the dev server for the kitchen sink and
screenshots.
**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- Hosted Supabase has "Confirm email" on by default. Until someone turns it off in the dashboard, production sign-up
  shows "Check your email" instead of auto sign-in. It degrades safely.
- The `@supabase/ssr` cookie adapter is assumed to persist the session returned by `signUp` as it does for
  `signInWithPassword`. Smoke step 5 (signed-in `/` → `/trips`) proves or disproves this.
- A clean `lint:ui` run is necessary but not sufficient: the regex misses `placeholder-*` and `border-t-*`, so
  review has to confirm that none were reintroduced.

## Success Criteria (Summary)

- A new user reaches `/trips` from `/` in one sign-up, without a detour through "check your email" locally, and
  sign-out returns them to sign-in.
- The auth screens look like the rest of the app at desktop and 375 px, are keyboard- and screen-reader-usable, and
  pass `lint:ui`.
- `npm run smoke` and CI prove the routing contract.

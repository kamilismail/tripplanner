---
date: 2026-09-30T16:42:24+02:00
researcher: Claude (Opus 5.5) for kismail
git_commit: 387c209491449cc34058194f92b6f6f3bae1b7c2
branch: main
repository: kamilismail/tripplanner
topic: "auth-entry-redesign: current state of the entry point, auth screens, auth routes and tooling"
tags: [research, auth, routing, middleware, ui-contract, tokens, smoke, lint-ui, banner]
status: complete
last_updated: 2026-09-30
last_updated_by: Claude (Opus 5.5) for kismail
---

# Research: auth-entry-redesign

**Date**: 2026-09-30T16:42:24+02:00
**Researcher**: Claude (Opus 5.5) for kismail
**Git Commit**: 387c209 (working tree: only `context/changes/auth-entry-redesign/` untracked)
**Branch**: main
**Repository**: kamilismail/tripplanner

## Research Question

For the scope in `change.md` (change A): what does the code do today for `/`, `/dashboard`, the three auth
screens, the sign-in / sign-up / sign-out routes, `Banner` + `config-status`, `bg-cosmic`, the smoke test and the
`lint:ui` / pre-commit scope — and what gaps against the UI contract (tokens + `src/components/ui`) and the 7-state
kitchen-sink gate does the redesign have to close?

## Summary

- **Entry point.** `/` renders the starter `Welcome` page (`src/pages/index.astro:2-7`) for everyone. The middleware
  has no public-route list and no redirect for signed-in users on `/` or `/auth/*` (`src/middleware.ts:24-35`).
  `/dashboard` is protected by `PROTECTED_ROUTES` (`src/middleware.ts:4`). `Welcome` has one consumer
  (`index.astro`), and `Topbar` has one consumer (`Welcome.astro:2,18`).
- **Auth routes.** All three routes read `formData` and answer with a 302. None of them uses zod.
  - `signin` success goes to `/` (`src/pages/api/auth/signin.ts:19`).
  - `signout` always goes to `/` (`signout.ts:9`).
  - `signup` destructures only `error` from `signUp` (`signup.ts:13`), so on success it always goes to
    `/auth/confirm-email` (`signup.ts:19`). It never looks at `data.session`.
  - Local Supabase has `enable_confirmations = false` (`supabase/config.toml:209`).
- **Auth screens.** The three pages use the base `Layout.astro`. Each repeats its own `bg-cosmic` wrapper, glass
  panel and gradient heading (`signin.astro:9-17`, `signup.astro:9-17`, `confirm-email.astro:22-29`).
  - Running `check-ui-literals.mjs` on the 9 auth files flags **22 lines**: 4 per page, `FormField.tsx` 5,
    `SubmitButton.tsx` 2, and 1 each in `PasswordToggle`, `ServerError` and `SignUpForm`.
  - `Layout.astro` and `index.astro` have 0 flagged lines.
  - The only ui primitive in use is `Button`, which `SubmitButton.tsx:18` overrides with purple palette classes.
- **Banner.** Its hex values live in a scoped `<style>` (`src/components/Banner.astro:15-42`). It has one consumer,
  `Layout.astro:29`, which always passes `variant="error"`. The copy around it is Polish: "Uwaga:" and
  "Dokumentacja" in `Layout.astro`, plus the message in `src/lib/config-status.ts:15`.
- **`bg-cosmic`** is defined at `src/styles/global.css:120-122` with hex values. It has 5 consumers: `Welcome.astro:5`,
  `dashboard.astro:8`, and the three auth pages. It can be removed once those pages are gone or restyled.
- **Tooling.**
  - The smoke test hits `/dashboard` in 3 of its 8 steps (`scripts/smoke.mjs:40,56,58`). Two more steps expect
    locations that will change: signup → `/auth/confirm-email` (`:44`) and signin → `/` (`:54`).
  - `lint:ui` defaults and the lint-staged glob cover only `/trips`, `AppLayout`, `AppHeader` and `trips/*.tsx`.
  - `CLAUDE.md:62` points to the pre-archive `theme-values.md` path.

## Detailed Findings

### Routing and entry point

- `PROTECTED_ROUTES = ["/dashboard", "/trips", "/api/trips"]`, prefix-matched with `startsWith`
  (`src/middleware.ts:4,24`). When there is no user:
  - `/api/*` gets a 401 JSON response (`middleware.ts:27-31`).
  - Every other protected path gets a 302 to `/auth/signin` without a return-to parameter (`middleware.ts:33`).
- `/dev/*` returns 404 when not in DEV (`middleware.ts:9-11`). The kitchen sink relies on this.
- `context.locals.user` comes from `supabase.auth.getUser()`. It is `null` when Supabase is not configured
  (`middleware.ts:13-22`). The `/` routing therefore works off `locals.user` in whichever file the plan chooses.
- `index.astro` is `Layout` + `Welcome` (`src/pages/index.astro:2-7`).
- `dashboard.astro` uses `bg-cosmic` (`:8`), shows `user?.email` (`:14`) and has its own sign-out POST (`:17`).
- Places that reference `/dashboard`:
  - Code: `middleware.ts:4`, `Topbar.astro:13`, `smoke.mjs:40,56,58`.
  - Docs: `CLAUDE.md:32`, `CLAUDE.md.scaffold:31`, `README.md.scaffold:148`, `context/foundation/roadmap.md:69`,
    and the historical `context/deployment/deploy-plan.md:44,54`.
  - Local settings: `.claude/settings.local.json:7` has a curl allow entry for it.
- "10x Astro Starter" appears in 2 code locations: the `Layout.astro:10` default title and `Welcome.astro:23`. The
  `package.json` `name` is `10x-astro-starter`; whether that counts as a "title" is a scope choice, not a finding.
- `<html lang="en">` is already set (`Layout.astro:14`).

### Auth API routes and form submission

- **Forms.** They are native `<form method="POST" action="/api/auth/...">` elements with `noValidate`
  (`SignInForm.tsx:43`, `SignUpForm.tsx:66`).
  - The React `onSubmit` handler runs client-side validation and calls `preventDefault` only when validation fails.
  - The browser follows the 302 itself. There is no fetch.
  - Server errors come back as `?error=<message>`. The page reads them (`signin.astro:5`, `signup.astro:5`) and
    passes them to `ServerError`.
- **Route input.** Email and password are read as `form.get(...) as string` (`signin.ts:5-7`, `signup.ts:5-7`). This
  path has no zod validation, although CLAUDE.md's API convention asks for it. The same check found no
  `prerender = false` export in these route files. `SignUpForm` also posts `confirmPassword`, which the server
  ignores.
- **Sign-up and sessions.** `signUp({ email, password })` passes no options, so there is no `emailRedirectTo`
  (`signup.ts:13`).
  - `confirm-email.astro:4` sets `isAutoConfirmed = import.meta.env.DEV`. It switches the copy on build mode, not on
    whether a session came back: "Registration successful" vs "Check your email" (`confirm-email.astro:5-17`).
  - Once sign-up redirects on `data.session`, the DEV branch no longer matches reality. With a session the user
    never sees this page; without one, "check your email" is always the right text.
  - Inferred, not run: with `@supabase/ssr` the cookie adapter in `src/lib/supabase.ts` should persist a session
    returned by `signUp`, the same way it does for `signInWithPassword`.
- **Sign-out.** It is triggered from `AppHeader.astro:44-49` (the only sign-out left after `dashboard` and `Topbar`
  are removed). `signout.ts:9` redirects to `/`, which lands on the sign-in screen once `/` is re-routed.
- **Supabase config.** `supabase/config.toml:154,156` sets `site_url` and redirect URLs to `127.0.0.1:3000`, not the
  app's `:4321`. This matters only if the plan adds `emailRedirectTo` or confirmation links. The hosted project's
  "Confirm email" setting cannot be seen from the repo; `change.md` treats it as external state.

### Auth screens: UI audit against the contract

Scanner results (`node scripts/check-ui-literals.mjs <file>`, lines flagged):

| File | Lines | What |
|---|---|---|
| `src/pages/auth/signin.astro` | 4 | `:10` glass panel `border-white/10 bg-white/10 text-white`; `:11` gradient h1 `from-blue-200 to-purple-200`; `:15` `text-blue-100/60`; `:17` link `text-purple-300` |
| `src/pages/auth/signup.astro` | 4 | same lines and classes as signin |
| `src/pages/auth/confirm-email.astro` | 4 | `:23` panel, `:25` gradient h1, `:28` `text-blue-100/80`, `:29` `text-purple-300`; `:24` emoji icon |
| `src/components/auth/FormField.tsx` | 5 | `:6` `inputBase` (`bg-white/10 text-white placeholder-white/40`), `:37`, `:41`, `:53` red/purple focus, `:59` `text-red-300` |
| `src/components/auth/SubmitButton.tsx` | 2 | `:18` `bg-purple-600 text-white hover:bg-purple-500`; `:22` hand-made spinner `border-white/30 border-t-white` |
| `src/components/auth/PasswordToggle.tsx` | 1 | `:13` `text-white/40 hover:text-white/70` |
| `src/components/auth/ServerError.tsx` | 1 | `:13` `border-red-500/30 bg-red-900/30 text-red-300` |
| `src/components/auth/SignUpForm.tsx` | 1 | `:59` hint `text-blue-100/50` |
| `src/components/auth/SignInForm.tsx` | 0 | — |

- **Duplicated markup across the 3 pages:**
  - the wrapper `bg-cosmic flex min-h-screen items-center justify-center p-4`
  - the glass panel
  - the gradient h1
  - the footer link class

  This is the markup the planned `AuthLayout` would own.
- **Mapping to existing primitives** (`src/components/ui`):
  - panel → `Card` + `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`
  - raw `<input>` (`FormField.tsx:42-55`) → `Input`. `Input` already styles `aria-invalid`, focus `ring-ring` and
    `placeholder:text-muted-foreground`; today the field sets no `aria-invalid` and no `aria-describedby`.
  - `SubmitButton` → `Button` default variant (`bg-primary`) + `Spinner`
  - `PasswordToggle` → `Button variant="ghost" size="icon"`. Its focus ring is not styled today.
  - `ServerError` → `Alert variant="destructive"`
  - footer links → `buttonVariants({ variant: "link" })` or `text-primary`
  - confirm-email emoji → a lucide icon (e.g. `MailCheck`) in `text-primary`

  The variants exist today: Button {default, destructive, outline, secondary, ghost, link}, Alert {default,
  destructive, success}.
- **Scanner blind spots** found in the auth files:
  - The regex does not flag `placeholder-white/40` (`FormField.tsx:6`) or `border-t-white` (`SubmitButton.tsx:22`).
  - It skips `global.css`, so the hex inside `bg-cosmic` is never reported.

  So a clean `lint:ui` run on the auth files is necessary but not sufficient.
- **No autocomplete attributes.** The inputs set none; `email`, `current-password` and `new-password` are missing.
  This is not in the change scope, but it is cheap while `FormField` is rewritten.

### Pending state (inferred)

`SubmitButton` uses `useFormStatus().pending` (`SubmitButton.tsx:12`). React only sets `pending` for a form whose
`action` is a function. These forms use a string URL and a native browser submit (`SignInForm.tsx:43`). **Inferred
from React semantics, not run:** the "Signing in…" / "Creating account…" state and spinner never render. The
kitchen sink cannot show this state by driving the real form. It needs a prop, or the plan has to decide whether
the state is real (for example via local `submitting` state set in `onSubmit`).

### States for the 7-state kitchen-sink gate

States that exist in code today:

1. Default form (sign-in or sign-up).
2. Client field validation errors (`SignInForm`/`SignUpForm` `validate()`), including the sign-up password mismatch.
3. Sign-up password-length hint (`SignUpForm.tsx:57-63`).
4. Server error from `?error=` (`ServerError`).
5. Submitting (coded, probably unreachable; see the pending state above).
6. Missing config: the error Banner above the page, and a submit that returns "Supabase is not configured"
   (`signin.ts:11`, `signup.ts:11`).
7. Confirm-email ("Check your email").
8. Password visible or hidden.

States that do not exist:

- a success notice on sign-in
- a redirect for signed-in users who open `/auth/*`

The forms own their state and take no props for initial errors or pending. The kitchen-sink pattern
(`src/pages/dev/kitchen-sink.astro` → `KitchenSink.tsx` `Section`/`Cell` with fixtures) therefore needs new
optional props on the forms or presentational splits. Submitting inside the kitchen sink needs a `preventDefault`
guard.

### Banner and config-status

- `Banner.astro` has three variants (info, warning, error), all in hex (`Banner.astro:15-42`). The only consumer is
  `Layout.astro:29`, and it passes `variant="error"`. `info` and `warning` have 0 consumers in `src/`.
- There are no `--warning` or `--info` tokens. `--destructive` and `--success` exist (`global.css:24,28-29`,
  published at `:99,103-104`), which is enough if the Banner keeps only `error`. `--destructive-foreground` is
  missing; the destructive `Button` uses `text-white` inside the ui component.
- The Polish copy has three pieces:
  - `Layout.astro` "Uwaga:" before the message, and the fallback link label "Dokumentacja"
  - `config-status.ts:15` "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone."
  - the docs label "Zobacz instrukcję konfiguracji"
- The Banner sits in `Layout.astro` above `<slot/>`, outside the pages' `min-h-screen` wrapper. The auth pages
  therefore grow taller than the viewport when the Banner shows. An `AuthLayout` should take the Banner's height
  into account.

### Smoke test and CI

The 8 steps in `scripts/smoke.mjs:38-59`. Locations are matched with `startsWith` (`:66`).

| Line | Step | Expected today | Impact |
|---|---|---|---|
| :39 | GET `/` | 200 | Breaks if signed-out `/` becomes a 302 to `/auth/signin`. Unchanged if `/` renders the sign-in screen itself. |
| :40 | GET `/dashboard` (anonymous) | 302 → `/auth/signin` | Rewrite: `/dashboard` is removed. `/trips` gives the same behavior. |
| :41-45 | POST signup | 302 → `/auth/confirm-email` | Rewrite: local `enable_confirmations = false`, so the session-aware signup goes to `/trips` and sets cookies. |
| :46-50 | signin, wrong password | 302 → `/auth/signin?error=` | Unchanged. |
| :51-55 | signin, correct password | 302 → `/` | Rewrite to `/trips`. `startsWith("/")` matches every location, so today this assertion is weak. |
| :56 | GET `/dashboard` (signed in) | 200 | Rewrite to `/trips`. |
| :57 | POST signout | 302 → `/` | Holds if sign-out still targets `/`. The plan may switch it to `/auth/signin`. |
| :58 | GET `/dashboard` (after signout) | 302 → `/auth/signin` | Rewrite to `/trips`. |

After the signup change the account is already signed in when the "correct password" step runs. The step still
passes, but it no longer proves that sign-in created the session unless a sign-out step goes before it.

CI (`.github/workflows/ci.yml`):

- The `ci` job runs `lint`, `lint:ui` (defaults, `:24`), `astro check` and `build`.
- The `smoke` job waits on `curl -sf http://localhost:4321/` (`:56`), then runs `npm run smoke` (`:57`).
- The deploy health check uses `curl -sf` on the workers URL (`:87`).
- Both curl calls use `-f` without `-L`, so a 302 on `/` still passes them. Only 4xx/5xx fail.

### lint:ui and pre-commit scope

- `defaultFiles()` returns `src/pages/trips.astro`, `src/layouts/AppLayout.astro`, `src/components/AppHeader.astro`
  and every `src/components/trips/*.tsx` (`scripts/check-ui-literals.mjs:26-34`). CLI arguments replace the defaults,
  and a missing path exits with code 2 (`:36-45`).
- The `package.json` lint-staged glob for the scan is
  `{src/pages/trips.astro,src/layouts/AppLayout.astro,src/components/AppHeader.astro,src/components/trips/*.tsx}`.
  `.husky/pre-commit` is `npx lint-staged`.
- To cover this change, both lists need the following added: `src/pages/auth/*.astro`, `src/components/auth/*.tsx`,
  `src/pages/index.astro`, `src/layouts/Layout.astro`, `src/components/Banner.astro` and the new `AuthLayout`.
  Because CI runs the defaults, extending them before the restyle fails CI (22 lines today). The order of phases
  matters.

### CLAUDE.md lines affected

- `:62` has the stale path `context/changes/app-layout-redesign/theme-values.md`. The file now lives at
  `context/archive/2026-09-28-app-layout-redesign/theme-values.md`.
- `:32` says "Protected page example: `src/pages/dashboard.astro`", which goes stale when `/dashboard` is removed.
- `:14` and `:67` describe the lint:ui / pre-commit scope as `/trips`-only, which goes stale when the scope is
  extended.
- `:56` has two inaccuracies unrelated to this change: it says the default branch is "master" (it is `main`), and
  it says CI runs "lint + build" (it also runs `lint:ui`, `astro check` and smoke). Fixing them is outside this
  change's scope.

## Code References

- `src/middleware.ts:4,24-35` – `PROTECTED_ROUTES` and the unauthenticated redirect/401
- `src/pages/index.astro:2-7` – `/` renders `Welcome`
- `src/pages/dashboard.astro:8,14,17` – page to remove
- `src/components/Welcome.astro:2,5,18,23`, `src/components/Topbar.astro:13,16` – files to remove
- `src/pages/api/auth/signin.ts:19`, `signup.ts:13,19`, `signout.ts:9` – redirect targets and the signUp result
- `src/pages/auth/confirm-email.astro:4-17` – copy keyed on DEV
- `src/components/auth/SubmitButton.tsx:12,18,22` – `useFormStatus`, palette override, spinner
- `src/components/auth/FormField.tsx:6,42-59` – raw input, literals, no aria wiring
- `src/components/auth/ServerError.tsx:13` – literal alert; its only consumers are `SignInForm.tsx:80` and
  `SignUpForm.tsx:127`
- `src/components/Banner.astro:15-42`, `src/layouts/Layout.astro:10,28-41`, `src/lib/config-status.ts:15` – Banner,
  default title, Polish copy
- `src/styles/global.css:120-122` – `@utility bg-cosmic`
- `scripts/smoke.mjs:39-58,66` – smoke steps and prefix matching
- `scripts/check-ui-literals.mjs:14-45` – regex, default files, CLI arguments
- `supabase/config.toml:154,156,209` – site_url, redirect URLs, `enable_confirmations = false`
- `CLAUDE.md:14,32,56,62,67` – lines affected

## Architecture Insights

- Auth uses server-side form POST + 302 + `?error=`, with no client fetch. Changing redirect targets is therefore a
  change to the route files only. The React forms need no navigation logic.
- `AppLayout.astro` / `AppHeader.astro` set the pattern an `AuthLayout` can copy:
  - `bg-background text-foreground min-h-screen`
  - the `Compass` icon in `text-primary` + "TripPlanner"
  - `buttonVariants` on `<a>`
  - focus styled with `focus-visible:ring-ring`
- The `/trips` change set the gate: tokens in `global.css`, primitives from `src/components/ui`, the scanner in
  pre-commit and CI, and kitchen-sink sections. The auth screens have not been brought onto that contract yet;
  this change is the first to do so.

## Historical Context (from prior changes)

Each item was re-checked against the current code:

- `context/archive/2026-09-28-app-layout-redesign/change.md` ("Routing and pages", "Auth screens", "Deferred") – the
  decisions this change carries forward.
  - The post-login target was `/trips/new`. `change.md` of this change moves it to `/trips` until change B.
  - The fallback flow is: sign-up with a session → the app, otherwise "check your email".
  - Hosted "Confirm email" has to be turned off by hand.
- `context/archive/2026-09-28-app-layout-redesign/research.md:123-127` – deferred items D2–D6:
  - **D2** (sign-in/sign-out redirect to `/`): still true (`signin.ts:19`, `signout.ts:9`).
  - **D3** (session-expired copy without a sign-in link): still true (`useTrips.ts:16`,
    `TripGeneratorFlow.tsx:45,54`). It is not listed in this change's scope; it's a plan choice.
  - **D4** (default title and Polish Banner copy): still true (`Layout.astro:10,28-41`).
  - **D5** (`bg-cosmic` is still in use): still true, with the same five consumers.
  - **D6** (moving `ServerError` out of `auth/` because `/trips` uses it): **premise no longer holds.**
    `ServerError` is now consumed only by `SignInForm.tsx:80` and `SignUpForm.tsx:127`. `/trips` no longer imports
    it (grep over `src/`), so it can stay under `auth/`.
- `context/archive/2026-09-28-app-layout-redesign/follow-ups/review-fixes.md` – the full-opacity focus ring rule,
  applied in the ui primitives. It applies to any focusable element the auth screens add outside those primitives,
  such as a custom password toggle.
- `context/archive/2026-09-28-app-layout-redesign/theme-values.md` – token values and AA contrast. It has no
  warning/info rows.

## Related Research

- `context/archive/2026-09-28-app-layout-redesign/research.md` – the `/trips` view audit that deferred this work.

## Open Questions

Choices for `/10x-plan`; none of them is a missing-evidence gap:

1. **Signed-out `/`:** render the sign-in screen at `/`, or 302 to `/auth/signin`? The first keeps smoke `:39` at 200.
   The second means one canonical URL but requires rewriting smoke `:39`. CI curl passes either way.
2. **Sign-out target:** keep `/` (which becomes sign-in) or go straight to `/auth/signin`? This affects smoke `:57`.
3. **Signed-in user on `/auth/*`:** redirect to `/trips`? Not listed in scope; today no redirect happens.
4. **Pending state:** make it real (local state in `onSubmit`) or drop it. This affects the kitchen-sink state list.
5. **Banner variants:** keep only `error` on `destructive` tokens, or add `--warning`/`--info` tokens (with
   `theme-values.md` rows and AA contrast)? Today `info` and `warning` have 0 consumers.
6. **confirm-email:** remove the DEV-keyed "Registration successful" branch once sign-up redirects on a session?
7. **Scanner regex:** close the `placeholder-*` / `border-t-*` blind spots in this change or leave them?
8. **D3 session-expired link** and missing zod validation in the auth routes: include or leave out? Both are
   adjacent to the scope but not listed in it.

Unverifiable from the repo: the hosted Supabase "Confirm email" setting.

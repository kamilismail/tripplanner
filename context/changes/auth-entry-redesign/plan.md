# Auth Entry Redesign Implementation Plan

## Overview

This plan moves the entry point and the three auth screens (`/auth/signin`, `/auth/signup`, `/auth/confirm-email`)
onto the light travel theme's design-system contract, which means tokens plus `src/components/ui`, and fixes routing
around them:

- `/` redirects to the sign-in screen or to the app, depending on the session.
- Sign-in and sign-up with a session land on `/trips`, and sign-out lands on sign-in.
- The starter leftovers are removed: `Welcome`, `Topbar`, `/dashboard` and `bg-cosmic`.
- The kitchen sink, `lint:ui` and pre-commit extend to the auth files.

This is change A of two. Change B later splits `/trips` from `/trips/new` and switches the post-login target.

## Current State Analysis

Full audit: `context/changes/auth-entry-redesign/research.md`. In short:

- **Routing.**
  - `/` renders the starter `Welcome` for everyone (`src/pages/index.astro:2-7`).
  - The middleware only guards `PROTECTED_ROUTES = ["/dashboard", "/trips", "/api/trips"]`
    (`src/middleware.ts:4,24-35`). It has no rule for signed-in users on `/auth/*`.
  - `/dashboard`, `Welcome.astro` and `Topbar.astro` exist only for the starter.
- **Auth routes.**
  - `signin.ts:19` and `signout.ts:9` redirect to `/`.
  - `signup.ts:13,19` ignores `data.session` and always goes to `/auth/confirm-email`.
  - Input is read with `form.get(...) as string`, with no zod and no `prerender = false`.
  - Local Supabase has `enable_confirmations = false` (`supabase/config.toml:209`), so sign-up returns a session.
- **Auth screens.**
  - All three pages repeat the same `bg-cosmic` wrapper, glass panel and gradient heading.
  - The scanner flags 22 literal lines across the 9 auth files.
  - `Button` is the only primitive in use, and `SubmitButton.tsx:18` overrides it with purple palette classes.
  - `FormField` renders a raw `<input>` without `aria-invalid`, `aria-describedby` or `autocomplete`.
  - The pending state uses `useFormStatus` (`SubmitButton.tsx:12`), which never fires for a string-URL native
    form, so "Signing in…" never renders.
  - `confirm-email.astro:4` picks its copy from `import.meta.env.DEV`, not from what actually happened.
- **Banner.**
  - It has three hex-styled variants in a scoped `<style>` (`Banner.astro:15-42`). Only `error` has a consumer
    (`Layout.astro:29`).
  - The copy is Polish (`Layout.astro:30,36`, `config-status.ts:15,17`).
  - The default title is "10x Astro Starter" (`Layout.astro:10`).
- **Session expired (D3).** The copy "Your session has expired. Please sign in again." (`useTrips.ts:16`,
  `TripGeneratorFlow.tsx:45,54`) has no path to sign-in.
- **Tooling.**
  - Smoke hits `/dashboard` in 3 of 8 steps and asserts the old redirect targets (`scripts/smoke.mjs:38-59`).
  - `lint:ui` defaults and the lint-staged glob cover only `/trips`, `AppLayout`, `AppHeader` and
    `trips/*.tsx`. CI runs the defaults.

## Desired End State

- **Routing.**
  - A signed-out visitor on `/` gets a 302 to `/auth/signin`, and a signed-in one gets a 302 to `/trips`.
  - A signed-in user who opens `/auth/signin` or `/auth/signup` gets a 302 to `/trips`.
  - `/auth/confirm-email` stays reachable for everyone.
- **Auth flows.**
  - Sign-in success → `/trips`.
  - Sign-up with a returned session → `/trips`, signed in; without one → `/auth/confirm-email` ("Check your
    email").
  - Sign-out → `/auth/signin`.
  - Invalid input on the sign-in or sign-up route → back to the same page with `?error=`.
- **Screens.**
  - All three auth screens render through one `AuthLayout`: a centered `Card` on `bg-background`, with the Compass +
    "TripPlanner" wordmark.
  - They use only token classes and `ui` primitives (`Card`, `Input`, `Button`, `Spinner`, `Alert`).
  - The submit button really shows a disabled + spinner state after valid submit.
  - The missing-config Banner is English, styled with `destructive` tokens, and does not push the auth panel below
    the viewport.
- **Removed.** `Welcome.astro`, `Topbar.astro`, `dashboard.astro` and the `bg-cosmic` utility are gone.
- **Session expired.** The error on `/trips` offers a "Sign in" link.
- **Gate and tooling.**
  - `/dev/kitchen-sink` has auth sections covering the 7-state matrix, with desktop and 375 px screenshots in
    `context/changes/auth-entry-redesign/screenshots/`.
  - `npm run lint:ui` (defaults) covers the auth files and passes.
  - `npm run smoke` passes against the new routing.

### Key Discoveries:

- Auth is native form POST → 302 → `?error=`, with no client fetch (`SignInForm.tsx:43`). Redirect changes live only
  in the route files.
- `AppHeader.astro:16-23` is the wordmark pattern to reuse (Compass `text-primary`, `focus-visible:ring-ring`,
  `buttonVariants` on `<a>`).
- `src/pages/api/trips/index.ts:1,12,26-33,52-58` is the zod + `prerender = false` + `safeParse` pattern to follow.
- `Alert` has a `destructive` variant (`src/components/ui/alert.tsx:11-12`), and `Spinner` wraps `Loader2`
  (`spinner.tsx:6-8`). Neither needs new tokens.
- The kitchen sink is `src/pages/dev/kitchen-sink.astro` → `KitchenSink.tsx` `Section`/`Cell`
  (`src/components/trips/KitchenSink.tsx:91-113`). `/dev/*` returns 404 outside dev (`middleware.ts:9-11`).
- CI waits on `curl -sf http://localhost:4321/` (`.github/workflows/ci.yml:56`). A 302 on `/` still passes, because
  `-f` fails only on 4xx/5xx.

## What We're NOT Doing

- Splitting `/trips` from `/trips/new`, the post-accept highlight and the unsaved-plan warning (change B). The
  post-login target stays `/trips` until then.
- Split-screen auth layout, password reset, OAuth providers, dark mode toggle.
- `--warning` / `--info` tokens and Banner `info`/`warning` variants (0 consumers).
- Closing the scanner regex blind spots (`placeholder-*`, `border-t-*`). The literals they would catch disappear in
  Phase 2 anyway.
- A return-to parameter on the sign-in redirect, and `emailRedirectTo` / `site_url` fixes in `supabase/config.toml`.
- Changing the hosted Supabase "Confirm email" setting. That is external state; see the manual step in Phase 1.
- Renaming `package.json` `name`, and editing `CLAUDE.md.scaffold`, `README.md.scaffold`, historical
  `context/deployment/*` or `.claude/settings.local.json`.
- CLAUDE.md `:56` ("master", "lint + build"). It is inaccurate but unrelated to this change.

## Implementation Approach

The work comes in three phases, ordered by what each one can prove:

1. **Behavior first**, verified by the rewritten smoke test while the screens still look old.
2. **The visual contract** next: layout, primitives and Banner.
3. **The gate last.** The kitchen-sink sections need the form props from Phase 2, and extending `lint:ui` defaults
   before Phase 2 would fail CI on the 22 existing literal lines.

## Critical Implementation Details

- **Middleware ordering.** The guest-only rule (signed-in on `/auth/signin|signup` → `/trips`) must run after
  `locals.user` is resolved and must never apply to `/api/auth/*`. Otherwise a signed-in POST to signup or signin
  would redirect instead of running. Match exact paths (trailing slash normalized), not prefixes.
- **Real pending state vs bfcache.** Once `submitting` is set in `onSubmit`, the browser can restore the page from
  bfcache on Back with the button still disabled. Reset `submitting` on `pageshow` when `event.persisted` is true.
- **Banner vs viewport height.** The Banner renders in `Layout.astro` above `<slot/>`, so an `AuthLayout` wrapper
  with `min-h-screen` overflows by the Banner's height. Make the body a flex column with a minimum of screen height,
  and let the auth wrapper `flex-1`. Check that `AppLayout` (`min-h-screen` today) still renders unchanged.
- **Static React in Astro.** `AuthLayout` is the repo's first non-hydrated React render from `.astro`. Astro's React
  renderer deletes the `class` prop (`@astrojs/react/dist/server.js:55`), so write `className` on `Card*`; otherwise
  the classes vanish silently and no check catches it. Named slots become React props, not children (`:57-63`), so
  place `<slot name="footer" />` as the child of `<CardFooter>`, never `slot="footer"` on it.

## Phase 1: Routing and auth routes

### Overview

The entry point and all redirects get their final behavior, the auth routes get zod validation, starter pages are
removed, and smoke is rewritten to prove the new flow.

### Changes Required:

#### 1. Entry point

**File**: `src/pages/index.astro`

**Intent**: Replace the `Welcome` render with a session-based redirect, so `/` is never a page of its own.

**Contract**: `return Astro.redirect(Astro.locals.user ? "/trips" : "/auth/signin")`, with no layout and no markup.
(Change B later swaps `/trips` for `/trips/new`.)

#### 2. Middleware

**File**: `src/middleware.ts`

**Intent**: Drop `/dashboard` from protected routes, and redirect signed-in users away from the guest-only auth pages.

**Contract**:

- `PROTECTED_ROUTES = ["/trips", "/api/trips"]`.
- New `GUEST_ONLY_ROUTES = ["/auth/signin", "/auth/signup"]`, exact match after stripping a trailing slash. When
  `locals.user` is set, 302 to `/trips`.
- `/auth/confirm-email` and `/api/auth/*` are untouched.

#### 3. Auth API routes

**Files**: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`, `src/pages/api/auth/signout.ts`

**Intent**: Validate form input with zod, send successful auth to `/trips`, make sign-up session-aware, and send
sign-out straight to sign-in.

**Contract**:

- All three export `const prerender = false`.
- signin and signup parse `Object.fromEntries(formData)` with a zod schema:
  - signin: `email` is a trimmed email; `password` is `min(1)`.
  - signup: the same email rule; `password` is `min(6)`, matching `MIN_PASSWORD_LENGTH` in `SignUpForm.tsx:8`.
  - A failed `safeParse` redirects to the same page with `?error=<English message>`, the way the Supabase error
    path does today.
- signin success redirects to `/trips`.
- signup reads `{ data, error }`: when `data.session` is set, redirect to `/trips`; otherwise redirect to
  `/auth/confirm-email`.
- signout always redirects to `/auth/signin`.
- The "Supabase is not configured" branches keep their behavior.

#### 4. Confirm-email copy

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: This page is now reached only when sign-up returned no session, so "Check your email" is always correct.
Remove the DEV-keyed "Registration successful" branch.

**Contract**: One content block: "Check your email", the confirmation-link sentence, and "Back to sign in". The
visual restyle happens in Phase 2.

#### 5. Remove starter pages

**Files**: delete `src/pages/dashboard.astro`, `src/components/Welcome.astro`, `src/components/Topbar.astro`

**Intent**: They have no remaining purpose. `Welcome` is consumed only by `index.astro`, and `Topbar` only by
`Welcome`.

**Contract**: A grep for `Welcome`, `Topbar` and `/dashboard` over `src/` and `scripts/` returns nothing.

#### 6. Default title

**File**: `src/layouts/Layout.astro`

**Intent**: Replace the starter title.

**Contract**: `title = "TripPlanner"` default. Pages keep passing their own titles.

#### 7. Session-expired link (D3)

**Files**: `src/components/hooks/useTrips.ts`, `src/components/trips/TripGeneratorFlow.tsx`, and the path the errors
travel: `TripsPanel.tsx` (passes `useTrips().error` to `TripList`), `TripList.tsx` (`ListError`), `GeneratorForm.tsx`
(generation error alert), `PlanReview.tsx` (save error alert), plus the fixtures in `KitchenSink.tsx`

**Intent**: When a request fails with 401 (or is redirected), the error the user sees should offer a way back to
sign-in, not just tell them to sign in again.

**Contract**:

- The 401 path is marked explicitly. For example, the hook result and the flow's error state carry a
  `sessionExpired: boolean` alongside the message; the implementer picks the exact shape. The new component prop is
  optional and defaults to `false`, so the existing kitchen-sink fixtures compile unchanged.
- The rendered alert adds a "Sign in" link (`buttonVariants({ variant: "link" })`, `href="/auth/signin"`). In
  `ListError` it replaces the "Try again" button. The `GeneratorForm` and `PlanReview` alerts have no retry action, so
  the link sits next to the message there.
- The message strings stay as they are, and the files stay `lint:ui`-clean.
- The existing kitchen-sink error cells keep working. If the Trip list section gains a "Session expired" cell,
  that is enough.

#### 8. Smoke test

**File**: `scripts/smoke.mjs`

**Intent**: Replace the `/dashboard` steps and prove the new routing. The "correct password" step must again prove
that sign-in creates the session.

**Contract**: The ordered steps, each asserting status plus the `startsWith` location:

1. GET `/` anonymous → 302 `/auth/signin`
2. GET `/trips` anonymous → 302 `/auth/signin`
3. POST signup with an invalid email → 302 `/auth/signup?error=`
4. POST signup → 302 `/trips` (session cookies stored)
5. GET `/` signed in → 302 `/trips`
6. GET `/auth/signin` signed in → 302 `/trips`
7. POST signout → 302 `/auth/signin`
8. POST signin with the wrong password → 302 `/auth/signin?error=`
9. POST signin with the correct password → 302 `/trips`
10. GET `/trips` signed in → 200
11. POST signout → 302 `/auth/signin`
12. GET `/trips` after signout → 302 `/auth/signin`

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build passes: `npm run build`
- UI literal scan (current defaults) passes: `npm run lint:ui`
- Smoke passes against the dev server with local Supabase: `npm run smoke`
- No references remain: `grep -rn "dashboard\|Welcome\|Topbar" src scripts` returns nothing

#### Manual Verification:

- In the browser: `/` signed out lands on sign-in; sign-up with a new account lands on `/trips` signed in; the header
  sign-out lands on sign-in; `/auth/signin` while signed in lands on `/trips`
- An expired or cleared session on `/trips` shows the session-expired error with a working "Sign in" link
- Hosted Supabase "Confirm email" is disabled in the dashboard (Authentication → Providers → Email), or the user
  accepts that production sign-up falls back to "Check your email"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual
confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Auth screens on the UI contract

### Overview

The auth screens get a shared `AuthLayout`, and every auth component is rebuilt from `ui` primitives and token
classes. The pending state becomes real, the Banner and its copy are restyled, and `bg-cosmic` is removed.

### Changes Required:

#### 1. AuthLayout

**File**: `src/layouts/AuthLayout.astro` (new)

**Intent**: Own the markup the three pages duplicate today: the centered panel on the light background, with the
brand mark above it.

**Contract**:

- Props: `title` (the page `<title>` and the `CardTitle`) and optional `description` (`CardDescription`). Default
  slot for the `CardContent`, named slot `footer` for the `CardFooter`.
- It wraps `Layout` and uses the React `Card` family rendered statically from Astro.
- Structure: a `bg-background text-foreground` wrapper that centers its content and fills the remaining height
  below the Banner (see Critical Implementation Details). The Compass + "TripPlanner" wordmark follows
  `AppHeader.astro:16-23`; it is non-interactive here, or a link to `/auth/signin`. Below it, the `AuthCard`.
- It has no palette classes or literals.

**File**: `src/components/auth/AuthCard.astro` (new)

**Intent**: The card body as its own piece, so the kitchen sink (Phase 3) can render it inside `AppLayout`, where
`AuthLayout` cannot nest.

**Contract**: Same `title` / `description` props and default + `footer` slots as `AuthLayout`, which forwards them.
It renders the `Card` of `w-full max-w-sm` with `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` /
`CardFooter`, and no page wrapper.

**File**: `src/layouts/Layout.astro`

**Intent**: Let pages fill the height left under the Banner.

**Contract**: `body` becomes a min-screen-height flex column (`m-0 flex min-h-screen flex-col`). The scoped
`<style>` block (`html, body { margin: 0; width: 100%; height: 100% }`, `Layout.astro:46-53`) is removed: it compiles
unlayered, so its `height: 100%` would beat the Tailwind utility and pin the body to exactly 100vh. `AppLayout` keeps
rendering identically, which is checked visually on `/trips`.

#### 2. Auth pages

**Files**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`

**Intent**: Render through `AuthLayout` with no page-level styling of their own.

**Contract**:

- signin: title "Sign in"; the footer "Don't have an account? Sign up" links with `buttonVariants({ variant:
  "link" })` or `text-primary`.
- signup: title "Create account"; the footer links to sign in the same way.
- confirm-email: the `MailCheck` lucide icon in `text-primary` replaces the emoji; the heading and description come
  from Phase 1; the "Back to sign in" link is styled as in signin.
- Each file scans clean with `node scripts/check-ui-literals.mjs <file>`.

#### 3. Form primitives

**File**: `src/components/auth/FormField.tsx`

**Intent**: Build the field on `ui/Input` and wire accessibility.

**Contract**:

- It renders `<Input>` with `aria-invalid` when there is an error, and `aria-describedby` pointing at the error or
  hint element (stable ids derived from `id`).
- New `autoComplete` prop.
- The leading icon uses `text-muted-foreground`.
- The error text uses `text-destructive`, and the label uses the default `text-sm font-medium` foreground.
- The `inputBase` constant and all palette classes are removed.

**Files**: `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`

**Intent**: Pass autocomplete values, restyle the sign-up hint, and make the pending state real.

**Contract**:

- `autoComplete`: `email` on both email fields; `current-password` on sign-in; `new-password` on both sign-up
  password fields.
- The hint uses `text-muted-foreground`.
- Local `submitting` state is set to `true` in `handleSubmit` only when `validate()` passes, and passed to
  `SubmitButton`.
- A `pageshow` listener resets it when `event.persisted`.

**File**: `src/components/auth/SubmitButton.tsx`

**Intent**: Drop `useFormStatus` and the palette override. Pending is driven by a prop.

**Contract**:

- Props: `{ pending: boolean; pendingText; icon; children }`.
- It renders `<Button type="submit" className="w-full" disabled={pending}>` with the default variant.
- While pending it shows `<Spinner />` + `pendingText`, and `aria-busy` is set.

**File**: `src/components/auth/PasswordToggle.tsx`

**Intent**: Use the ghost icon button so it inherits the full-opacity focus ring (the review-fixes rule from
app-layout-redesign).

**Contract**: `<Button type="button" variant="ghost" size="icon">`, absolutely positioned inside the field. It keeps
its `aria-label`, adds `aria-pressed={visible}`, and uses `text-muted-foreground`.

**File**: `src/components/auth/ServerError.tsx`

**Intent**: Replace the hand-made alert.

**Contract**: `<Alert variant="destructive">` with `CircleAlert` + `AlertDescription`. It returns `null` when there
is no message, as before.

#### 4. Banner and config copy

**File**: `src/components/Banner.astro`

**Intent**: Replace the scoped hex CSS with token classes, and keep only the variant that has a consumer.

**Contract**:

- No `variant` prop and no `<style>` block.
- `role="alert"`.
- Classes along the lines of `bg-destructive/10 text-destructive border-destructive border-b px-4 py-3 text-center
  text-sm`.
- Links inside it are underlined and semibold, via a token-safe child selector or classes on the link in
  `Layout.astro`.
- Before settling on the background, check `text-destructive` on the chosen background for AA. If a new token is
  needed, add the row to `context/archive/2026-09-28-app-layout-redesign/theme-values.md`; this is not expected.

**Files**: `src/layouts/Layout.astro`, `src/lib/config-status.ts`

**Intent**: The UI is in English.

**Contract**:

- In `Layout.astro`, "Uwaga:" → "Warning:" and "Dokumentacja" → "Documentation", and `variant="error"` is dropped
  from the call.
- `config-status.ts:15` becomes "Supabase is not configured — authentication is disabled.", and the label becomes
  "See the setup guide".

#### 5. Remove `bg-cosmic`

**File**: `src/styles/global.css`

**Intent**: Once Phase 2 restyles the auth pages (Phase 1 already removed the other consumers), no page uses the
utility.

**Contract**: The `@utility bg-cosmic` block (`global.css:120-122`) is deleted, and a grep for `bg-cosmic` over
`src/` returns nothing.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build passes: `npm run build`
- The auth files scan clean with `node scripts/check-ui-literals.mjs <auth files>`, where the files are: `src/pages/auth/signin.astro src/pages/auth/signup.astro src/pages/auth/confirm-email.astro src/layouts/AuthLayout.astro src/components/auth/AuthCard.astro src/layouts/Layout.astro src/components/Banner.astro src/pages/index.astro src/components/auth/FormField.tsx src/components/auth/PasswordToggle.tsx src/components/auth/ServerError.tsx src/components/auth/SignInForm.tsx src/components/auth/SignUpForm.tsx src/components/auth/SubmitButton.tsx`
- No `bg-cosmic` or `useFormStatus` remains: `grep -rn "bg-cosmic\|useFormStatus" src` returns nothing
- Smoke still passes: `npm run smoke`

#### Manual Verification:

- The sign-in, sign-up and confirm-email screens match the light travel theme at desktop and 375 px width, with no
  horizontal scroll
- Keyboard: Tab order is email → password → toggle → submit → footer link, and every focusable element shows the
  `ring-ring` focus ring
- A valid submit shows the disabled button with a spinner; pressing Back from `/trips` after sign-in either redirects to `/trips` again or (bfcache restore) shows an enabled button, never a stuck disabled one
- A client validation error sets `aria-invalid`, and the accessibility tree reads the error as the field description
- With `SUPABASE_URL` unset, the English Banner shows above the panel and the page does not scroll vertically on
  desktop
- `/trips` header and layout look unchanged after the `Layout.astro` body change

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual
confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Visual gate and guard

### Overview

The auth states become visible in the kitchen sink, the visual gate is recorded with screenshots, and the literal
scan plus pre-commit are extended so the next change keeps the auth screens on the contract.

### Changes Required:

#### 1. Fixture props on the forms

**Files**: `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`

**Intent**: The kitchen sink has to show states that normally require typing or a server round trip.

**Contract**:

- New optional props: `initialValues?`, `initialErrors?`, `initialShowPassword?: boolean`, `forcePending?: boolean`
  and `demo?: boolean`.
- `demo` makes `handleSubmit` always `preventDefault`, so the kitchen sink never posts.
- The initial props only seed `useState`. Production pages pass none of them.

#### 2. Kitchen-sink auth sections

**Files**: `src/components/auth/AuthKitchenSink.tsx` (new), `src/pages/dev/kitchen-sink.astro`

**Intent**: Add auth sections next to the `/trips` ones, reusing the `Section`/`Cell` presentation.

**Contract**:

- Export `Section`/`Cell` from `KitchenSink.tsx`, or move them to a small shared file; do not copy them.
- The 7-state matrix, with N/A notes where a state cannot exist:
  - **Sign-in form:** Default, Field error (empty + invalid email), Loading / disabled (`forcePending`), Error
    (server `?error=` message), Password visible.
  - **Sign-up form:** Default, Field error (password mismatch), Hint (password-length counter), Loading / disabled,
    Error.
  - **Empty:** N/A; the forms always render.
  - **Success:** the confirm-email panel. Sign-up with a session redirects and has no screen of its own.
  - **Missing config:** the Banner.
- The Astro-only pieces render directly in `kitchen-sink.astro`: the `Banner`, and the confirm-email panel through
  `src/components/auth/AuthCard.astro` from Phase 2, the same card `AuthLayout` uses.
- If Phase 1 added a "Session expired" error cell to the Trip list section, it lives in the existing
  `KitchenSink.tsx`.

#### 3. Screenshots

**Directory**: `context/changes/auth-entry-redesign/screenshots/`

**Intent**: Record the visual gate.

**Contract**: Desktop and 375 px captures of the kitchen-sink auth sections, `/auth/signin` and
`/auth/confirm-email`, plus `/auth/signin` with the missing-config Banner.

#### 4. Extend the literal scan and pre-commit

**Files**: `scripts/check-ui-literals.mjs`, `package.json` (lint-staged)

**Intent**: Keep the auth screens on the contract in CI and in pre-commit.

**Contract**:

- `defaultFiles()` adds `src/pages/index.astro`, `src/pages/auth/*.astro`, `src/layouts/AuthLayout.astro`,
  `src/layouts/Layout.astro`, `src/components/Banner.astro` and every `src/components/auth/*.{tsx,astro}`. Directory
  listings follow the existing `trips` pattern.
- The lint-staged glob for `lint:ui` gets the same paths.
- The TOKEN_SOURCE exclusion is unchanged.

#### 5. CLAUDE.md

**File**: `CLAUDE.md`

**Intent**: Remove stale statements.

**Contract**:

- `:32`: the protected-page example becomes `src/pages/trips.astro`, and the auth layout is mentioned.
- `:62`: the path becomes `context/archive/2026-09-28-app-layout-redesign/theme-values.md`.
- `:14` and `:67`: the `lint:ui` / pre-commit scope includes the auth screens.
- The UI bullets say that signed-out pages render in `src/layouts/AuthLayout.astro`, and that the kitchen sink
  covers `/trips` and the auth screens.

### Success Criteria:

#### Automated Verification:

- UI literal scan with extended defaults passes: `npm run lint:ui`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build passes: `npm run build`
- Smoke passes: `npm run smoke`
- The screenshot files exist in `context/changes/auth-entry-redesign/screenshots/`

#### Manual Verification:

- `/dev/kitchen-sink` shows every auth state listed above, at desktop and 375 px, with no layout breakage
- Submitting a form in the kitchen sink does not navigate or post
- A deliberate palette class added to an auth file is rejected by the pre-commit hook (then reverted)
- CLAUDE.md reads correctly for the new layout, paths and scan scope

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual
confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- None. The repo has no test suite (CLAUDE.md), and adding one is out of scope.

### Integration Tests:

- `scripts/smoke.mjs` (12 steps, Phase 1) covers the full routing and auth contract against local Supabase, and CI
  runs it against the production preview.

### Manual Testing Steps:

1. Signed out, open `/`; you land on `/auth/signin`.
2. Sign up with a new email; you land on `/trips`, signed in.
3. Open `/auth/signup`; you land on `/trips`. Sign out from the header; you land on `/auth/signin`.
4. Sign in with a wrong password; the destructive alert shows the error. Sign in correctly; you land on `/trips`.
5. Clear the auth cookies on `/trips` and trigger a refresh; the session-expired error shows a "Sign in" link.
6. Unset `SUPABASE_URL` and restart; the English Banner shows above the auth panel with no vertical overflow.
7. Walk `/dev/kitchen-sink` at desktop and at 375 px.

## Performance Considerations

None beyond today. The middleware does one additional exact-path comparison, and `getUser()` already runs on every
request.

## Migration Notes

- No data migration.
- Bookmarked `/dashboard` URLs now 404. That is acceptable for a starter page.
- Production sign-up auto sign-in depends on hosted Supabase "Confirm email" being disabled. Until it is, users see
  "Check your email", which is still correct behavior.

## References

- Research: `context/changes/auth-entry-redesign/research.md`
- Upstream decisions: `context/archive/2026-09-28-app-layout-redesign/change.md` ("Routing and pages", "Auth
  screens", "Deferred")
- Theme values: `context/archive/2026-09-28-app-layout-redesign/theme-values.md`
- Focus-ring rule: `context/archive/2026-09-28-app-layout-redesign/follow-ups/review-fixes.md`
- Patterns: `src/components/AppHeader.astro:16-23`, `src/pages/api/trips/index.ts:1-58`,
  `src/components/trips/KitchenSink.tsx:91-113`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Routing and auth routes

#### Automated

- [x] 1.1 Lint passes: `npm run lint`
- [x] 1.2 Type check passes: `npx astro check`
- [x] 1.3 Build passes: `npm run build`
- [x] 1.4 UI literal scan (current defaults) passes: `npm run lint:ui`
- [x] 1.5 Smoke passes against the dev server with local Supabase: `npm run smoke`
- [x] 1.6 No references remain: `grep -rn "dashboard\|Welcome\|Topbar" src scripts` returns nothing

#### Manual

- [x] 1.7 In the browser: `/` signed out lands on sign-in; sign-up with a new account lands on `/trips` signed in; the header sign-out lands on sign-in; `/auth/signin` while signed in lands on `/trips`
- [x] 1.8 An expired or cleared session on `/trips` shows the session-expired error with a working "Sign in" link
- [x] 1.9 Hosted Supabase "Confirm email" is disabled in the dashboard (Authentication → Providers → Email), or the user accepts that production sign-up falls back to "Check your email"

### Phase 2: Auth screens on the UI contract

#### Automated

- [ ] 2.1 Lint passes: `npm run lint`
- [ ] 2.2 Type check passes: `npx astro check`
- [ ] 2.3 Build passes: `npm run build`
- [ ] 2.4 The auth files scan clean with `node scripts/check-ui-literals.mjs <auth files>`
- [ ] 2.5 No `bg-cosmic` or `useFormStatus` remains: `grep -rn "bg-cosmic\|useFormStatus" src` returns nothing
- [ ] 2.6 Smoke still passes: `npm run smoke`

#### Manual

- [ ] 2.7 The sign-in, sign-up and confirm-email screens match the light travel theme at desktop and 375 px width, with no horizontal scroll
- [ ] 2.8 Keyboard: Tab order is email → password → toggle → submit → footer link, and every focusable element shows the `ring-ring` focus ring
- [ ] 2.9 A valid submit shows the disabled button with a spinner; pressing Back from `/trips` after sign-in either redirects to `/trips` again or (bfcache restore) shows an enabled button, never a stuck disabled one
- [ ] 2.10 A client validation error sets `aria-invalid`, and the accessibility tree reads the error as the field description
- [ ] 2.11 With `SUPABASE_URL` unset, the English Banner shows above the panel and the page does not scroll vertically on desktop
- [ ] 2.12 `/trips` header and layout look unchanged after the `Layout.astro` body change

### Phase 3: Visual gate and guard

#### Automated

- [ ] 3.1 UI literal scan with extended defaults passes: `npm run lint:ui`
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 Type check passes: `npx astro check`
- [ ] 3.4 Build passes: `npm run build`
- [ ] 3.5 Smoke passes: `npm run smoke`
- [ ] 3.6 The screenshot files exist in `context/changes/auth-entry-redesign/screenshots/`

#### Manual

- [ ] 3.7 `/dev/kitchen-sink` shows every auth state listed above, at desktop and 375 px, with no layout breakage
- [ ] 3.8 Submitting a form in the kitchen sink does not navigate or post
- [ ] 3.9 A deliberate palette class added to an auth file is rejected by the pre-commit hook (then reverted)
- [ ] 3.10 CLAUDE.md reads correctly for the new layout, paths and scan scope

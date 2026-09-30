---
change_id: app-layout-redesign
title: Full app layout and visual redesign with a light travel theme
status: implemented
created: 2026-09-28
updated: 2026-09-30
archived_at: null
---

## Notes

Decisions agreed with the user on 2026-09-28 (input for `/10x-plan`):

**Scope: full overhaul.** All three layers are in scope: app shell, flow and routing, visual system.

**Language:** the whole UI is in English. That includes the missing-config banner, which is currently in Polish. Also set `lang="en"` and replace the "10x Astro Starter" titles.

**Routing and pages**
- `/`: unauthenticated users see the sign-in screen; authenticated users are redirected to `/trips/new` (the generator is the post-login home). No marketing landing. The current `Welcome.astro` starter page goes away.
- `/dashboard`: removed (page, Topbar link, `PROTECTED_ROUTES` entry).
- `/trips`: "My trips", the list of saved trips plus a prominent "Plan a new trip" action.
- `/trips/new`: the generator and plan review. After accept, go back to `/trips` with the new trip highlighted. Today both the generator and the list live on `/trips` in `TripsPanel`.
- Leave room for a future `/trips/[id]` (S-02/S-03), but don't build it now.

**App header (signed in):** TripPlanner logo, then "My trips" (→ `/trips`), "New trip" (→ `/trips/new`), the user email as plain text, and "Sign out". All three actions are rendered as shadcn `Button`s, not text links. Navigation uses `asChild` + `<a>`; sign-out stays a POST form submit. Visual hierarchy: "New trip" is the primary (filled) variant; "My trips" and "Sign out" are secondary (outline/ghost). The button for the current page shows an active state (`aria-current="page"`). Shared across all authenticated pages. Today `/trips` has no header at all.

**Auth screens**
- Modern, centered panel on a light background (no split layout for now).
- Sign-in: email and password fields right away; below them "Don't have an account? Sign up" linking to the sign-up page.
- Sign-up: after registering, the user is signed in and redirected to `/trips/new`. Implementation: if `signUp` returns a session, redirect to `/trips/new`; otherwise fall back to the "check your email" screen.
  - Local Supabase has `enable_confirmations = false`, so a session is returned.
  - Hosted/production Supabase has "Confirm email" on by default. The user must disable it in the Supabase dashboard (Authentication → Providers → Email) for auto sign-in to work in production. That is external state, not code.
- Sign-in and sign-out currently redirect to `/`. Sign-in should land on `/trips/new` (generator); sign-out on the sign-in screen.

**Visual system**
- Replace the dark "cosmic" theme (`bg-cosmic`, glass cards, purple gradients) with a **light, travel-themed** look.
- Move colors into the shadcn tokens in `src/styles/global.css` (`--primary`, `--card`, and the rest). Today they sit unused at the default grey palette while components hardcode Tailwind colors.
- Add shadcn `Card` (and other primitives as needed). Remove the duplicated class constants (`inputClass`, `primaryButtonClass`, `cardClass`, the auth form classes).
- Restyle `Banner.astro` with Tailwind and tokens instead of its own CSS.
- Introduce layouts: an app layout (header + content container) for authenticated pages and an auth layout (centered panel) for the auth screens.

**Theme details**
- Palette: beach/travel. Sand and warm neutrals for backgrounds and surfaces, orange as the primary/accent color. Keep text contrast WCAG AA.
- Font: a nice, modern web font; the plan picks one (e.g. a Google Font). No strong user preference.
- Logo: a compass icon (e.g. `Compass` from `lucide-react`) next to the "TripPlanner" wordmark.

**Mobile header:** on narrow screens hide the email and keep compact buttons (icon, or icon + short label) for My trips / New trip / Sign out. No hamburger menu.

**Empty state on `/trips`:** when the user has no saved trips, show a friendly message and a "Plan your first trip" button → `/trips/new`.

**Unsaved-plan warning:** if the user is on `/trips/new` with a generated but not yet accepted plan (or a generation in progress) and tries to leave (header buttons, other links, reload or closing the tab), warn them that the plan will be lost and let them stay or leave. The explicit "Discard" button needs no extra confirmation. The plan decides the mechanism: `beforeunload` covers reload and close with the browser's generic dialog; in-app links may need a custom confirm dialog. Note that the header is outside the generator's React island.

**Out of scope:** editing and deleting trips (S-02/S-03), a trip detail page, a dark mode toggle.

## UI contract scope (/10x-ui, 2026-09-30)

User narrowed this change to **one view** on 2026-09-30, following the `/10x-ui` rule of one view plus global tokens per change.

- **View:** `/trips`, meaning `src/pages/trips.astro` → `TripsPanel`, `TripGeneratorFlow` and `TripList`, plus the signed-in app header (`AppLayout`) that wraps it.
- **Token source:** `src/styles/global.css` (`:root` / `.dark` values published through `@theme inline`). Replace the palette with the beach/travel theme (sand neutrals, orange primary) and add the web font. Record the raw values and their source in `context/changes/app-layout-redesign/theme-values.md`.
- **Contract variant:** a fresh starter with a dead token file. Views use 0 token classes today. Phase 1 wires the view to the existing tokens; new values come after that.
- **Components:** `src/components/ui` (shadcn, new-york). Add missing primitives with `npx shadcn@latest add <name>` (at least `card`). Never run a second `shadcn init`.
- **Visual gate:** a kitchen-sink page for `/trips` showing all 7 states, with desktop and mobile screenshots. The repo has no Playwright.

### Deferred to separate changes (decisions above remain valid input)

- Splitting `/trips` (list) from `/trips/new` (generator), plus the post-accept highlight. Reason: routing/flow change, not visual.
- The unsaved-plan warning. Reason: it depends on the `/trips/new` split.
- `/` routing (sign-in or redirect), removing `Welcome.astro` and `/dashboard`. Reason: a separate entry-point change.
- Auth screens (`AuthLayout`, sign-in/sign-up/confirm-email restyle) and sign-up auto sign-in. Reason: a separate view.
- `Banner.astro` restyle and English copy. Reason: shared with other views; take it with the auth-screens change unless the audit shows it on `/trips`.
- The other pages keep `bg-cosmic` until their own change. Removing the `bg-cosmic` utility is deferred until no page uses it.

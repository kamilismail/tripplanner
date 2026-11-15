---
change_id: auth-entry-redesign
title: Entry point and auth screens on the light travel theme
status: impl_reviewed
created: 2026-09-30
updated: 2026-11-15
archived_at: null
---

## Notes

Change A of two agreed with the user on 2026-09-30. It picks up the deferred items from
`context/archive/2026-09-28-app-layout-redesign/change.md` (sections "Routing and pages", "Auth screens",
"Deferred to separate changes"); those decisions remain the input. Change B (split `/trips` into the list and
`/trips/new`, post-accept highlight, unsaved-plan warning) is a separate change through the normal chain.

## UI contract scope (/10x-ui, 2026-09-30)

- **View:** the auth screens behind one `AuthLayout` (centered panel): `/auth/signin` (primary, also what `/`
  shows to signed-out users), `/auth/signup`, `/auth/confirm-email`.
- **Token source:** `src/styles/global.css` (`:root` / `.dark` values published through `@theme inline`), the
  beach/travel theme already introduced by app-layout-redesign. Values and rationale:
  `context/archive/2026-09-28-app-layout-redesign/theme-values.md`. New values only if the audit needs them.
- **Contract variant:** existing design system (tokens + `src/components/ui`: button, card, input, alert, spinner,
  skeleton). The auth screens read none of it today (0 token classes, `Button` overridden with palette classes).
  Extend it; never run `shadcn init`.
- **Visual gate:** kitchen-sink sections for the auth screens (7 states), desktop + 375 px screenshots.

## In scope

- `/`: signed-out → sign-in screen; signed-in → redirect to `/trips` (switches to `/trips/new` in change B).
- Remove `Welcome.astro`, `Topbar.astro`, `/dashboard` (page + `PROTECTED_ROUTES` entry) and rewrite the
  `/dashboard` checks in `scripts/smoke.mjs`.
- Sign-in lands on `/trips`; sign-out lands on the sign-in screen.
- Sign-up: if `signUp` returns a session, redirect to `/trips`; otherwise fall back to "check your email".
  Hosted Supabase needs "Confirm email" disabled for auto sign-in (external state, not code).
- `Banner.astro` on Tailwind + tokens; English copy for the banner and `config-status`; replace the
  "10x Astro Starter" title.
- Remove the `bg-cosmic` utility once no page uses it.
- Extend `lint:ui` / pre-commit scope to the auth files; fix the stale `theme-values.md` path in `CLAUDE.md`.

## Out of scope

- `/trips` split, `/trips/new`, highlight, unsaved-plan warning (change B).
- Split-screen auth layout, password reset, OAuth providers, dark mode toggle.

## Contrast check (Phase 2, 2026-11-15)

Banner `text-destructive` on `bg-destructive/10` over `background`, computed from the `global.css` oklch tokens:
light 4.57:1 (sRGB mix) / 4.67:1 (oklab mix, Tailwind 4 `color-mix`); dark 6.19:1. AA passes (≥ 4.5), but with
little headroom in light. Any darker tint or lighter `--destructive` needs a re-check. No new token.

## Visual gate (Phase 3, 2026-11-15)

Screenshots are in `screenshots/`: `signin-*`, `confirm-email-*`, `kitchen-sink-*` (full page) and `kitchen-sink-auth-*`
(auth sections only), each at desktop (1280) and 375 px. None has horizontal overflow. They were taken with headless
Chrome over CDP with device emulation. The `/auth/signin` + missing-config Banner capture is replaced, by user
decision, by the Banner cell in `kitchen-sink-auth-*`. A second server cannot override `SUPABASE_URL` (Astro allows
one dev server, and preview reads `.dev.vars`), and manual check 2.11 already confirmed the Banner on the real page.

---
date: 2026-09-30T14:40:14+02:00
researcher: Claude (claude-opus-5-5) for kismail
git_commit: e1945fa
branch: main
repository: tripplaner
topic: "UI audit of /trips (10x-ui): charges against the design-system contract"
tags: [research, ui-audit, trips, tokens, shadcn, TripsPanel, TripGeneratorFlow, TripList]
status: complete
last_updated: 2026-09-30
last_updated_by: Claude (claude-opus-5-5)
---

# Research: UI audit of `/trips`

**Date**: 2026-09-30T14:40:14+02:00
**Researcher**: Claude (claude-opus-5-5) for kismail
**Git Commit**: e1945fa (working tree has uncommitted edits to `CLAUDE.md` and `change.md`; none of them touch the audited view files)
**Branch**: main
**Repository**: tripplaner

## Research Question

This is the `/10x-ui` audit brief for one view, `/trips`: `src/pages/trips.astro` → `TripsPanel`, `TripGeneratorFlow`, `TripList`, plus the planned signed-in header. The token source is `src/styles/global.css`. The audit runs in both directions, source → view and view → source. It produces 3–5 charges, each with a file:line and its user impact, plus a 7-state matrix for the view's controls. Anything outside `/trips` is deferred.

## Summary

The view was built with literal Tailwind palette classes on top of a hand-rolled dark "cosmic" glass theme, and the shadcn token layer went unused.

- **Token usage.** Across the 4 view files there are 0 token utility classes (`bg-primary`, `text-muted-foreground` and similar). The pre-audit scan found 37 literal hits: 18 in `TripGeneratorFlow.tsx`, 14 in `TripList.tsx`, 3 in `trips.astro` and 2 in `TripsPanel.tsx`.
- **Components.** The view imports 3 of the 4 components in `src/components/ui` (`Button`, `Input`, `Spinner`). Every `Button` instance overrides its variant with literal classes. There is no `Card`, and card chrome is copied in 5 places.
- **Architecture.** `/trips` has no header, so a signed-in user on this page has no in-app way to sign out or navigate. The "session expired" messages give no path to sign in.

The charges below map onto the plan order **environment/library → token values → one view → states**.

## Charges

### C1 — Missing tokens: the view paints with palette literals, not roles

- **Evidence:**
  - `src/pages/trips.astro:9` uses `bg-cosmic`, defined with hex values in `src/styles/global.css:113-115`.
  - `src/pages/trips.astro:11` has a gradient heading `from-blue-200 to-purple-200 bg-clip-text text-transparent`.
  - `src/pages/trips.astro:14` uses `text-blue-100/60`.
  - `src/components/trips/TripsPanel.tsx:12` has `cardClass` with `border-white/10 bg-white/10 text-white`.
  - `src/components/trips/TripGeneratorFlow.tsx`: headings, meta and icons use `text-white` / `text-blue-100/60…80` / `text-purple-200…300` at lines 192, 196, 202, 208, 210, 211, 256, 275, 305 and 306.
  - `src/components/trips/TripList.tsx:46-47, 59, 131, 132, 143, 153, 159, 161, 162` repeat the same pattern.
- **What should cover it:**
  - Page background → `bg-background` (`global.css:8`).
  - Headings and point names → `text-foreground` / `text-card-foreground`.
  - `blue-100/60…80` meta text → `text-muted-foreground`.
  - `purple-200/300` day labels and icons → `text-primary` (or `accent`).
  - The page body already applies `bg-background text-foreground` (`global.css:123`). `bg-cosmic` paints over it.
- **User impact:** the view cannot follow the planned light travel theme without editing every class in 4 files. With about 10 different opacity steps of blue and purple, text contrast is uneven, and nobody checks it because no token pair defines it.

### C2 — Missing shared component: Button variants are bypassed and there is no Card

- **Evidence:**
  - `src/components/trips/TripGeneratorFlow.tsx:21-22` defines `primaryButtonClass` (`bg-purple-600 … hover:bg-purple-500`) and `secondaryButtonClass`. They are passed as `className` at lines 223, 231, 297 and 314, which overrides the `default` and `outline` variants of `src/components/ui/button.tsx:12,16`.
  - `src/components/trips/TripList.tsx:81` copies `secondaryButtonClass` verbatim instead of importing it or using `variant="outline"`.
  - `src/components/trips/TripGeneratorFlow.tsx:19-20` has `inputClass`, which overrides the input's own token styling in `src/components/ui/input.tsx:11-13`.
  - Card chrome is duplicated:
    - `TripsPanel.tsx:12` (`cardClass`, used at 34 and 39)
    - `TripGeneratorFlow.tsx:201` (day card)
    - `TripList.tsx:59` (empty-state box)
    - `TripList.tsx:116` (trip item)
  - `src/components/ui` has no `card.tsx` (listing checked: `LibBadge.astro`, `button.tsx`, `input.tsx`, `spinner.tsx`).
  - The day/point list markup is copied between `TripGeneratorFlow.tsx:199-218` and `TripList.tsx:150-169`.
  - Alerts are literal: `ServerError` (`src/components/auth/ServerError.tsx:13`, red palette) and the success message at `TripGeneratorFlow.tsx:247` (green palette). `ServerError` lives under `auth/` even though `/trips` uses it at `TripGeneratorFlow.tsx:6` and `TripList.tsx:5`.
- **What should cover it:**
  - `Button` with `variant="default" | "outline"` and no colour overrides.
  - `Input` without `inputClass`.
  - `npx shadcn@latest add card` (and `alert` for error and success).
  - One shared day-points list component.
- **User impact:** the same action (for example "Try again") is built twice, so any change to one copy leaves the other behind. It is also why the buttons ignore `--primary`, so a theme change will not reach them.

### C3 — Accidental architecture: no app shell on the signed-in page

- **Evidence:**
  - `src/pages/trips.astro:8-21` renders `Layout` → `TripsPanel` with no header.
  - `Topbar` is imported only by `src/components/Welcome.astro:2,18`, the landing page. Search scope: `grep -rn Topbar src`.
  - Sign-out exists only as a form in `src/components/Topbar.astro:16`.
  - After sign-in the user lands on `/` (`src/pages/api/auth/signin.ts:19`), not `/trips`.
  - The signed-in email is shown only inside the generator card (`trips.astro:14-16`).
  - The "Your session has expired. Please sign in again." messages at `TripGeneratorFlow.tsx:44,53` and `src/components/hooks/useTrips.ts:16` have no sign-in link.
- **Entry paths checked:**
  - **Logged out, or from a direct link:** `src/middleware.ts:18-27` redirects to `/auth/signin`, and `/api/trips*` returns JSON 401. This path is correct.
  - **No trips:** a text state is shown (`TripList.tsx:58-61`); see C4.
  - **Session expired mid-use:** an error appears with no way forward except editing the URL.
- **What should cover it:** an `AppLayout` with a header containing the logo, "My trips", "New trip" and "Sign out", built from shadcn `Button` (`asChild` for links, a POST form for sign-out), as agreed in `change.md`.
- **User impact:** someone who reaches `/trips` cannot sign out or navigate from the page. They have to know URLs or clear cookies.

### C4 — States drift: focus ring, disabled, empty and loading are ad hoc

- **Evidence:**
  - **Focus.** Inputs force `focus-visible:ring-purple-400` (`TripGeneratorFlow.tsx:20`). The trip toggle uses `outline-none focus-visible:ring-2 focus-visible:ring-purple-400` (`TripList.tsx:128`). Buttons keep the component's `ring-ring/50` (`button.tsx:8`), where `--ring` is a neutral grey `oklch(0.708 0 0)` (`global.css:26`), shown at 50% on a dark translucent card. That gives three different focus treatments in one view.
  - **Disabled.** `fieldset … disabled:opacity-60` (`TripGeneratorFlow.tsx:254`) stacks with the button's `disabled:opacity-50` (`button.tsx:8`) and the input's `disabled:opacity-50` (`input.tsx:11`), so disabled controls sit at about 30% opacity during generation.
  - **Error.** The field error uses `text-red-300` and `border-red-400/60` (`TripGeneratorFlow.tsx:269, 292, 327`), not `destructive`.
  - **Empty.** `TripList.tsx:59-60` shows only text ("Generate a plan above…"), with no action.
  - **Loading.** The list's first load shows a single line with a spinner (`TripList.tsx:45-50`). When cards arrive, the height jumps.
- **What should cover it:** `--ring` as the single focus token (no per-control ring colour), `destructive` for errors, a single disabled treatment, a Card-based empty state with a call to action, and a skeleton for the list.
- **User impact:**
  - Keyboard users see a different focus indicator, or a faint one, depending on the control.
  - Disabled inputs during generation are hard to read.
  - An empty list gives no next step beyond pointing "above".

### 7-state matrix (current behaviour)

The columns cover three control groups: the generator form (inputs, submit), the review actions (Accept, Discard, Try again) and the trip list (toggle, retry).

| State | Generator form | Review actions | Trip list |
| --- | --- | --- | --- |
| default | literals (`inputClass`, `primaryButtonClass`), C1/C2 | literal `primary/secondaryButtonClass` | literal card and text, C1 |
| hover | `hover:bg-purple-500` (literal) | `hover:bg-white/20` (literal) | toggle: **no hover style** (`TripList.tsx:128`) |
| focus-visible | ring-purple-400 on inputs; grey ring/50 on submit | grey ring/50 | ring-purple-400 on toggle; grey ring/50 on retry |
| disabled | stacked opacity 0.6 × 0.5 (`:254` + `button.tsx:8`) | `disabled={isSaving}`, opacity 0.5 | retry disabled while loading |
| error | red-300 / red-400 literals, `aria-invalid` set | `ServerError` literal red (`:220`) | `ServerError` + retry (`TripList.tsx:73-88`) |
| empty | N/A: the form always renders | N/A: review renders only with a plan (`:180`) | text only, no CTA (`TripList.tsx:59`) |
| loading | spinner + text under the form (`:304-309`); the button shows "Generating..." | "Saving..." spinner in Accept (`:233-234`) | spinner line, then a layout jump (`:45-50`); refresh dims with `opacity-60` (`:63`) |

### Deferred (not in this change; reasons are in `change.md` → Deferred)

- **D1.** Splitting generator and list into `/trips/new` and `/trips` (the "generator and list on one screen" architecture charge). Reason: routing/flow change. Inside this change they stay as two Cards on one page.
- **D2.** Sign-in redirecting to `/` instead of the trips view (`signin.ts:19`) and sign-out to `/` (`signout.ts:9`). Reason: the entry-point change. C3 notes them only as evidence.
- **D3.** The session-expired link to sign-in (from C3). Reason: this is a copy and flow tweak, not a visual one. It can be picked up in the view phase if it's cheap, otherwise it waits for the auth change.
- **D4.** `Layout.astro:10` default title "10x Astro Starter", and `Layout.astro:24,29` with the Polish banner copy. Reason: shared with every page.
- **D5.** Removing `@utility bg-cosmic` (`global.css:113-115`). Reason: `Welcome.astro`, `dashboard.astro` and the three auth pages still use it.
- **D6.** Moving `ServerError` out of `auth/`. Reason: the auth forms use it too. Restyling it with tokens is in scope (C2); relocating it is optional.

## Source → view counts

| File | Token utility classes | Imports from `@/components/ui` | Literal-scan hits |
| --- | --- | --- | --- |
| `src/pages/trips.astro` | 0 | 0 | 3 |
| `src/components/trips/TripsPanel.tsx` | 0 | 0 | 2 |
| `src/components/trips/TripGeneratorFlow.tsx` | 0 | 3 (`Button`, `Input`, `Spinner`) | 18 |
| `src/components/trips/TripList.tsx` | 0 | 2 (`Button`, `Spinner`) | 14 |

How these were counted:
- **Token classes:** regex `\b(bg|text|border|ring|from|to)-(background|foreground|card|primary|secondary|muted|accent|destructive|border|input|ring|popover)(-foreground)?\b` over these 4 files.
- **Literal hits:** the `/10x-ui` scan, counting lines, not occurrences.
- **Shared components:** `ServerError.tsx` is a shared component rather than a view file, but its red palette literals (line 13) show up on `/trips`.

## Code References

- `src/styles/global.css:6-34` – `:root` token values, the default neutral shadcn palette. They are published through `@theme inline` at lines 72-111.
- `src/styles/global.css:113-115` – the `bg-cosmic` utility, with hex literals.
- `src/components/ui/button.tsx:7-33` – token-driven variants, overridden by the view.
- `src/components/ui/input.tsx:10-15` – token-driven input, overridden by `inputClass`.
- `src/components/trips/TripGeneratorFlow.tsx:19-22` – duplicated class constants.
- `src/components/trips/TripsPanel.tsx:12` – `cardClass`.
- `src/components/trips/TripList.tsx:81,116-117,128` – copied secondary button, a card with a literal glow `shadow-[0_0_0_3px_rgb(192_132_252/0.35)]`, and a custom focus ring.
- `src/components/auth/ServerError.tsx:13` – literal red alert.
- `src/middleware.ts:4,18-27` – `/trips` is protected. Logged-out users are redirected, and the API returns 401 JSON.
- `components.json` – shadcn `new-york`, `cssVariables: true`, CSS at `src/styles/global.css`. The contract already exists, so no second `init` is needed.

## Architecture Insights

- The contract variant is **a fresh starter with a dead token file**. The shadcn tokens and `@theme inline` wiring are correct (`global.css:72-111`), but no view uses them. Phase 1 should switch the view onto tokens first; the travel palette values come after that.
- `<html>` never receives a `.dark` class (`Layout.astro:14`). The dark look comes from `bg-cosmic` plus literal white text, not from `.dark` tokens. Dark mode is out of scope (see `change.md`), but a light theme through `:root` alone is consistent with that.
- The highlight on a just-saved trip (`TripList.tsx:117`) is a literal box-shadow. It should become a `ring-primary` or `ring` token treatment.

## Historical Context (from prior changes)

- `context/archive/2026-09-26-generate-and-save-trip-plan/reviews/impl-review.md:43-46` – The earlier review found `/trips` reachable only by typing the URL. It was fixed by adding a "Trips" link to `Topbar`, which renders only on the landing page. Current verdict: the link is still there (`Topbar.astro:10`), but `/trips` itself still has no navigation. C3 covers that remaining part.
- `context/archive/2026-09-26-generate-and-save-trip-plan/plan.md:180` – `/trips` was designed to follow the `dashboard.astro` pattern, which explains the copied `bg-cosmic` glass wrapper.

## Related Research

Not applicable: no other `research.md` exists under `context/changes/` or `context/archive/`.

## Open Questions

- Which web font to use. `change.md` leaves the choice to the plan. It belongs in the environment/library phase and in `theme-values.md`.
- Whether the empty-state CTA should scroll or focus the generator card on this page (D1 keeps both on one screen) or wait for the `/trips/new` link. This is a product choice for `/10x-plan`.

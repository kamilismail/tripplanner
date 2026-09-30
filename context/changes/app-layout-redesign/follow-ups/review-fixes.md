# Review fixes

Queued follow-ups from implementation reviews. Apply in the named phase.

## Phase 4 addendum — full-opacity focus ring (from impl-review-phase-2 F1)

- `src/styles/global.css` `@layer base`: `outline-ring/50` → `outline-ring`
- `src/components/ui/button.tsx:8`, `src/components/ui/input.tsx`: `focus-visible:ring-ring/50` → `focus-visible:ring-ring`
- Extra check for 4.6: the rendered ring (not only the token) is ≥ 3:1 against `--background` and `--card`
- Why: at 50% alpha the ring renders at 1.84:1 (WCAG 1.4.11 requires 3:1); the solid token is 3.54:1

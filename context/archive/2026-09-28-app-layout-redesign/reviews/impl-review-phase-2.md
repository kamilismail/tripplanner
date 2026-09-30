<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: `/trips` Design-System Contract and Light Travel Theme

- **Plan**: context/changes/app-layout-redesign/plan.md
- **Scope**: Phase 2 of 5
- **Reviewed phases**: 2
- **Date**: 2026-09-30
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Evidence: commit `0058398` touches only `src/styles/global.css`, `theme-values.md` and `plan.md`. The 18 listed `:root` tokens and `--success`/`--success-foreground` changed; `.dark`, `--chart-*` and `--sidebar-*` are unchanged; `@theme inline` gains only `var()` references. Build and lint pass; the contrast pairs recomputed from the CSS match `theme-values.md` (text 5.02–14.79:1, ring/background 3.54:1).

## Findings

### F1 — Rendered focus ring is 1.84:1, below 3:1

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/styles/global.css (`@layer base` `outline-ring/50`); src/components/ui/button.tsx:8, src/components/ui/input.tsx (`focus-visible:ring-ring/50`)
- **Detail**: Criterion 2.3 measures the solid `--ring` token (3.54:1 on background). Every consumer draws it at 50% alpha. Blended over the new background it is 1.84:1 (1.88:1 on card), which fails WCAG 1.4.11 non-text contrast. The user observed the same during manual check 2.4 ("the ring looks purple, not orange" on the dark auth page). The plan's criterion checked the token, not the rendered indicator.
- **Fix A ⭐ Recommended**: In Phase 4 (4.6 "same orange focus ring"), use a full-opacity ring: change the base rule to `outline-ring` and `ring-ring/50` → `ring-ring` in `button.tsx`/`input.tsx`; record it as a plan addendum to Phase 4.
  - Strength: Fixes it at the source for every control, in the phase that already owns focus consistency.
  - Tradeoff: Edits stock shadcn components (diverges from registry defaults); auth pages get a stronger ring too.
  - Confidence: HIGH — solid token already measured at 3.54:1.
  - Blind spot: Ring on the purple auth button (dark page) not re-measured; that view is out of scope.
- **Fix B**: Keep shadcn defaults and darken `--ring` until the 50% blend reaches 3:1.
  - Strength: No component edits.
  - Tradeoff: Needs a near-brown ring; loses the orange accent the change agreed on.
  - Confidence: MED — requires a very dark value to survive 50% alpha.
  - Blind spot: Not computed exactly.
- **Decision**: FIXED via Fix A (queued as Phase 4 addendum in follow-ups/review-fixes.md)

### F2 — `.dark` has no `--success`

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/styles/global.css (`.dark` block)
- **Detail**: The plan says to leave `.dark` unchanged, so `bg-success` would resolve to nothing under `.dark`. `.dark` is never applied (`Layout.astro`), so there is no effect today.
- **Fix**: None now; add `--success` to `.dark` when dark mode is scoped.
- **Decision**: SKIPPED

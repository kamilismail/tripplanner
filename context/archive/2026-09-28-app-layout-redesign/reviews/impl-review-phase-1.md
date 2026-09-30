<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: `/trips` Design-System Contract and Light Travel Theme

- **Plan**: context/changes/app-layout-redesign/plan.md
- **Scope**: Phase 1 of 5
- **Reviewed phases**: 1
- **Date**: 2026-09-30
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — lint:ui silently passes when explicit files are missing

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/check-ui-literals.mjs:34-36
- **Detail**: The `existsSync` filter applies to explicitly passed paths too, so `npm run lint:ui -- src/typo.tsx` scans nothing, prints "No hardcoded UI values found" and exits 0. The plan only asks to skip missing files in the default set. A `readFileSync` crash (directory, unreadable file) also exits 1, the same code as "hits found".
- **Fix**: Skip missing files only for the default set; for explicit args print "missing file" and exit 2; wrap `readFileSync` in try/catch with exit 2.
- **Decision**: FIXED

### F2 — Scan regex has known gaps and false positives

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/check-ui-literals.mjs:8-21
- **Detail**: The regex is a character-for-character port of the `/10x-ui` skill regex (as the plan requires), but it misses `ring-offset-*`, `placeholder-*`, `caret-*`, `accent-*`, `decoration-*` palette classes and arbitrary values in units other than px/rem; the hex pattern can match `href="#faded"`.
- **Fix**: Document the limitations in the script's header comment (keep the regex identical to the skill).
- **Decision**: FIXED

### F3 — Google Fonts is a third-party request (CSP / GDPR / render-blocking)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/layouts/Layout.astro:19-24
- **Detail**: The plan chose Google Fonts with preconnect + `display=swap`. No CSP exists today, so nothing breaks, but a future CSP needs `fonts.googleapis.com`/`fonts.gstatic.com`, each visitor's IP goes to Google (EU GDPR point), and the stylesheet is render-blocking cross-origin.
- **Fix**: Accept for the MVP, as planned (the plan's "Performance Considerations" already covers the cost).
  - Strength: Matches the approved plan; zero new dependencies.
  - Tradeoff: Third-party request remains; revisit if a CSP or privacy policy lands.
  - Confidence: HIGH — no CSP anywhere in the repo today.
  - Blind spot: No legal/privacy requirement for the deployed app has been checked.
- **Decision**: ACCEPTED — Google Fonts kept for the MVP, as planned; no CSP today

### F4 — skeleton.tsx uses React namespace without importing React

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/ui/skeleton.tsx:1-3
- **Detail**: Uses `React.ComponentProps<"div">` via the global `@types/react` namespace; `tsc --noEmit` passes and this is upstream shadcn output, but every other ui file has `import * as React from "react"`.
- **Fix**: Add `import * as React from "react";` for consistency.
- **Decision**: FIXED

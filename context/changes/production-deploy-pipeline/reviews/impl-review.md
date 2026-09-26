<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Production Deploy Pipeline

- **Plan**: context/changes/production-deploy-pipeline/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-09-26
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — No `permissions:` block in ci.yml

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml (whole file)
- **Detail**: No `permissions:` key is declared at workflow or job level, so all three jobs (`ci`, `smoke`, `deploy`) run with the repo-default `GITHUB_TOKEN` scope. None of the jobs actually use `GITHUB_TOKEN` for anything beyond `actions/checkout` (read-only need), so the blast radius is low today — but it's a cheap least-privilege hardening step, especially for the `deploy` job which now runs with production Cloudflare credentials.
- **Fix**: Add `permissions: contents: read` at the top level of ci.yml (or per-job, if any job later needs more).
- **Decision**: FIXED

## Notes

- Both parallel review agents came back clean. Drift-detection agent: MATCH on every line of the `deploy` job against the Phase 2 contract, no added/removed/reordered steps, consistent style with the neighboring `ci`/`smoke` jobs.
- Security/quality agent: no secret leakage into logs, no `run:` script-injection vectors (no `github.event.*` interpolated into shell), health-check retry loop is logically correct (exits 0 on first success, falls through to `exit 1` after 10 failed attempts), and the `eslint.config.js` `.claude/**` ignore doesn't exclude any application code (verified no `.ts`/`.tsx` files live under `.claude/`).
- Two deliberate, already-approved deviations from the literal plan text were confirmed as intentional during implementation, not drift:
  1. `master` → `main` branch name throughout ci.yml (repo's actual default branch is `main`; this affected the pre-existing `ci`/`smoke` triggers too, not just the new `deploy` job).
  2. Unplanned `eslint.config.js` fix (added `.claude/**` to ignores) — this was a pre-existing, unrelated lint blocker (parsing error on `.claude/skills/10x-plan/scripts/metadata-guard*.mjs`) that prevented the `ci` job from ever going green, discovered and fixed mid-implementation with explicit user sign-off. Out of the plan's literal scope but necessary to make the plan's own success criteria achievable.
- All Success Criteria (automated and manual, across all 3 phases) were verified against a real push to `main`, a real approval in the GitHub UI, a real `wrangler deploy` + health check, and a real throwaway PR confirming the `if:` guard skips `deploy` on pull_request events.

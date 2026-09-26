# Production Deploy Pipeline — Plan Brief

> Full plan: `context/changes/production-deploy-pipeline/plan.md`

## What & Why

Right now the app is publicly reachable on Cloudflare only because someone ran `wrangler deploy` by hand. F-02's actual outcome is a CI/CD-owned deploy: `wrangler deploy` running as a real, gated step in GitHub Actions, so production releases stop depending on a manual command from a developer's machine — reducing the infra risk register's secrets/deploy unknowns before the November crunch.

## Starting Point

`.github/workflows/ci.yml` has `ci` (lint, `astro check`, build) and `smoke` (local-Supabase smoke test) jobs, but no deploy job at all. `wrangler.jsonc`/`astro.config.mjs` are already correctly configured for the Cloudflare adapter. The app is manually deployed and live at `https://trip-planner.kamil-ismail.workers.dev/`.

## Desired End State

A push to `master` that passes CI triggers a `deploy` job that waits for a manual approval, then runs `wrangler deploy`, then confirms the production URL responds. No manual `wrangler deploy` needed going forward.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Manual-promotion mechanism | GitHub Environment (`production`) with required-reviewer rule | Native GitHub gate, matches `ci_default_flow: manual-promotion` and the infra doc's "human in the loop for production" rule | Plan |
| Preview/PR deploys | Out of scope — production only | Keeps this change narrow; infra doc treats PR-preview secrets as a separate later step | Plan |
| Gemini API key | Deferred to `generate-and-save-trip-plan` (S-01) | No code calls Gemini yet; configuring an unused secret now adds nothing but rotation risk | Plan |
| Deploy trigger | Same workflow, `needs: [ci, smoke]`, on push to `master` | Guarantees the deployed commit already passed lint/build/smoke — one coherent pipeline | Plan |
| Post-deploy verification | Automated health check (`curl` against the production URL) | Immediate automated signal a deploy actually worked, without testing full app flows | Plan |
| Failed health check behavior | Job goes red; manual rollback only, no auto `wrangler rollback` | Infra doc warns rollback doesn't revert Supabase migrations or secret changes — auto-rollback could give false confidence | Plan |

## Scope

**In scope:**
- New `deploy` job in the existing `ci.yml`, gated by a GitHub Environment approval
- Cloudflare API token + GitHub Environment/secrets setup (external state)
- Automated post-deploy health check

**Out of scope:**
- Preview/per-PR Cloudflare deploys
- Gemini API key / `astro:env` schema changes
- Automatic rollback on failed health check
- Custom domain / routing changes

## Architecture / Approach

One new job (`deploy`) appended to the existing `ci.yml`, depending on the current `ci` + `smoke` jobs and scoped to a `production` GitHub Environment for approval. Deploy step uses `cloudflare/wrangler-action`; a `curl` loop afterward is the automated success signal.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. External prerequisites | Cloudflare API token + GitHub Environment/secrets configured | Manual dashboard steps — easy to mis-scope the token or skip the reviewer rule |
| 2. `deploy` job in CI workflow | New gated job in `ci.yml` with health check | `if:` guard must correctly exclude PR runs from requesting approval |
| 3. End-to-end verification | Proven real push→approve→deploy→health-check cycle | Confirms failure path (red job, no auto-rollback) matches expectations before relying on it |

**Prerequisites:** Cloudflare account + dashboard access (to create the API token); GitHub repo admin access (to create the Environment and secrets).
**Estimated effort:** ~1 session across 3 phases — mostly configuration, one small YAML addition.

## Open Risks & Assumptions

- Assumes `SUPABASE_URL`/`SUPABASE_KEY` are already set as Cloudflare Workers Secrets from the earlier manual deploy — Phase 1 verifies this with `wrangler secret list` rather than assuming it.
- The `*.workers.dev` URL has no custom domain; if a custom domain is added later, the health-check URL in the `deploy` job needs updating too.

## Success Criteria (Summary)

- A push to `master` triggers a `deploy` job that requires explicit approval before touching production.
- After approval, the job deploys via Wrangler and automatically confirms the production URL is reachable.
- No developer needs to run `wrangler deploy` manually for a production release again.

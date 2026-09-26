# Production Deploy Pipeline Implementation Plan

## Overview

Wire a real `wrangler deploy` step into `.github/workflows/ci.yml` so production deploys happen through CI/CD, gated behind a manual approval (per `ci_default_flow: manual-promotion`), instead of a developer running `wrangler deploy` from their own machine. Configure the Cloudflare/GitHub secrets and GitHub Environment needed for that job to authenticate and run unattended, and add an automated health check after each deploy so a broken production release fails the pipeline loudly instead of silently.

## Current State Analysis

- The app is already manually deployed to Cloudflare Workers and publicly reachable at `https://trip-planner.kamil-ismail.workers.dev/` (confirmed by the user), presumably via a local `wrangler login` (interactive OAuth) session — that auth method does not work in a non-interactive CI runner.
- `.github/workflows/ci.yml` has two jobs, `ci` (lint, `astro check`, build) and `smoke` (build + local Supabase + smoke test against `npm run preview`). Neither job runs `wrangler deploy` or touches Cloudflare at all — there is no deploy step in CI today.
- `wrangler.jsonc` and `astro.config.mjs` are already configured for the `@astrojs/cloudflare` adapter with both required `nodejs_compat*` compatibility flags set — no adapter or compat changes needed.
- `astro.config.mjs`'s `env.schema` only declares `SUPABASE_URL` / `SUPABASE_KEY` — no Gemini key field, matching the confirmed decision to defer Gemini secret configuration to S-01 (it isn't called from any code path yet).
- `context/foundation/infrastructure.md` (prior research) already specifies: Cloudflare Workers Secrets hold `SUPABASE_URL`/`SUPABASE_KEY` in production (set via `wrangler secret put`), routine deploys can run unattended, but production promotion requires a human in the loop, and `wrangler rollback` does **not** revert Supabase migrations or secret changes — manual rollback only.
- No GitHub Environment, no `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` repo secrets, and no branch/environment protection rule exist yet — these are all external state that must be created outside the repo (GitHub UI, Cloudflare dashboard).

## Desired End State

Pushing to `master` after CI (`ci` + `smoke`) passes triggers a `deploy` job that waits for a manual approval against the GitHub `production` Environment, then runs `wrangler deploy` using a scoped Cloudflare API token, then curls the production URL and fails the job if it doesn't respond successfully. No developer needs to run `wrangler deploy` from their own machine for a production release again.

**Verification:** push a trivial commit to `master`, approve the pending deployment in the GitHub Actions UI, confirm the `deploy` job goes green and the health-check step logs a successful response from `https://trip-planner.kamil-ismail.workers.dev/`.

### Key Discoveries:

- [ci.yml](.github/workflows/ci.yml) — existing `ci` and `smoke` jobs run independently (no `needs:` between them); the new `deploy` job must depend on both.
- [context/foundation/infrastructure.md](context/foundation/infrastructure.md) — "Approval" section is the authoritative source for the manual-promotion requirement and for treating rollback as manual/incomplete.
- [wrangler.jsonc](wrangler.jsonc) — `name: "trip-planner"`, no custom domain/routes configured, so the production URL is the default `*.workers.dev` subdomain the user confirmed.
- [context/foundation/roadmap.md:90](context/foundation/roadmap.md:90) — F-02's outcome text names `SUPABASE_URL`, `SUPABASE_KEY`, and a Gemini key; per the confirmed decision, the Gemini key is explicitly deferred to the `generate-and-save-trip-plan` change since no code references it yet.

## What We're NOT Doing

- No preview/per-PR Cloudflare deploys — production only, per confirmed scope decision.
- No Gemini API key secret or `astro:env` schema field — deferred to S-01 (`generate-and-save-trip-plan`) when the Gemini SDK is actually wired in.
- No automatic `wrangler rollback` on a failed health check — failures leave the job red for manual investigation, per the confirmed decision and the infra doc's warning that rollback doesn't revert Supabase/secret changes.
- No changes to the `smoke` job's local-Supabase flow — it stays exactly as-is; `deploy` only adds a new downstream job.
- No custom domain / routing changes — stays on the existing `*.workers.dev` URL.

## Implementation Approach

Add a single new `deploy` job to the existing `ci.yml` workflow rather than a separate workflow file, so the deploy is structurally tied to the same CI run that validated the code (`needs: [ci, smoke]`). Gate it with a GitHub Environment (`production`) carrying a required-reviewer protection rule — GitHub's native approval mechanism — rather than a bespoke `workflow_dispatch` job, so the pending approval shows up inline in the same workflow run. Use Cloudflare's own `wrangler-action` to run the deploy, authenticated with a scoped API token stored as a repository secret. Finish with a plain `curl` health check against the known production URL as the automated signal that the deploy actually worked.

The GitHub Environment, its protection rule, and the Cloudflare API token are external state that can't be created by editing files in this repo — Phase 1 walks through creating them (with guidance during implementation), and Phase 2's CI change assumes they already exist.

## Phase 1: External prerequisites (Cloudflare token + GitHub Environment)

### Overview

Create the Cloudflare API token and GitHub-side configuration the `deploy` job in Phase 2 depends on. This phase has no file changes — it's account/dashboard configuration, done interactively with guidance.

### Changes Required:

#### 1. Cloudflare API token

**Intent**: Create a token scoped narrowly enough for CI to run `wrangler deploy` without holding full account access.

**Contract**: A Cloudflare API token created from the dashboard's "Edit Cloudflare Workers" template (or equivalent custom scope covering Workers Scripts:Edit for the target account/zone), copied once and stored as the GitHub repository secret `CLOUDFLARE_API_TOKEN`. The Cloudflare account ID (visible on the dashboard's Workers & Pages overview) is stored as the repository secret `CLOUDFLARE_ACCOUNT_ID`.

#### 2. GitHub Environment `production`

**Intent**: Gate the deploy job behind a human approval, matching `ci_default_flow: manual-promotion`.

**Contract**: A GitHub Environment named `production` (repo Settings → Environments) with a required-reviewer protection rule (the user as reviewer). `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` may live here as environment secrets (preferred, since they're only needed by the gated job) instead of plain repository secrets.

#### 3. Confirm existing production Workers Secrets

**Intent**: Verify the already-manually-deployed app's `SUPABASE_URL`/`SUPABASE_KEY` are set as Cloudflare Workers Secrets (not just used locally), since the CI deploy job only pushes code — it does not set Workers Secrets.

**Contract**: `npx wrangler secret list` against the production Worker (`trip-planner`) lists `SUPABASE_URL` and `SUPABASE_KEY`. If either is missing, set it with `npx wrangler secret put <NAME>` before Phase 3's verification.

### Success Criteria:

#### Automated Verification:

- None — this phase is external configuration, not code.

#### Manual Verification:

- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are present as secrets on the GitHub `production` Environment (or repo-level, if the host doesn't support environment-scoped secrets in this plan).
- The `production` Environment has a required-reviewer protection rule configured.
- `npx wrangler secret list` confirms `SUPABASE_URL` and `SUPABASE_KEY` already exist as production Workers Secrets.

**Implementation Note**: Pause here for manual confirmation that all three items above are actually in place before starting Phase 2 — Phase 2's job will fail immediately without them.

---

## Phase 2: `deploy` job in CI workflow

### Overview

Add the `deploy` job to `.github/workflows/ci.yml`: builds with production secrets, runs `wrangler deploy` via `cloudflare/wrangler-action`, then health-checks the live URL.

### Changes Required:

#### 1. New `deploy` job

**File**: `.github/workflows/ci.yml`

**Intent**: Add a job that only runs after both existing jobs pass, targets the `production` GitHub Environment (so it waits for the required reviewer), builds the app with production Supabase secrets, deploys it with Wrangler, and verifies the live URL responds.

**Contract**:

```yaml
  deploy:
    needs: [ci, smoke]
    if: github.ref == 'refs/heads/master' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://trip-planner.kamil-ismail.workers.dev
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
      - name: Health check production
        run: |
          for i in $(seq 1 10); do
            curl -sf -o /dev/null https://trip-planner.kamil-ismail.workers.dev/ && exit 0
            sleep 3
          done
          echo "Production health check failed after deploy" >&2
          exit 1
```

The `if:` guard keeps the job from attempting to run (and blocking on an approval) for pull-request events on this same workflow — only a push to `master` should ever request production deployment. Job-level `environment:` is what causes GitHub to hold the job for the `production` Environment's required reviewer before any step executes.

### Success Criteria:

#### Automated Verification:

- `deploy` job appears in the Actions run for a push to `master`, pending approval, once `ci` and `smoke` are both green.
- After approval, `npm run build` step in the `deploy` job succeeds.
- Health-check step exits 0 when the production URL is reachable.

#### Manual Verification:

- Approving the deployment in the GitHub UI is required before `wrangler deploy` runs — confirm the job does not proceed without it.
- A pull-request run of the same workflow does NOT create a pending `deploy` approval (the `if:` guard works).

**Implementation Note**: Pause here for manual confirmation after a real push-to-master run completes successfully before moving to Phase 3.

---

## Phase 3: End-to-end verification

### Overview

Prove the whole pipeline works with a real, low-risk change, and confirm the failure path behaves as decided (red job, no auto-rollback).

### Changes Required:

No file changes — this phase is a verification/rehearsal pass over Phases 1–2.

### Success Criteria:

#### Automated Verification:

- A push to `master` results in a `deploy` job that: waits for approval, then runs, then passes its health check.

#### Manual Verification:

- Approve a real deployment end-to-end and confirm the production URL reflects the deployed commit (e.g. via a harmless visible change, or by checking `wrangler deployments list` timestamps).
- Deliberately verify the failure path is understood: if the health check were to fail, the `deploy` job goes red and no automatic `wrangler rollback` runs — confirm this matches the team's expectation that rollback stays a manual, deliberate action (per `context/foundation/infrastructure.md`'s rollback caveat about Supabase migrations/secrets not being reverted).

---

## Testing Strategy

### Integration Tests:

- End-to-end: push to `master` → CI passes → approval requested → approve → deploy → health check passes.

### Manual Testing Steps:

1. Push a trivial commit to `master`.
2. Confirm the `deploy` job is listed as "Waiting" in the Actions run.
3. Approve the deployment as the reviewer.
4. Confirm `wrangler deploy` step succeeds and the health-check step passes.
5. Open `https://trip-planner.kamil-ismail.workers.dev/` in a browser and confirm the app loads.

## Performance Considerations

None — this is a CI/CD configuration change with no runtime code paths affected.

## Migration Notes

Not applicable — no data migration involved.

## References

- Roadmap entry: `context/foundation/roadmap.md` (F-02: production-deploy-pipeline)
- Infra research: `context/foundation/infrastructure.md`
- Existing workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Cloudflare config: [wrangler.jsonc](wrangler.jsonc), [astro.config.mjs](astro.config.mjs)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: External prerequisites (Cloudflare token + GitHub Environment)

#### Manual

- [x] 1.1 CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are present as secrets on the GitHub production Environment (or repo-level) — 1213d8f
- [x] 1.2 The production Environment has a required-reviewer protection rule configured — 1213d8f
- [x] 1.3 wrangler secret list confirms SUPABASE_URL and SUPABASE_KEY already exist as production Workers Secrets — 1213d8f

### Phase 2: `deploy` job in CI workflow

#### Automated

- [x] 2.1 deploy job appears in the Actions run for a push to master, pending approval, once ci and smoke are both green — 53548e7
- [x] 2.2 After approval, npm run build step in the deploy job succeeds — 53548e7
- [x] 2.3 Health-check step exits 0 when the production URL is reachable — 53548e7

#### Manual

- [x] 2.4 Approving the deployment in the GitHub UI is required before wrangler deploy runs — 53548e7
- [x] 2.5 A pull-request run of the same workflow does NOT create a pending deploy approval — 53548e7

### Phase 3: End-to-end verification

#### Automated

- [x] 3.1 A push to master results in a deploy job that waits for approval, then runs, then passes its health check

#### Manual

- [x] 3.2 Approve a real deployment end-to-end and confirm the production URL reflects the deployed commit
- [x] 3.3 Confirm the failure path (red job, no auto-rollback) matches expectations

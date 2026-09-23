---
project: trip-planner
researched_at: 2026-09-23
recommended_platform: Cloudflare Workers/Pages
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript/JavaScript
  framework: Astro 7 (SSR) + React 19
  runtime: Cloudflare Workers (workerd), via @astrojs/cloudflare
---

## Recommendation

**Deploy on Cloudflare Workers/Pages.**

The app already ships with the `@astrojs/cloudflare` adapter, so this is a zero-migration deployment target — no adapter swap, no Dockerfile. It scored highest on all five agent-friendly criteria (CLI-first `wrangler`, fully managed/serverless, agent-readable docs via `llms.txt`, a GA scriptable deploy/rollback API, and a GA MCP server), and at the project's low-QPS/small-scale traffic (per `prd.md`: small user base, single named user for MVP) it fits comfortably inside Cloudflare's free tier — $0/month — directly matching the interview's cost-minimizing priority. No persistent-connection requirement was identified (interview Q1: "Nie"), so Workers' request/response model is not a limiting factor.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent docs | Stable deploy API | MCP/integration | Total |
|---|---|---|---|---|---|---|
| **Cloudflare Workers/Pages** | Pass | Pass | Pass | Pass | Pass | **10** |
| Vercel | Pass | Pass | Pass | Pass | Partial (beta) | 9 |
| Netlify | Partial | Pass | Pass | Partial | Pass | 8 |
| Fly.io | Pass | Partial | Pass | Pass | Partial (beta) | 8 |
| Railway | Partial | Partial | Pass | Pass | Pass (caveat) | 8 |
| Render | Partial | Partial | Fail | Partial | Partial (early access) | 4 |

**Cloudflare Workers/Pages** — `wrangler deploy`/`rollback`/`tail` are all GA and non-interactive. Docs are published as markdown and `llms.txt`. Free tier covers 100k requests/day (well beyond this app's expected traffic); paid tier is $5/mo minimum only if exceeded. Official Cloudflare API MCP server is GA. Already the installed SSR adapter — no migration cost.

**Vercel** — Excellent Astro-native DX via `@astrojs/vercel`, GA CLI with rollback and rebuilt log tooling. However, the Hobby (free) tier's terms explicitly disallow commercial use, forcing the $20/mo Pro tier for a production app — conflicting with the stated cost-minimizing priority. Vercel MCP is public beta and read-only. Requires an adapter swap from `@astrojs/cloudflare`.

**Netlify** — Strong runner-up: likely free at this traffic (125k function invocations/mo on the free tier), and Netlify publishes an official GA MCP server (`netlify/netlify-mcp`) that's more mature than Cloudflare's for deploy-specific operations. Weaknesses: no dedicated CLI rollback subcommand (dashboard/audit-log only), `netlify deploy` creates a draft by default (needs explicit `--prod`), and it requires migrating off `@astrojs/cloudflare` to `@astrojs/netlify`.

### Shortlisted Platforms

#### 1. Cloudflare Workers/Pages (Recommended)

Highest score across all five criteria, zero migration cost since it's already the project's adapter, and the only option that's both free at this scale and has a mature GA MCP server. The main friction points (Node API compatibility gaps, secrets configuration) are known and documented, not open-ended risks.

#### 2. Netlify

Comparable free-tier economics and a more deploy-focused GA MCP server, but requires switching the SSR adapter and lacks a first-class CLI rollback command — a meaningful gap for an agent that needs to recover from a bad deploy without touching a dashboard.

#### 3. Vercel

Best-in-class DX and first-party Astro support, but the free tier's non-commercial restriction forces a $20/mo minimum spend, directly conflicting with the interview's cost-minimizing priority. Also requires an adapter migration.

## Anti-Bias Cross-Check: Cloudflare Workers/Pages

### Devil's Advocate — Weaknesses

1. **`astro:env` secrets friction**: Astro's server-side env var handling needs an additional, easy-to-miss compatibility flag (`nodejs_compat_populate_process_env`) beyond the standard `nodejs_compat` flag — a known open issue ([withastro/astro#13503](https://github.com/withastro/astro/issues/13503)). Missing it causes Supabase/Gemini keys to silently read as `undefined` in production while working locally.
2. **Not full Node.js**: `nodejs_compat` polyfills most but not all Node APIs. The Supabase JS SDK or Google Gemini SDK could hit an unsupported code path only under specific runtime conditions, surfacing as a production-only 500 error that doesn't reproduce locally.
3. **Subrequest limits on the free tier**: 50 external subrequests per request on the free plan. A single itinerary-generation flow (auth check + Supabase read + Gemini call + Supabase write) uses several; a feature that fans out further later (e.g., multiple AI calls per plan) could hit this ceiling before the team notices they need the paid tier.
4. **CPU-time billing model is unintuitive**: Workers bill CPU time, not wall-clock time, so slow I/O (waiting on Gemini) is nearly free — but this distinction is easy to reason about incorrectly, and any synchronous JSON processing of large itinerary payloads does count against the limit.
5. **Workerd-specific lock-in**: If TripPlanner later adds realtime features (currently `has_realtime: false` per tech-stack.md, but could change), Durable Objects/WebSocket Hibernation patterns are Cloudflare-specific — migrating off Cloudflare later would require rearchitecting that piece.

### Pre-Mortem — How This Could Fail

The team deployed TripPlanner's Astro SSR app to Cloudflare Workers, assuming the existing `@astrojs/cloudflare` adapter "just works" for the whole stack. Supabase auth cookies and the Gemini SDK worked fine in local `wrangler dev`, so nobody stress-tested `nodejs_compat` edge cases against production traffic. Three months in, a code path inside the Supabase JS client hit an unsupported Node API only under a specific request pattern, producing an opaque 500 error that reproduced only in production, since workerd's polyfills silently diverged from real Node behavior there. Debugging burned a week because the team hadn't budgeted time to read the `nodejs_compat` caveats doc. Meanwhile, they'd underestimated how many subrequests a single itinerary-generation call made, tripping the free-tier subrequest ceiling for longer, multi-day itineraries — degrading reliability exactly when early users tried the app's most compelling use case. No one had been assigned to watch Workers analytics, so the degraded requests went unnoticed for days.

### Unknown Unknowns

- `wrangler dev` (even with `--remote`) doesn't perfectly emulate every polyfilled Node API's production behavior — some bugs only appear after a real deploy.
- Cloudflare Pages preview/branch deployments scope secrets separately from production; a secret set for production doesn't automatically appear in PR previews unless explicitly configured, which can silently break Gemini-dependent features in preview URLs.
- `wrangler rollback` reverts the deployed code but not any bound resource or config changes — a rollback after a breaking Supabase migration would not undo the database side.
- The free-tier CPU limit (10ms/request) is much tighter than the paid tier's default (30s); if the team stays on the free plan and later adds any synchronous processing of AI responses, they may hit CPU limits well before hitting request-count limits.
- Cloudflare's Workers/Pages product lines are actively converging (Pages Functions now bill against Workers limits) — documentation and tooling written before this convergence may describe deprecated behavior.

## Operational Story

- **Preview deploys**: Cloudflare Pages generates a preview URL per branch/PR automatically on push; no extra setup required. Preview deployments use their own secrets scope, so production secrets must be explicitly mirrored to preview if AI/auth features need to work there.
- **Secrets**: `SUPABASE_URL`, `SUPABASE_KEY`, and the Gemini API key live in `.dev.vars` locally (gitignored) and as Cloudflare Workers Secrets in production, set via `wrangler secret put <NAME>` or the dashboard. Only project collaborators with Cloudflare account access can read them; rotation is a `wrangler secret put` overwrite followed by a redeploy.
- **Rollback**: `wrangler rollback [deployment-id]` reverts to a prior deployment in seconds. It does not revert Supabase schema migrations or Workers Secrets changes — those must be reverted manually if a bad deploy included them.
- **Approval**: Routine deploys (`wrangler deploy` to preview/staging) may run unattended by an agent. Production promotion, secret rotation, and any destructive action (dropping a Supabase table, deleting the Workers project) require a human in the loop, per this project's manual-promotion CI flow (`ci_default_flow: manual-promotion` in tech-stack.md).
- **Logs**: `wrangler tail` streams live production logs; `wrangler deployments list` / `wrangler deployments view <id>` show deployment history read-only. No dashboard access needed for routine log inspection.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| `astro:env` secrets silently undefined in production due to missing `nodejs_compat_populate_process_env` flag | Devil's advocate | M | H | Set both compatibility flags explicitly in `wrangler.toml`/`astro.config.mjs`; add a startup check that fails loudly if required env vars are missing. |
| Supabase or Gemini SDK hits an unsupported Node API only in production | Devil's advocate / Pre-mortem | L | M | Test the full auth + Gemini call path against a deployed preview (not just local `wrangler dev`) before promoting to production. |
| Free-tier subrequest ceiling (50/request) hit as itinerary generation fans out to more calls | Devil's advocate / Pre-mortem | L | M | Monitor subrequest count per request via Workers analytics; budget for the $5/mo paid tier (10M subrequests) if usage grows past a handful of users. |
| CPU-time limits misunderstood, causing throttling on synchronous itinerary-response processing | Devil's advocate | L | L | Keep response transformation logic minimal and async; watch CPU-time metrics in the Cloudflare dashboard during early usage. |
| Preview deployments silently fail on AI features due to secrets not mirrored from production | Unknown unknowns | M | L | Document the preview-secrets step in the project's deploy runbook; verify a PR preview end-to-end before relying on it for review. |
| Rollback doesn't revert Supabase migrations or secret changes | Unknown unknowns | L | M | Treat DB migrations and secret rotations as separate, manually-reverted steps in the deploy runbook — never assume `wrangler rollback` alone is sufficient after a schema change. |

## Getting Started

1. Confirm the installed `@astrojs/cloudflare` adapter version and `wrangler` version match current docs (`npx astro info`, `npx wrangler --version`) before following any tutorial, since Astro/Cloudflare tooling changes fast.
2. Set both `nodejs_compat` and `nodejs_compat_populate_process_env` compatibility flags in `wrangler.toml` so `astro:env` server secrets resolve correctly.
3. Create Workers Secrets for production: `npx wrangler secret put SUPABASE_URL`, `npx wrangler secret put SUPABASE_KEY`, and the Gemini API key variable — mirror the same names used in `.dev.vars`.
4. Deploy with `npm run build && npx wrangler deploy`; verify with `npx wrangler tail` while exercising the sign-up/sign-in and itinerary-generation flows end to end.
5. Confirm PR preview deployments have the same secrets mirrored (Cloudflare Pages project settings → preview environment variables) before relying on preview URLs for review.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)

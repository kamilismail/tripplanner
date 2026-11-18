# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-11-18

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic check that already catches the
   regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `scripts/`,
`supabase/migrations/` (excluded: dist, coverage, fixtures, package-lock.json,
`src/db/database.types.ts`, `context/`, `.claude/`). Only 6 commits in scope
over 30 days — git signal is weak; likelihood ratings rely mainly on the
interview and the PRD.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. The Source column cites the evidence that
surfaced each risk, never a code location.

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|------------|--------------------------------|
| 1 | Gemini is unavailable, returns "busy", an empty or malformed JSON, and the user sees a silent failure or an empty plan | High | High | interview Q1, interview Q2 (early "busy" responses), PRD FR-003, PRD guardrail "visible feedback while waiting" |
| 2 | An accepted plan is not saved to the database, is saved partially, or is overwritten | High | Medium | interview Q1, PRD guardrail "never silently lost or overwritten", PRD US-01 |
| 3 | A user sees or modifies another user's trips (ownership not enforced) | High | Medium | interview Q1, PRD guardrail "data isolation", hot-spot dir `src/pages/api` (5 commits/30d) |
| 4 | An unauthenticated user reaches protected routes, or a signed-in user is wrongly logged out | High | Medium | PRD FR-001, hot-spot `src/middleware.ts` (3 commits/30d), hot-spot dir `src/components/auth` (18 commits/30d — churn caused by returning to the project, not by a problem area; interview Q3) |
| 5 | Free-text city input reaches the AI prompt without server-side validation, and the number of Gemini calls is not limited (abuse, cost) | Medium | Medium | PRD FR-002 (free text), tech-stack `has_ai: true` |
| 6 | Secrets (Gemini key, Supabase keys) or personal data leak into logs, error bodies or the frontend bundle | High | Low | tech-stack (server-only secrets), PRD FR-001 |

Interview Q3 also shows a general lack of confidence on every change, verified
today only by manual checks — a project-wide absence of a safety net, not a
single area.

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | On "busy", empty and malformed Gemini responses the user gets a clear error or a valid plan after retry, and nothing is persisted | "It works after a few retries" does not mean retry exhaustion is handled | Gemini call boundary, retry policy, response-shape validation, error translation to the client | integration with a stubbed Gemini client | A stub that always returns valid JSON (happy path only) |
| #2 | After acceptance the plan is in the database with the right number of days and points, and a mid-write failure leaves no partial data | "HTTP 200" does not mean rows exist | Save path, transactionality, Supabase error handling, what "overwrite" means here | integration against local Supabase | Expected values copied from production code (oracle problem) |
| #3 | User B cannot read, change or delete user A's plan, even knowing its identifier | "Signed in" does not mean "owner" | RLS policies, API routes touching trips, how the user id reaches queries | integration against local Supabase with two accounts | A test with only one account |
| #4 | No session means redirect from protected routes; a valid session is not rejected | A green sign-in smoke does not prove route protection | Protected-route list, session handling in middleware | extend existing `smoke`; integration if cheaper | A test that mirrors the route list from code |
| #5 | Oversized or odd city input is rejected server-side; excess Gemini calls are limited | Client-side form validation does not replace server validation | Server input schema, any call-rate limit | unit/integration on the route | Testing client-side validation only |
| #6 | The built bundle and error responses contain no secrets | "Secrets live in server-only env" does not prove they never leak | Env configuration, error body content, bundle output | bundle scan in CI | Manual "I looked, there's nothing" |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Test runner + Gemini boundary | Set up the test runner; prove Gemini failures end in a clear error, not a silent break | #1 | integration (stubbed Gemini client) | planned | context/changes/testing-gemini-boundary/ |
| 2 | Plan persistence | Prove an accepted plan lands in the database whole and is never overwritten | #2 | integration (local Supabase) | not started | — |
| 3 | Data isolation, auth and abuse | Prove account B cannot touch account A's plans, routes are protected, input is validated | #3, #4, #5 | integration, extended smoke | not started | — |
| 4 | Quality-gates wiring | Lock the floor: tests in CI and pre-commit, secret check on the bundle | #6 + hardening of #1–#5 | gates | not started | — |

An AI-native layer is deliberately not included: deterministic tests give
enough signal for these risks, and a vision model would add none.

## 4. Stack

Detected state: **none** — no test runner config and no application test
files. The only check is `npm run smoke` (sign-in flow, `scripts/smoke.mjs`).
The `.claude/skills/*` tests do not cover the application.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | none yet — see §3 Phase 1 | — | Runner choice made in Phase 1 research (Astro + Cloudflare workerd runtime) |
| API mocking | none yet — see §3 Phase 1 | — | Only at the Gemini network edge |
| database integration | local Supabase (`npx supabase start`) | — | Needs Docker; already used by CI smoke job |
| e2e | none yet | — | Not planned; integration and `smoke` are cheaper |
| smoke | `scripts/smoke.mjs` (`npm run smoke`) | — | Auth flow only |
| lint | ESLint + `lint:ui` | — | Pre-commit via husky + lint-staged |

**Stack grounding tools (current session):**
- Docs: none (Context7 / framework docs MCP not available in current session); checked: 2026-11-18
- Search: none (Exa.ai not available in current session); checked: 2026-11-18
- Runtime/browser: built-in browser pane (Claude_Browser) — not used; checked: 2026-11-18
- Provider/platform: none relevant exposed (Supabase/Cloudflare MCP not available in current session); checked: 2026-11-18

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck | local + CI | required (already wired) | syntactic / type drift |
| UI literal scan (`lint:ui`) | pre-commit | required (already wired) | design-token violations |
| auth smoke (`npm run smoke`) | CI | required (already wired) | broken sign-in flow |
| unit + integration | local + CI | required after §3 Phase 1 | logic regressions |
| data isolation + persistence tests | CI | required after §3 Phase 3 | cross-user access, lost plans |
| tests in pre-commit | local | recommended after §3 Phase 4 | regressions before commit |
| bundle secret scan | CI | required after §3 Phase 4 | secret leakage |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, it reads "TBD".

### 6.1 Adding a unit test

- TBD — see §3 Phase 1 (runner setup and location convention).

### 6.2 Adding an integration test

- TBD — see §3 Phase 1 for the Gemini-failure pattern (busy / empty / malformed
  response) and §3 Phase 2 for the persistence pattern against local Supabase.

### 6.3 Adding an e2e test

- Not planned. Prefer integration or extending `smoke`. Revisit if a failure
  mode requires the full deployed shape.

### 6.4 Adding a test for a new API endpoint

- TBD — see §3 Phase 3 (ownership/authorization pattern with two accounts).

### 6.5 Adding a test for AI-response handling

- TBD — see §3 Phase 1 (stubbed Gemini client; expected values from the
  contract, not copied from implementation).

### 6.6 Per-rollout-phase notes

(Optional. Appended after each phase lands.)

## 7. What We Deliberately Don't Test

- **UI appearance and styling** — visual state is already guarded by
  `lint:ui` and `/dev/kitchen-sink`. Re-evaluate if the design-token
  contract is dropped. (Source: Phase 2 interview Q5.)
- **shadcn/ui components in `src/components/ui`** — third-party library
  code; the library is its own test. Re-evaluate if components are
  heavily customized. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-11-18
- Stack versions last verified: 2026-11-18
- AI-native tool references last verified: 2026-11-18 (none used)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.

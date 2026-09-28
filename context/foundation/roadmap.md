---
project: "TripPlanner"
version: 1
status: draft
created: 2026-09-26
updated: 2026-09-28
prd_version: 1
main_goal: speed
top_blocker: capacity
milestone_id: first-usable-trip-plan
milestone_seq: 1
milestone_status: open
---

# Roadmap: TripPlanner

> Derived from `context/foundation/prd.md` (v1) + `context/foundation/tech-stack.md` +
> `context/foundation/infrastructure.md` + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: First usable trip-plan flow** — Status: open

- **Intent:** Prove the core hypothesis — that a city + day-count input can return an AI-generated, day-grouped itinerary the builder actually wants to save and reuse — while shipping the must-have generate/accept/save/list loop before the 2026-12-06 hard deadline.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** FR-001 through FR-010, US-01, the full `## Success Criteria` and `## Non-Functional Requirements` sections of the PRD.

## Vision recap

A traveler planning a trip knows the destination and day count, but turning that into a concrete sightseeing plan today means manually searching blogs and "top things to see" lists and assembling them into a day-by-day itinerary by hand. TripPlanner removes that synthesis step: the user supplies a city and a day count and gets back an already day-grouped, editable plan. The first (and for MVP, only) user is the builder themself.

## North star

**S-01: User generates and saves a trip plan** — this is the PRD's Primary Success Criterion and its only drafted user story (US-01); nothing else in the roadmap validates the core hypothesis if this doesn't work.

> A reader-facing note on what "north star" means here: the smallest end-to-end slice whose successful delivery proves the core product hypothesis — sequenced as early as its prerequisites allow, since everything else only matters if this works.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
| --- | --- | --- | --- | --- | --- |
| F-01 | trip-data-schema | (foundation) minimal `trips` + `trip_points` schema exists, with per-user RLS policies | — | Access Control, FR-005, FR-006 | done |
| F-02 | production-deploy-pipeline | (foundation) `wrangler deploy` wired into CI/CD with secrets configured so the app is actually publicly reachable | — | FR-001 (Socrates rationale) | done |
| S-01 | generate-and-save-trip-plan | user enters a city + day count, reviews an AI-generated day-grouped plan, accepts it, and sees it in their trip panel | F-01 | US-01, FR-001, FR-002, FR-003, FR-004, FR-005, FR-006 | done |
| S-02 | edit-trip-points | user adds their own sightseeing points to a saved trip and edits existing points | S-01 | FR-007, FR-008 | proposed |
| S-03 | delete-trip-points-and-trips | user deletes a single point from a saved trip, or deletes an entire saved trip | S-01 | FR-009, FR-010 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
| --- | --- | --- | --- |
| A | Generate, save, and edit the itinerary | `F-01` → `S-01` → `S-02` | Core must-have path plus its natural nice-to-have follow-on; sequenced first per `main_goal: speed`. |
| B | Getting the app live | `F-02` | Standalone — no roadmap item depends on it, but it doesn't depend on anything either, so it can run fully in parallel with Stream A. |
| C | Trip and point cleanup | `S-03` | Joins Stream A at `S-01`; independent of Stream A's `S-02` branch, so it can run in parallel with it. |

## Baseline

What's already in place in the codebase as of `2026-09-26` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** partial — Astro + React + Tailwind + shadcn/ui configured (`components.json`), only the `Button` component generated so far (`src/components/ui/button.tsx`); no trip-list or plan-generation pages exist yet.
- **Backend / API:** partial — Astro API route convention established (`src/pages/api/auth/*.ts`); no trip/plan/itinerary endpoints exist, no Gemini SDK wired in.
- **Data:** partial — Supabase client wired (`src/lib/supabase.ts`); no migrations, no tables, no seed data.
- **Auth:** present — Supabase Auth fully wired (signin/signup/signout API routes, `src/middleware.ts` protecting `/dashboard`).
- **Deploy / infra:** partial — Cloudflare adapter + `wrangler.jsonc` configured; CI (`.github/workflows/ci.yml`) runs lint/build/smoke but has no actual deploy step.
- **Observability:** absent — no logging library, no error tracking; only Cloudflare's built-in request analytics (not code-level instrumentation).

## Foundations

### F-01: Minimal trip data schema

- **Outcome:** (foundation) A `trips` table and a `trip_points` (or equivalent) table exist in Supabase, with RLS policies scoped per-user for every operation, so trip data can be persisted and is isolated between users.
- **Change ID:** trip-data-schema
- **PRD refs:** Access Control ("each authenticated user sees and edits only their own saved trips"), FR-005, FR-006
- **Unlocks:** S-01 (needs somewhere to save an accepted plan), S-02, S-03 (both mutate the same tables)
- **Prerequisites:** —
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Schema and RLS choices here are load-bearing for every downstream trip feature — getting per-user isolation right the first time matters more than speed, since S-01 can't be planned without a persistence target.
- **Status:** done

### F-02: Production deploy pipeline

- **Outcome:** (foundation) `wrangler deploy` runs as a real step (manual-promotion, per `ci_default_flow`) with production secrets (`SUPABASE_URL`, `SUPABASE_KEY`, Gemini key) configured, so the app is actually publicly reachable rather than only running locally.
- **Change ID:** production-deploy-pipeline
- **PRD refs:** FR-001 (Socrates rationale: "the app is deployed publicly-reachable, so access control is needed from the start")
- **Unlocks:** every slice becomes genuinely usable/demoable in production; reduces the infra risk register's `nodejs_compat` / secrets-configuration unknowns before they hit during the November crunch
- **Prerequisites:** Cloudflare account + `wrangler` auth (external state)
- **Parallel with:** F-01, S-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** `top_blocker` is capacity (an October gap before an intensive November) — wiring the real deploy step now, in parallel with S-01, surfaces `nodejs_compat`/secrets surprises while there's still slack to debug them, instead of during the pre-deadline crunch.
- **Status:** done

## Slices

### S-01: User generates and saves a trip plan

- **Outcome:** user can enter a city and a number of days, review an AI-generated day-grouped plan, accept it, and see it in their trip panel.
- **Change ID:** generate-and-save-trip-plan
- **PRD refs:** US-01, FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
- **Prerequisites:** F-01
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the north star and the largest slice by must-have FR count (six of them) — the main risk is scope creep into the nice-to-have editing/deletion features during implementation, which the tight after-hours schedule can't absorb.
- **Status:** done

### S-02: User edits an accepted plan's points

- **Outcome:** user can add their own sightseeing points to a saved trip and edit existing points.
- **Change ID:** edit-trip-points
- **PRD refs:** FR-007, FR-008
- **Prerequisites:** S-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Nice-to-have and additive to S-01's data model — safe to build in parallel with S-03 or defer past it without threatening the MVP demo.
- **Status:** proposed

### S-03: User deletes points and trips

- **Outcome:** user can delete a single point from a saved trip, or delete an entire saved trip.
- **Change ID:** delete-trip-points-and-trips
- **PRD refs:** FR-009, FR-010
- **Prerequisites:** S-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Needs a confirmation step to respect the "an accepted, saved plan is never silently lost" guardrail, but as nice-to-have work it can slip past the November crunch without blocking the MVP.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
| --- | --- | --- | --- | --- |
| F-01 | trip-data-schema | Add trips/trip_points schema with per-user RLS | yes | Run `/10x-plan trip-data-schema` |
| F-02 | production-deploy-pipeline | Wire real `wrangler deploy` step with production secrets | yes | Run `/10x-plan production-deploy-pipeline` |
| S-01 | generate-and-save-trip-plan | Generate, review, accept, and save a trip plan | no | Blocked on F-01 landing first |
| S-02 | edit-trip-points | Add and edit points on a saved trip | no | Blocked on S-01 landing first |
| S-03 | delete-trip-points-and-trips | Delete a point or an entire saved trip | no | Blocked on S-01 landing first |

This table is the clean handoff to Jira/Linear or any MCP-backed backlog. Include one row for every `F-NN` and `S-NN`. It should be compact enough to copy into issues, but it must not duplicate the detailed roadmap body.

## Open Roadmap Questions

_None — the PRD reports no open questions (quality cross-check: accepted), and the interview surfaced no new cross-slice question._

## Parked

- **Custom recommendation/ranking algorithm** — Why parked: PRD Non-Goal; itinerary generation relies entirely on an external AI service, no home-grown scoring model.
- **Booking or payment integrations** — Why parked: PRD Non-Goal; the product plans sightseeing only.
- **Shared or multi-user trips** — Why parked: PRD Non-Goal; each saved trip belongs to exactly one user, no collaboration/sharing.
- **Mobile or native app** — Why parked: PRD Non-Goal; MVP targets desktop browsers only.

## Milestone History

_Empty — this is the first milestone._

## Done

- **F-01: (foundation) minimal `trips` + `trip_points` schema exists, with per-user RLS policies** — Archived 2026-09-26 → `context/archive/2026-09-26-trip-data-schema/`. Lesson: —.
- **F-02: (foundation) `wrangler deploy` wired into CI/CD with secrets configured so the app is actually publicly reachable** — Archived 2026-09-26 → `context/archive/2026-09-26-production-deploy-pipeline/`. Lesson: —.
- **S-01: user can enter a city and a number of days, review an AI-generated day-grouped plan, accept it, and see it in their trip panel.** — Archived 2026-09-28 → `context/archive/2026-09-26-generate-and-save-trip-plan/`. Lesson: —.

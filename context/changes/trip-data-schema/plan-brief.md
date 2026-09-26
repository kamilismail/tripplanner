# Trip Data Schema — Plan Brief

> Full plan: `context/changes/trip-data-schema/plan.md`

## What & Why

Add the foundation persistence layer for TripPlanner: `trips` and `trip_points` tables in Supabase with per-user RLS. This is roadmap item F-01 — a schema-only foundation slice that unblocks every downstream trip feature (generate/save, edit, delete), none of which can be planned without a persistence target.

## Starting Point

The repo is a freshly scaffolded Astro + Supabase starter with auth fully wired but no `supabase/migrations/` directory, no `src/types.ts`, and no domain code referencing trips or itineraries anywhere — this is a from-scratch design constrained only by CLAUDE.md's migration-naming and RLS conventions.

## Desired End State

A single migration creates both tables with RLS enabled and granular per-operation policies enforcing per-user isolation. A committed, generated types file gives `src/types.ts` compiler-checked `Trip`/`TripPoint` domain types that future slices (S-01/S-02/S-03) can import directly.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Day representation | Integer `day_number` (1-based) | Matches PRD's "city + day count" framing; no calendar dates in any FR | Plan |
| RLS ownership on trip_points | Denormalized `user_id`, trigger-synced from parent trip | Flat `auth.uid() = user_id` predicate on every policy, no join/subquery, and a trigger prevents drift from a mismatched caller-supplied value | Plan |
| Trip point fields | `name`, `description`, `day_number`, `order_index`, plus nullable `latitude`/`longitude` | Covers FR-002/003/007/008 now, avoids a second migration if a map view is added later | Plan |
| Delete behavior | `ON DELETE CASCADE` from trips to trip_points | Matches S-03's eventual "delete an entire saved trip" (FR-010) with no orphan cleanup logic needed | Plan |
| Type strategy | Generate Supabase types (`npm run gen:types`) + derive `src/types.ts` from them | Downstream slices get compiler-checked contracts instead of hand-duplicated interfaces that can drift | Plan |

## Scope

**In scope:**
- `trips` and `trip_points` tables, constraints, indexes
- Per-operation, per-role RLS policies on both tables
- Ownership-sync trigger on `trip_points`
- Supabase type generation script + committed generated types
- `src/types.ts` domain type exports

**Out of scope:**
- Any API routes or UI (belongs to S-01/S-02/S-03)
- Seed data / `seed.sql`
- Geocoding or map integration
- Soft-delete or audit trail
- `updated_at` tracking on `trips`

## Architecture / Approach

Two normalized tables, both directly owned by `auth.users`. `trip_points` carries its own denormalized `user_id` (kept correct by a `BEFORE INSERT/UPDATE` trigger deriving it from the parent trip) so every RLS policy stays a simple flat predicate rather than a join back to `trips`. Cascading delete removes a trip's points in one statement.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Database migration | `trips` + `trip_points` tables with RLS and ownership trigger | Per-user isolation is load-bearing for every downstream feature — must be verified with two real test users, not just schema inspection |
| 2. TypeScript types | Generated Supabase types + `src/types.ts` domain exports | Requires local Supabase running to generate; risk is low since it's mechanical codegen |

**Prerequisites:** None — first change to touch the database in this project.
**Estimated effort:** Small — a single migration file and a types file; roughly one focused session across both phases.

## Open Risks & Assumptions

- Assumes the deployed/CI `SUPABASE_KEY` is genuinely the anon key (not service_role) — if it's actually service_role, RLS would be bypassed for all app requests. Worth a one-time confirmation outside this change, since `src/lib/supabase.ts` gives no indication either way.
- No `seed.sql` exists despite `supabase/config.toml` referencing it — pre-existing starter drift, left untouched per this change's scope.

## Success Criteria (Summary)

- A local Supabase instance can apply the migration cleanly and shows RLS enabled on both tables.
- Two different test users are structurally unable to see or mutate each other's trips/points.
- `Trip`/`TripPoint` types are importable from `src/types.ts` and type-check cleanly.

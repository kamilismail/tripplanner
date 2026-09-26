# Trip Data Schema Implementation Plan

## Overview

Add the foundation persistence layer for TripPlanner: a `trips` table and a `trip_points` table in Supabase, with granular per-operation RLS policies so each authenticated user can only ever see or mutate their own trips and points. This is roadmap item **F-01** — a schema-only foundation slice with no UI or API endpoints. It unblocks S-01 (generate-and-save-trip-plan), S-02 (edit-trip-points), and S-03 (delete-trip-points-and-trips), none of which can be planned until a persistence target exists.

## Current State Analysis

The repository is a freshly scaffolded 10x Astro Starter (Astro 7 SSR + React 19 + Supabase + Cloudflare Workers). Supabase auth is fully wired (`src/lib/supabase.ts`, `src/middleware.ts`), but nothing else related to trip data exists yet:

- `supabase/` has a `config.toml` (Postgres 17 locally) but **no `supabase/migrations/` directory at all**, and no `seed.sql` (referenced by `config.toml` but absent from disk).
- No `src/types.ts` exists yet, despite CLAUDE.md prescribing it for shared entity/DTO types.
- No generated Supabase types file exists anywhere in the repo.
- No code anywhere references `trips`, `trip_points`, or any itinerary domain concept — this is a from-scratch design.
- The `supabase` CLI is already a `devDependency` (`^2.23.4`), so `npx supabase gen types typescript` is available but not yet wired into any npm script.
- `src/lib/supabase.ts:9` passes `SUPABASE_URL`/`SUPABASE_KEY` into `createServerClient` (the `@supabase/ssr` cookie-based pattern) for every request — there is no separate service-role client anywhere in the app. As long as the deployed `SUPABASE_KEY` is the anon key (not service_role), RLS policies on these new tables will be genuinely enforced for all of the app's own requests.

### Key Discoveries:

- CLAUDE.md (`## Key conventions`) requires: migrations named `supabase/migrations/YYYYMMDDHHmmss_short_description.sql`, RLS enabled on every new table with granular per-operation, per-role policies, and shared entity/DTO types in `src/types.ts`.
- The roadmap (`context/foundation/roadmap.md`, F-01) explicitly scopes this as schema-only: "a `trips` table and a `trip_points` (or equivalent) table exist in Supabase, with RLS policies scoped per-user for every operation." No UI or API surface is in scope here.
- PRD Access Control: "each authenticated user sees and edits only their own saved trips" — the single guardrail this schema must structurally guarantee.

## Desired End State

A migration file exists under `supabase/migrations/` that creates `trips` and `trip_points` with RLS enabled and per-operation, per-role policies enforcing per-user isolation. Applying the migration to a local Supabase instance succeeds cleanly. `src/types.ts` exports `Trip` and `TripPoint` domain types built on top of a generated `src/db/database.types.ts`, and a `supabase gen types typescript` npm script exists to regenerate that file after future migrations.

### Key Discoveries:
(see above — folded in to avoid duplication)

## What We're NOT Doing

- No API routes (`src/pages/api/trips/*` etc.) — those belong to S-01/S-02/S-03.
- No UI components or pages for trips/points.
- No `seed.sql` demo data — nothing in the PRD requires seeded trips, and the missing `seed.sql` referenced by `config.toml` is pre-existing starter drift, not something this change needs to fix.
- No geocoding, address lookup, or map integration beyond storing raw nullable lat/lng values.
- No soft-delete / audit trail — deletion (once S-03 lands) is a hard delete via `ON DELETE CASCADE`.
- No `updated_at` tracking on `trips` — trips are created once at acceptance time (FR-005) and never edited as a whole; only their points are (FR-008), which is out of scope for this foundation phase's data itself but the column exists for that future write path.

## Implementation Approach

Two tables, normalized, both owned directly by `auth.users` via a `user_id` column — including on `trip_points`, which gets its own denormalized `user_id` (kept in sync by a `BEFORE INSERT/UPDATE` trigger deriving it from the parent trip) rather than requiring every RLS policy to join back to `trips`. This keeps every policy predicate a flat `auth.uid() = user_id` check — simple, indexable, and impossible to accidentally get wrong per-operation. `trip_points.trip_id` cascades on delete so removing a trip removes its points in one statement.

Day grouping uses a plain 1-based `day_number` integer (matching the PRD's "city + day count" framing — no calendar dates anywhere in the FRs), plus an `order_index` for point ordering within a day. `latitude`/`longitude` are included now as nullable columns per the confirmed decision, even though no current reader/writer uses them yet.

Supabase type generation is wired up as a committed artifact (`src/db/database.types.ts`) via a new npm script, and `src/types.ts` derives `Trip`/`TripPoint` domain types from the generated row types — giving downstream slices compiler-checked contracts instead of hand-duplicated interfaces.

## Critical Implementation Details

**Trigger-derived `trip_points.user_id`**: Because `trip_points.user_id` is denormalized for RLS-policy simplicity, it must never be set independently by callers — a `BEFORE INSERT OR UPDATE` trigger sets `NEW.user_id := (SELECT user_id FROM trips WHERE id = NEW.trip_id)` unconditionally, overriding whatever the caller passed. This guarantees `trip_points.user_id` can never drift from its parent trip's owner, which a plain `NOT NULL` column alone would not guarantee.

## Phase 1: Database migration — trips & trip_points with RLS

### Overview

Create the two tables, their constraints, indexes, the ownership-sync trigger, and per-operation RLS policies in a single migration file.

### Changes Required:

#### 1. Migration file

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_trips_schema.sql` (timestamp assigned at implementation time per CLAUDE.md's naming convention — use the actual UTC time the file is created)

**Intent**: Define the `trips` and `trip_points` tables, enable RLS on both, and add per-operation (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) policies scoped to `auth.uid()`, so a user can never read or mutate another user's data at the database layer.

**Contract**:

- `trips`: `id uuid primary key default gen_random_uuid()`, `user_id uuid not null references auth.users(id) on delete cascade`, `city text not null`, `day_count integer not null check (day_count > 0)`, `created_at timestamptz not null default now()`.
- `trip_points`: `id uuid primary key default gen_random_uuid()`, `trip_id uuid not null references trips(id) on delete cascade`, `user_id uuid not null references auth.users(id) on delete cascade` (trigger-maintained, see Critical Implementation Details), `day_number integer not null check (day_number > 0)`, `order_index integer not null default 0`, `name text not null`, `description text`, `latitude numeric(9,6)`, `longitude numeric(9,6)`, `created_at timestamptz not null default now()`.
- Indexes: `trips(user_id)`, `trip_points(trip_id)`, `trip_points(user_id)`.
- Trigger: `BEFORE INSERT OR UPDATE ON trip_points FOR EACH ROW` calling a function that sets `NEW.user_id` from `trips.user_id` for `NEW.trip_id`.
- RLS: `ALTER TABLE trips ENABLE ROW LEVEL SECURITY;` and same for `trip_points`. Four policies per table (one per operation), each restricted to role `authenticated`, predicate `auth.uid() = user_id` (`USING` for select/update/delete, `WITH CHECK` for insert/update).

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against local Supabase: `npx supabase db reset` (or `npx supabase migration up` if a local stack is already running)
- `npm run lint` passes (no lint rules apply to `.sql`, but this catches any accidental non-SQL file changes)

#### Manual Verification:

- Inspect the local Postgres instance (`npx supabase status` for connection string, or Supabase Studio at the local URL) and confirm both tables exist with RLS enabled (`\d+ trips`, `\d+ trip_points` show `Row Security: true`).
- As two different authenticated test users (via `auth.users` rows created through Supabase Studio or the existing signup flow), confirm: user A can insert a trip + points for themselves; user B cannot see user A's rows via a `select * from trips` / `select * from trip_points` run as user B's JWT; inserting a `trip_points` row with a mismatched `user_id` results in the trigger overwriting it to the correct owner, not the caller-supplied value.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: TypeScript types

### Overview

Generate Supabase types against the new schema and expose `Trip`/`TripPoint` domain types through `src/types.ts`, per CLAUDE.md's shared-types convention.

### Changes Required:

#### 1. Type generation script

**File**: `package.json`

**Intent**: Add a repeatable way to regenerate Supabase's row types after this and future migrations, so downstream slices never hand-maintain a duplicate of the DB schema.

**Contract**: Add a `"gen:types"` script running `supabase gen types typescript --local > src/db/database.types.ts` (requires a locally running `supabase start`).

#### 2. Generated types file

**File**: `src/db/database.types.ts`

**Intent**: Committed output of `npm run gen:types`, run once against the Phase 1 migration, giving compiler-checked row types for `trips` and `trip_points`.

**Contract**: Standard Supabase CLI codegen output (a `Database` type with `public.Tables.trips.Row/Insert/Update` and `public.Tables.trip_points.Row/Insert/Update`). Generated mechanically — no hand-editing.

#### 3. Domain types

**File**: `src/types.ts` (new file)

**Intent**: Expose the app-facing `Trip` and `TripPoint` entity types that the rest of the codebase (future API routes, components) will import, derived from the generated row types rather than redeclared by hand.

**Contract**: `export type Trip = Database["public"]["Tables"]["trips"]["Row"];` and `export type TripPoint = Database["public"]["Tables"]["trip_points"]["Row"];`, importing `Database` from `@/db/database.types`.

### Success Criteria:

#### Automated Verification:

- Type generation succeeds: `npm run gen:types` (requires `npx supabase start` running locally)
- Type checking passes: `npx astro check` (or the project's equivalent typecheck step)
- Lint passes: `npm run lint`

#### Manual Verification:

- Open `src/db/database.types.ts` and confirm `trips` and `trip_points` both appear with the columns defined in Phase 1.
- Confirm `src/types.ts`'s `Trip`/`TripPoint` types are importable from another file without a TypeScript error (a scratch import is sufficient — no permanent test file needed for this foundation-only change).

---

## Testing Strategy

### Manual Testing Steps:

1. Run `npx supabase start` locally, apply the Phase 1 migration, and verify RLS isolation between two test users as described in Phase 1's Manual Verification.
2. Run `npm run gen:types` and confirm the generated file matches the migrated schema.
3. Import `Trip`/`TripPoint` from `src/types.ts` in a scratch file to confirm the type chain resolves end to end.

## Migration Notes

Not applicable — this is a brand-new schema with no existing data to migrate.

## References

- Roadmap: `context/foundation/roadmap.md` (F-01)
- PRD: `context/foundation/prd.md` (Access Control, FR-005, FR-006)
- CLAUDE.md `## Key conventions` (migration naming, RLS requirement, `src/types.ts` convention)
- Supabase client: `src/lib/supabase.ts:1-21`
- Middleware: `src/middleware.ts:1-24`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Database migration — trips & trip_points with RLS

#### Automated

- [x] 1.1 Migration applies cleanly against local Supabase
- [ ] 1.2 Lint passes

#### Manual

- [x] 1.3 Both tables exist with RLS enabled, verified via Supabase Studio/psql
- [x] 1.4 Cross-user isolation verified (user B cannot see user A's trips/points) and trigger-derived `user_id` verified on trip_points

### Phase 2: TypeScript types

#### Automated

- [ ] 2.1 Type generation succeeds
- [ ] 2.2 Type checking passes
- [ ] 2.3 Lint passes

#### Manual

- [ ] 2.4 Generated types file matches migrated schema
- [ ] 2.5 Trip/TripPoint types importable end to end

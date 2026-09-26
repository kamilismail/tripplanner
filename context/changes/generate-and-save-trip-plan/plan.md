# Generate and Save a Trip Plan Implementation Plan

## Overview

Implement the product's north-star slice (roadmap **S-01**): a logged-in user enters a city and a day count, the app calls Google Gemini to generate a day-grouped sightseeing itinerary, the user reviews it before it is persisted, accepts it, and immediately sees it in a trip panel. This covers all six must-have FRs still open for the MVP (FR-002 through FR-006; FR-001 auth is already implemented).

## Current State Analysis

The schema foundation (F-01) is already in place and the app is deployable (F-02), but nothing between "user is logged in" and "trip is saved" exists yet:

- `supabase/migrations/20260926141148_create_trips_schema.sql` already creates `trips` (`id`, `user_id`, `city`, `day_count`, `created_at`) and `trip_points` (`id`, `trip_id`, `user_id`, `day_number`, `order_index`, `name`, `description`, `latitude`, `longitude`, `created_at`) with per-operation RLS scoped to `auth.uid() = user_id`, plus a trigger that keeps `trip_points.user_id` in sync with its parent trip.
- [src/types.ts](../../../src/types.ts) already exports `Trip` and `TripPoint` domain types derived from the generated `src/db/database.types.ts`.
- No AI SDK or Gemini dependency exists in `package.json`, no `GEMINI_API_KEY` env var is declared in `astro.config.mjs`'s `env.schema`, and no code anywhere calls an external AI service.
- No `src/pages/api/trips/*` routes exist. The only API routes are `src/pages/api/auth/{signin,signup,signout}.ts`, which establish the project's route conventions (uppercase `POST` export, `astro:env/server` for secrets, `@/lib/supabase` for the SSR client).
- [src/middleware.ts](../../../src/middleware.ts) protects `/dashboard` via `PROTECTED_ROUTES`; no `/trips` or `/api/trips/*` path is protected yet.
- [src/pages/dashboard.astro](../../../src/pages/dashboard.astro) is the only authenticated page today — a static welcome card with a sign-out form. No trip list, no generation form.
- `src/components/ui/` has only `button.tsx` from shadcn/ui; no `Input`, `Card`, `Dialog`, `Skeleton`, or similar are installed yet.
- `src/lib/` has `supabase.ts`, `utils.ts`, `config-status.ts` — no `src/lib/services/` directory yet (CLAUDE.md convention: extracted business logic goes there).

### Key Discoveries:

- CLAUDE.md requires API routes to `export const prerender = false`, use uppercase `GET`/`POST` exports, and validate input with zod; services/business logic belong in `src/lib/` or `src/lib/services/`.
- `context/foundation/tech-stack.md` flags the Cloudflare Workers (`workerd`) edge runtime as a risk area for Node-oriented SDKs and for long-running tasks relative to the NFR that generation must show continuous feedback past ~2 seconds — this is why the Gemini call goes through plain `fetch()` rather than the `@google/genai` SDK (confirmed decision below).
- The `trip_points.user_id` trigger (see migration) means API code must never set `user_id` on insert — it is DB-derived and any caller-supplied value is overwritten, so the insert payload should simply omit it.
- Roadmap risk for S-01: "the main risk is scope creep into the nice-to-have editing/deletion features during implementation" — this plan explicitly excludes point editing (S-02) and deletion (S-03).

## Desired End State

A logged-in user can navigate to a trip-generation view, submit a city name and a day count (1–14), see a blocking loading state with status text while the server calls Gemini, then see a read-only review of the generated day-grouped plan with **Accept** and **Discard/regenerate** actions. Accepting saves the trip and its points to Supabase and redirects to (or refreshes) a trip panel that lists it first, newest first. A Gemini error, timeout, or invalid response surfaces a readable error message with a **Try again** action that preserves the submitted city/day count.

### Key Discoveries:
(see above — folded in to avoid duplication)

## What We're NOT Doing

- No editing of generated or saved points (FR-007/FR-008 — roadmap slice S-02).
- No deleting points or trips (FR-009/FR-010 — roadmap slice S-03).
- No server-side draft/pending persistence of an unaccepted plan — the generated-but-unsaved plan lives only in client React state until the user accepts it (confirmed decision below); a page refresh before accepting loses the unsaved plan, which is acceptable since PRD guardrails only protect *accepted* plans.
- No streaming of the Gemini response — a single request/response with a blocking loading state (confirmed decision below).
- No sorting/filtering UI on the trip panel beyond newest-first ordering — PRD explicitly defers this ("trip count is expected to be small in MVP").
- No changes to `src/pages/index.astro` or other landing-page content — out of scope for this slice per explicit user decision; tracked as a separate follow-up task.
- No automatic server-side retry of a failed Gemini call — a failed/invalid response returns an error to the client immediately; the user retries manually (confirmed decision below).
- No map or geocoding UI using `latitude`/`longitude` — those columns are populated opportunistically from Gemini's response (if valid) but nothing reads them yet.

## Implementation Approach

Five phases, each independently verifiable and roughly matching the dependency chain: a Gemini-calling service with a strict JSON contract, the three API routes that use it, the generation/review UI, the trip list UI, and an end-to-end pass.

**AI call**: `src/lib/services/gemini.ts` calls the Gemini REST API (`generativelanguage.googleapis.com`) directly via `fetch()` — no SDK — using `generationConfig.responseMimeType: "application/json"` and a `responseSchema` that constrains the model to `{ days: [{ day_number, points: [{ name, description?, latitude?, longitude? }] }] }`. The raw response is still validated against a zod schema server-side before use, since `responseSchema` constrains shape but not semantic correctness (e.g. an AI could still invent a non-existent place or use decimals outside a sane range).

**API surface**: three routes, following the existing `src/pages/api/auth/*.ts` conventions (uppercase exports, `prerender = false`, zod-validated bodies, `@/lib/supabase` for the per-request Supabase client):
- `POST /api/trips/generate` — takes `{ city, day_count }`, calls the Gemini service, returns the validated day-grouped plan (not yet persisted).
- `POST /api/trips` — takes the same plan shape (as reviewed/accepted by the user) plus `{ city, day_count }`, inserts one `trips` row and its `trip_points` rows, returns the created trip.
- `GET /api/trips` — returns the current user's trips (with their points), ordered `created_at DESC`, for the trip panel.

**UI**: a new authenticated page (e.g. `src/pages/trips.astro`, added to `PROTECTED_ROUTES`) hosts a React island that drives the two-step flow (form → loading → review → accept) and a separate list section for saved trips, reusing the `Button` component and adding the minimal shadcn/ui primitives needed (`Input`, plus a simple `Skeleton`/spinner) via `npx shadcn@latest add`.

## Phase 1: Gemini integration service

### Overview

A single server-side module that turns `(city, day_count)` into a validated, day-grouped itinerary, isolating the external-AI boundary so the API routes in Phase 2 never talk to Gemini directly.

### Changes Required:

#### 1. Add the `zod` dependency

**File**: `package.json`

**Intent**: `zod` is used by every subsequent file in this phase and in Phase 2, but is not yet a project dependency — no file in `src/` imports it today.

**Contract**: Run `npm install zod`, adding it to `dependencies` in `package.json` (and the resulting lockfile update).

#### 2. Gemini API key configuration

**File**: `astro.config.mjs`

**Intent**: Declare the Gemini API key as a server-only secret, following the existing pattern used for `SUPABASE_URL`/`SUPABASE_KEY`.

**Contract**: Add `GEMINI_API_KEY: envField.string({ context: "server", access: "secret", optional: true })` to `env.schema`. Add the same placeholder line to `.env.example` and note it for `.dev.vars` (Cloudflare local dev), matching how `SUPABASE_URL`/`SUPABASE_KEY` are documented today.

#### 3. Itinerary response schema (shared contract)

**File**: `src/lib/services/itinerary-schema.ts` (new file)

**Intent**: Define the single zod schema that both constrains what is requested from Gemini (converted to a Gemini `responseSchema` shape) and validates whatever comes back, so the "contract" is defined once and can't drift between request and response.

**Contract**: A zod object shape: `{ days: z.array(z.object({ day_number: z.number().int().min(1), points: z.array(z.object({ name: z.string().min(1), description: z.string().optional(), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional() })).min(1) })).min(1) }`, where `days.length` must equal the requested `day_count` and `day_number` values must be a 1..day_count permutation with no gaps or duplicates. Export both the zod schema and a plain-object Gemini `responseSchema` (Gemini's schema dialect: `type`/`properties`/`required`, no zod-specific keywords) built from the same field list so the two never diverge silently.

#### 4. Gemini service

**File**: `src/lib/services/gemini.ts` (new file)

**Intent**: Own the actual `fetch()` call to the Gemini REST endpoint, prompt construction, and response validation; return a typed result or throw a typed error the API route can map to a user-facing message.

**Contract**: `export async function generateItinerary(city: string, dayCount: number): Promise<ItineraryPlan>`. POSTs to `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`, passing the API key via the `x-goog-api-key` header (not a `?key=` query param, to avoid it leaking into logs/URLs). Builds a prompt embedding `city` and `dayCount`, with `generationConfig: { responseMimeType: "application/json", responseSchema }` and the `GEMINI_API_KEY` from `astro:env/server`. Before parsing, checks that `response.candidates?.[0]?.content?.parts?.[0]?.text` actually exists (Gemini can return HTTP 200 with an empty/absent `candidates` array — e.g. a safety-filter block with `promptFeedback.blockReason` set, or a candidate whose `finishReason` is `"SAFETY"`/`"RECITATION"`/`"OTHER"` instead of `"STOP"` — which is not an HTTP failure and would otherwise throw an unhandled `TypeError` on property access); a missing/blocked candidate throws `ItineraryGenerationError` with `cause: "invalid_response"` immediately, without attempting to parse. Otherwise parses that text as JSON, validates it against the zod schema from step 3, and re-checks that `days.length === dayCount` and day numbers cover `1..dayCount` exactly (a schema-valid but semantically wrong response, e.g. wrong day count, is still rejected). Throws the same distinguishable error (e.g. a custom `ItineraryGenerationError` with a `cause` of `"upstream" | "invalid_response"`) on any HTTP failure, timeout, or validation failure, so Phase 2 can map all of these to the same "generation failed" response without leaking raw Gemini errors to the client.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` (or `npx astro check` if available as a standalone step)
- Linting passes: `npm run lint`

#### Manual Verification:

- With a real `GEMINI_API_KEY` set locally, calling `generateItinerary("Kraków, Poland", 3)` from a scratch script or temporary route returns a plan with exactly 3 days, each with at least one point.
- Requesting an invalid/nonsense city still returns a schema-valid response (Gemini will invent something) — confirms the validation layer doesn't reject on content, only on shape/day-count.
- Temporarily using an invalid API key confirms `generateItinerary` throws the typed error rather than an unhandled exception.
- A prompt likely to trigger Gemini's safety filter (e.g. requesting a plan for a nonsense/adversarial "city" string designed to provoke a block) confirms `generateItinerary` throws `ItineraryGenerationError` with `cause: "invalid_response"` rather than an unhandled `TypeError` on a missing/blocked candidate.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Trip API routes

### Overview

Expose generation, saving, and listing as three Astro API routes, wired to the Phase 1 service and to Supabase, enforcing the 1–14 day-count bound and per-user data isolation (already guaranteed at the DB layer by RLS, but validated at the API boundary too so bad input fails fast with a clear error).

### Changes Required:

#### 1. Generate endpoint

**File**: `src/pages/api/trips/generate.ts` (new file)

**Intent**: Validate the incoming `{ city, day_count }`, call the Phase 1 Gemini service, and return the generated (unsaved) plan as JSON.

**Contract**: `export const prerender = false; export const POST: APIRoute = ...`. Body validated with zod: `city` non-empty string, `day_count` integer in `[1, 14]`. Requires `context.locals.user` (route sits under a protected path — see Phase 3's middleware update — but also checks `locals.user` defensively, matching the auth routes' pattern of not trusting middleware alone). On success returns `{ city, day_count, days }` (200). On a Phase 1 `ItineraryGenerationError`, returns a 502 with a generic `{ error: "generation_failed" }` body (no raw Gemini error text leaked to the client).

#### 2. Save endpoint

**File**: `src/pages/api/trips/index.ts` (new file, handles both `POST` and `GET`)

**Intent**: Persist an accepted plan (`POST`) as one `trips` row plus its `trip_points` rows, and list the current user's trips with their points (`GET`), both scoped to `locals.user.id`.

**Contract**: `export const prerender = false;`
- `POST`: body validated with the same itinerary zod shape plus `{ city, day_count }`; re-validates `days.length === day_count` server-side (never trust the client to have preserved the accepted plan unmodified). Inserts into `trips` (`user_id` from `locals.user.id`, `city`, `day_count`), then bulk-inserts `trip_points` rows (one per point, `trip_id` from the created trip, `day_number`/`order_index` from array position, `name`/`description`/`latitude`/`longitude` passed through; `user_id` omitted — the DB trigger derives it). Wrapped so a `trip_points` insert failure after the `trips` insert still leaves the API able to report failure (the trip row without points is acceptable to leave behind for MVP — no distributed-transaction requirement here, since a partially-failed trip is a rare failure mode the user can just retry saving via the review screen, which still holds the plan in state). Returns the created `Trip` + its points (201).
- `GET`: `supabase.from("trips").select("*, trip_points(*)").eq("user_id", locals.user.id).order("created_at", { ascending: false })` (RLS makes the explicit `.eq` belt-and-suspenders, not load-bearing). Returns the array (200).

#### 3. Protect the new routes

**File**: `src/middleware.ts`

**Intent**: Extend route protection to the new trips page and its API routes so unauthenticated requests are redirected/rejected the same way `/dashboard` already is.

**Contract**: Add `"/trips"` and `"/api/trips"` to `PROTECTED_ROUTES` (the existing `startsWith` check already covers `/api/trips/generate` and `/api/trips` as prefixes).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- `POST /api/trips/generate` with a valid session and `{ city: "Paris", day_count: 5 }` returns a 5-day plan; with `day_count: 15` returns a 400 validation error.
- `POST /api/trips` with a generated plan persists a `trips` row and matching `trip_points` rows, visible via Supabase Studio, with `trip_points.user_id` correctly set by the trigger even though the request omitted it.
- `GET /api/trips` returns only the requesting user's trips; a second test user sees none of the first user's trips.
- Calling any of the three routes without an authenticated session is rejected (redirect for the page, 401/redirect behavior consistent with the existing middleware for the API routes).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Generation and review UI

### Overview

The React island driving the user-facing flow: a form (city + day count), a blocking loading state, a read-only review screen with Accept/Discard, and error handling with retry — all on the new `/trips` page.

### Changes Required:

#### 1. Trips page shell

**File**: `src/pages/trips.astro` (new file)

**Intent**: Authenticated page hosting the generation flow and (from Phase 4) the trip list, following the existing `dashboard.astro` pattern of reading `Astro.locals.user` inside a `Layout`.

**Contract**: Server component reads `const { user } = Astro.locals;` and renders a React island (`client:load`) for the interactive parts, passing nothing sensitive as props (the island calls the API routes itself with the browser's session cookie).

#### 2. Missing shadcn/ui primitives

**File**: `src/components/ui/` (new files via `npx shadcn@latest add input`, plus a minimal loading indicator)

**Intent**: Add the `Input` component (city/day-count fields) and a loading indicator, per CLAUDE.md's "install new ones with `npx shadcn@latest add [name]`" convention, rather than hand-rolling form controls.

**Contract**: Standard shadcn/ui generated files under `src/components/ui/`, "new-york" variant, matching the existing `button.tsx`.

#### 3. Trip generation flow component

**File**: `src/components/trips/TripGeneratorFlow.tsx` (new file)

**Intent**: Own the client-side state machine — `form → loading → review → (accept | error)` — and the calls to `/api/trips/generate` and `/api/trips`, using `cn()` for conditional classes per CLAUDE.md convention.

**Contract**: Local component state (e.g. a `status` union: `"idle" | "loading" | "review" | "error"`) holds the current step, the submitted `{ city, day_count }`, the last generated plan (kept only in this component's state — never written to any store until accepted, per the confirmed no-server-draft decision), and the last error. Submitting the form calls `POST /api/trips/generate`, sets `status: "loading"` immediately (button disabled, spinner + status text visible for the whole request — no streaming), then `status: "review"` on success or `status: "error"` on failure (city/day-count values are preserved in state either way so **Try again** re-submits without re-typing). The review screen renders the plan read-only, grouped by `day_number`, with an **Accept** button that calls `POST /api/trips` with the held plan and, on success, either navigates to `/trips` fresh or invalidates/refetches the trip list (Phase 4) so the new trip appears immediately — and a **Discard** button that returns to `status: "idle"` with the form pre-filled with the last submitted city/day count.

#### 4. Extract the day-count/city form field logic

**File**: `src/components/hooks/useTripGenerationForm.ts` (new file, only if the form has non-trivial validation/state beyond what a plain controlled input needs)

**Intent**: Per CLAUDE.md ("Extract hooks to `src/components/hooks/`"), keep any client-side validation (day count 1–14, non-empty city) out of the JSX if it grows beyond a couple of inline checks.

**Contract**: Returns form field values, setters, and a `canSubmit` boolean; mirrors the same 1–14 bound enforced server-side in Phase 2 so the client can disable the submit button before an avoidable round trip.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Submitting a valid city + day count shows a blocking loading state (form disabled, spinner + status text) for the duration of the Gemini call, then the review screen with the correct number of days.
- Entering a day count outside 1–14 is prevented client-side (and still rejected server-side if bypassed).
- Clicking **Accept** on the review screen saves the trip (verified against Phase 2's `POST /api/trips`) and the flow returns to a state ready to generate another trip.
- Clicking **Discard** returns to the form with the previous city/day count still filled in, without having saved anything.
- Forcing a Gemini failure (e.g. temporarily invalid API key) shows a readable error message and a working **Try again** that resubmits the same city/day count.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Trip panel

### Overview

A read-only list of the user's saved trips (newest first), each showing its city, day count, and day-grouped points, rendered on the same `/trips` page below the generation flow.

### Changes Required:

#### 1. Trip list component

**File**: `src/components/trips/TripList.tsx` (new file)

**Intent**: Fetch and render the current user's saved trips via `GET /api/trips`, satisfying FR-006 ("User can view a panel listing their saved trips") and the US-01 acceptance criterion that an accepted trip "appears in the user's trip panel immediately after acceptance."

**Contract**: On mount, calls `GET /api/trips` and renders each trip (city, day count, `created_at`) with its points grouped by `day_number`, in the `created_at DESC` order the API already returns. Exposes a `refresh()` entry point (or accepts a `refreshKey`/callback prop) that Phase 3's `TripGeneratorFlow` calls after a successful accept, so the newly saved trip appears without a full page reload. An empty list renders a simple "No trips yet" state rather than nothing.

#### 2. Wire list into the trips page

**File**: `src/pages/trips.astro`

**Intent**: Render `TripList` alongside `TripGeneratorFlow` and connect the "trip accepted" signal between them.

**Contract**: Both components mount inside the same client island (or two islands sharing a small lifted-state wrapper) so accepting a plan in `TripGeneratorFlow` triggers `TripList`'s refresh.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- With no saved trips, the panel shows the empty state.
- After accepting a generated plan (Phase 3), the new trip appears at the top of the list without a manual page refresh.
- The list correctly displays multiple trips across multiple day counts, each point grouped under its correct day.
- A second test user's trip panel never shows the first user's trips.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: End-to-end verification

### Overview

Confirm the full US-01 flow works together in a real browser against a running server, and that the existing smoke test / CI still pass with the new routes and env var in place.

### Changes Required:

#### 1. Smoke test env note

**File**: `.env.example` / repo docs (already updated in Phase 1 for `GEMINI_API_KEY`)

**Intent**: No code change in this phase — confirm `npm run smoke` still passes unmodified (it only exercises the auth flow) with the new routes present, and that CI's build step doesn't fail due to the new required-but-optional `GEMINI_API_KEY` schema field.

**Contract**: N/A — verification only.

### Success Criteria:

#### Automated Verification:

- Full build passes: `npm run build`
- Lint passes: `npm run lint`
- Existing smoke test still passes unmodified: `npm run smoke` (against a locally running `npm run dev`/`npm run preview`)

#### Manual Verification:

- Full path in a real browser: sign in → go to `/trips` → enter a city + day count → see loading feedback → review the generated plan → accept → see it at the top of the trip panel.
- Refreshing `/trips` after accepting still shows the saved trip (confirms it was actually persisted, not just held in client state).
- The guardrail "no silent hang" is visibly satisfied: the loading state is continuously visible for the whole Gemini round trip, not just an initial flash.
- `GEMINI_API_KEY` is set as a Cloudflare Workers Secret in production (`wrangler secret put GEMINI_API_KEY`), and mirrored to any PR preview environment that needs to exercise generation, per `context/foundation/infrastructure.md`.

## Testing Strategy

### Manual Testing Steps:

1. As a new user, sign up, sign in, and navigate to `/trips`.
2. Generate a 3-day plan for a real city; confirm loading feedback and a correctly-grouped review screen.
3. Accept the plan; confirm it appears at the top of the trip panel immediately, and again after a page refresh.
4. Generate another plan and click **Discard**; confirm nothing is saved and the form retains the last input.
5. Force a generation failure (invalid API key or a network block) and confirm the error + retry UX.
6. Repeat steps 1–3 as a second user and confirm neither user sees the other's trips.

## Performance Considerations

The Gemini call is the dominant latency source and is not parallelizable with anything else in the flow; the NFR is satisfied by continuous UI feedback (Phase 3) rather than by making the call itself faster. The 1–14 day-count bound (Phase 2) keeps prompt/response size, and therefore latency and Cloudflare Worker CPU time, bounded.

## Migration Notes

Not applicable — no existing trip data to migrate; this is the first slice that writes to the F-01 schema.

## References

- Roadmap: `context/foundation/roadmap.md` (S-01)
- PRD: `context/foundation/prd.md` (US-01, FR-001–FR-006, NFRs, Access Control)
- Tech stack rationale: `context/foundation/tech-stack.md` (Gemini + edge-runtime risk note)
- Existing schema: `supabase/migrations/20260926141148_create_trips_schema.sql`
- Domain types: `src/types.ts`
- Auth route conventions to follow: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`
- Middleware to extend: `src/middleware.ts`
- Existing authenticated page pattern: `src/pages/dashboard.astro`
- Supabase client: `src/lib/supabase.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Gemini integration service

#### Automated

- [x] 1.1 Type checking passes — 85bf653
- [x] 1.2 Linting passes — 85bf653

#### Manual

- [x] 1.3 `generateItinerary` returns a valid N-day plan for a real city — 85bf653
- [x] 1.4 An invalid/nonsense city still returns a schema-valid response — 85bf653
- [x] 1.5 An invalid API key causes a typed error, not an unhandled exception — 85bf653
- [x] 1.6 A safety-filter-blocked response causes a typed `invalid_response` error, not an unhandled exception — 85bf653

### Phase 2: Trip API routes

#### Automated

- [ ] 2.1 Type checking passes
- [ ] 2.2 Linting passes

#### Manual

- [ ] 2.3 `POST /api/trips/generate` returns a correct plan for valid input and a 400 for `day_count` outside 1–14
- [ ] 2.4 `POST /api/trips` persists a trip and its points, with `trip_points.user_id` correctly trigger-derived
- [ ] 2.5 `GET /api/trips` returns only the requesting user's trips
- [ ] 2.6 Unauthenticated requests to the trips page/API are rejected

### Phase 3: Generation and review UI

#### Automated

- [ ] 3.1 Type checking passes
- [ ] 3.2 Linting passes

#### Manual

- [ ] 3.3 Submitting valid input shows continuous loading feedback, then a correct review screen
- [ ] 3.4 Day count outside 1–14 is prevented client-side
- [ ] 3.5 Accept saves the trip and returns to a ready-to-generate state
- [ ] 3.6 Discard returns to the form with prior input retained, without saving
- [ ] 3.7 A forced Gemini failure shows a readable error with a working retry

### Phase 4: Trip panel

#### Automated

- [ ] 4.1 Type checking passes
- [ ] 4.2 Linting passes

#### Manual

- [ ] 4.3 Empty state renders with no saved trips
- [ ] 4.4 Newly accepted trip appears at the top of the list without a manual reload
- [ ] 4.5 Multiple trips/points render correctly grouped by day
- [ ] 4.6 A second user never sees the first user's trips

### Phase 5: End-to-end verification

#### Automated

- [ ] 5.1 `npm run build` passes
- [ ] 5.2 `npm run lint` passes
- [ ] 5.3 `npm run smoke` still passes unmodified

#### Manual

- [ ] 5.4 Full sign-in → generate → review → accept → trip-panel path works in a real browser
- [ ] 5.5 Saved trip survives a page refresh
- [ ] 5.6 Loading feedback is continuously visible for the whole generation round trip
- [ ] 5.7 `GEMINI_API_KEY` set as a Cloudflare Workers Secret in production (and mirrored to preview) per `context/foundation/infrastructure.md`

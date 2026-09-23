---
project: "TripPlanner"
context_type: greenfield
created: 2026-09-21
updated: 2026-09-21
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 7
  hard_deadline: 2026-12-06
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "workflow friction — manual research and day-by-day planning takes too long"
    - topic: "insight"
      decision: "existing lists aren't grouped logistically by day/geography, and sources are scattered across blogs — no single standardized, editable plan"
    - topic: "primary persona scope"
      decision: "single named user, including the builder themself, as first user"
    - topic: "auth strategy"
      decision: "email + password login; flat model, no roles — each user sees only their own trips"
    - topic: "MVP timeline"
      decision: "7-week MVP budget (2 weeks now + October gap + intensive November), committed to the longer timeline over cutting scope"
    - topic: "FR priorities"
      decision: "point editing, point deletion, and whole-plan deletion are nice-to-have, not must-have — must-have is the generate/accept/save/list flow"
  frs_drafted: 10
  quality_check_status: accepted
---

## Vision & Problem Statement

A traveler planning a trip to a city knows the destination and how many days they'll spend there, but turning that into a concrete sightseeing plan means manually searching travel blogs and "top things to see" lists, then assembling the results into a day-by-day itinerary themselves. This is workflow friction, not a missing capability from scratch — the information exists, but it's scattered across sources and never arrives pre-grouped by day or by logistics.

What today's blogs and generic lists miss: they aren't grouped logistically (by day, by area) and force the traveler to do the synthesis work themselves from multiple scattered sources. A tool that takes a city + day count and returns an already-grouped, editable itinerary removes that synthesis step.

## User & Persona

**Primary persona:** A single named user — the builder themself, as the first user — who is planning their own trips and wants a fast, concrete day-by-day sightseeing plan instead of assembling one by hand from blogs and lists.

## Access Control

Email + password login. Flat user model — no roles; each authenticated user sees and edits only their own saved trips.

## Timeline acknowledgment

Acknowledged on 2026-09-21: 7-week MVP requires sustained dedication (2 weeks now at 6h/week, an October gap with no availability, then intensive catch-up in November); user accepted.

## Success Criteria

### Primary
- A logged-in user can enter a city and a number of days, receive an AI-generated day-by-day sightseeing plan, accept it, and see it saved in their trip list.

### Secondary
- User can edit the accepted plan: add their own points, edit existing points.
- User can delete an entire saved plan.

### Guardrails
- A user never sees another user's trips (data isolation).
- The plan-generation step gives visible feedback while waiting on the Gemini response — no silent hang.
- An accepted, saved plan is never silently lost or overwritten.

## Functional Requirements

### Authentication
- FR-001: User can register and log in with email and password. Priority: must-have
  > Socrates: Counter-argument considered: "with a single MVP user, login could be skipped and added later." Resolution: kept; the app is deployed publicly-reachable, so access control is needed from the start.

### Plan generation
- FR-002: User can enter a city name and a number of days for the trip. Priority: must-have
  > Socrates: Counter-argument considered: "ambiguous city names (e.g. multiple cities with the same name) could return the wrong itinerary." Resolution: kept as plain text; user can qualify the city (e.g. "Kraków, Poland") when needed — no disambiguation UI in MVP.
- FR-003: The app sends a prompt to Google Gemini and receives a standardized JSON itinerary grouped by day. Priority: must-have
  > Socrates: Counter-argument considered: "Gemini may hallucinate places that don't exist or are inaccurate." Resolution: kept; risk is accepted for MVP and mitigated by FR-004 (user reviews the plan before it's saved).
- FR-004: User can review the generated plan before saving it. Priority: must-have
  > Socrates: Counter-argument considered: "none — it stands as written."
- FR-005: User can accept the generated plan, saving it to their trip list. Priority: must-have
  > Socrates: Counter-argument considered: "none — it stands as written."

### Trip management
- FR-006: User can view a panel listing their saved trips. Priority: must-have
  > Socrates: Counter-argument considered: "an unsorted/unfiltered list becomes hard to scan once there are many trips." Resolution: kept; trip count is expected to be small in MVP, revisit sorting/filtering if the list grows.
- FR-007: User can add their own sightseeing points to a saved trip. Priority: nice-to-have
  > Socrates: Counter-argument considered: "none — it stands as written."
- FR-008: User can edit an existing point in a saved trip. Priority: nice-to-have
  > Socrates: Counter-argument considered: "none — it stands as written."
- FR-009: User can delete a single point from a saved trip. Priority: nice-to-have
  > Socrates: Counter-argument considered: "accidental deletion without undo risks losing data by mistake." Resolution: kept; noted as an implementation consideration (confirmation step) rather than a PRD-level requirement.
- FR-010: User can delete an entire saved trip. Priority: nice-to-have
  > Socrates: Counter-argument considered: "permanent deletion without confirmation risks accidental, irreversible data loss." Resolution: kept; noted as an implementation consideration (confirmation step) rather than a PRD-level requirement.

## Business Logic

Given a city name and a number of days, the app generates a sightseeing itinerary that groups recommended points of interest into daily segments sized to the length of the stay.

Inputs: a city name and a number of days, both supplied by the user. Output: a day-grouped list of recommended sightseeing points for that city, sized to fit the requested number of days. The user encounters this rule immediately after submitting the city/day-count form — before the plan is saved, they see the generated, day-grouped plan and choose to accept it or not.

## Non-Functional Requirements

- The user sees continuous visible feedback while a plan is being generated, for any wait longer than ~2 seconds — no silent hang.
- One user's trip data is never accessible to another authenticated user.
- The product is usable on the latest two major versions of mainstream desktop browsers; mobile/older-browser support is not guaranteed in MVP.

## Non-Goals

- No custom recommendation algorithm — itinerary generation relies entirely on Google Gemini; no home-grown scoring or ranking model for places.
- No booking or payment integrations — the product plans sightseeing only; no flights, hotels, tickets, or payments.
- No shared or multi-user trips — each saved trip belongs to exactly one user; no collaboration or sharing between accounts.
- No mobile or native app — MVP targets desktop browsers only, per the NFR above; no dedicated mobile/native client.

## User Stories

## Forward: tech-stack

- AI provider: the user's stated intent is to use Google Gemini for itinerary generation (sends a prompt, receives a standardized JSON response). This is a vendor/stack choice kept out of the PRD body; `10x-tech-stack-selector` should pick it up as a stated preference rather than an open choice.

### US-01: User generates and saves a trip plan

- **Given** a logged-in user with no saved trips
- **When** they enter a city name and a number of days, and the app returns a generated plan
- **Then** they can review the plan and accept it, after which it appears in their list of saved trips

#### Acceptance Criteria
- The generated plan groups sightseeing points by day, matching the requested day count.
- The user sees the plan before it is saved — acceptance is an explicit step, not automatic.
- The saved trip appears in the user's trip panel immediately after acceptance.

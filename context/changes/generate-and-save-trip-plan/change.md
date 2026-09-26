---
change_id: generate-and-save-trip-plan
title: Generate and save a trip plan
status: impl_reviewed
created: 2026-09-26
updated: 2026-09-26
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- 2026-09-26 (Phase 1, ADAPT): Plan's Gemini service contract named `gemini-3.8-flash`. During manual verification (1.3/1.5) that model returned `503 UNAVAILABLE` ("high demand") on ~75% of identical requests (confirmed via direct curl against the Gemini REST API, both under its own name and the `gemini-flash-latest` alias, which resolves to the same `modelVersion`). This is an upstream availability issue, not a code defect — `ItineraryGenerationError` with `cause: "upstream"` correctly fired on every 503. Per the user's decision, `src/lib/services/gemini.ts`'s `GEMINI_ENDPOINT` was switched to `gemini-flash-lite-latest`, which returned `200` with a schema-valid plan on first try. Revisit if `gemini-3.8-flash` capacity improves.

- 2026-09-26 (Phase 1, ADAPT — scope addition): Per the user's request ("can we guard against a nonsense city?"), `itinerary-schema.ts`/`gemini.ts` gained a `city_recognized: boolean` field beyond the plan's original Phase 1 contract. The prompt asks Gemini to self-report whether the requested city is a real, recognizable place; `generateItinerary` now throws `ItineraryGenerationError` (`cause: "invalid_response"`) when `city_recognized` is `false`, before the day-count check, and strips the field back out of the returned `ItineraryPlan`. **This reverses Phase 1's own documented manual-verification item 1.4** ("Requesting an invalid/nonsense city still returns a schema-valid response ... confirms the validation layer doesn't reject on content") — that checkbox is now checked based on the *opposite* observed behavior (a nonsense city is rejected, not accepted), per the user's explicit choice of this lightweight prompt-based approach over leaving it unguarded or building real geocoding as a separate change. Flagged and confirmed correctly wired (no bypass) by `/10x-impl-review`'s Phase 1 review.

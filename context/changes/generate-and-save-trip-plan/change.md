---
change_id: generate-and-save-trip-plan
title: Generate and save a trip plan
status: implementing
created: 2026-09-26
updated: 2026-09-26
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- 2026-09-26 (Phase 1, ADAPT): Plan's Gemini service contract named `gemini-3.8-flash`. During manual verification (1.3/1.5) that model returned `503 UNAVAILABLE` ("high demand") on ~75% of identical requests (confirmed via direct curl against the Gemini REST API, both under its own name and the `gemini-flash-latest` alias, which resolves to the same `modelVersion`). This is an upstream availability issue, not a code defect — `ItineraryGenerationError` with `cause: "upstream"` correctly fired on every 503. Per the user's decision, `src/lib/services/gemini.ts`'s `GEMINI_ENDPOINT` was switched to `gemini-flash-lite-latest`, which returned `200` with a schema-valid plan on first try. Revisit if `gemini-3.8-flash` capacity improves.

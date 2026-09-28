# Review follow-ups: generate-and-save-trip-plan

Queued from `reviews/impl-review.md` (full-plan review, 2026-09-28).

## Per-user rate limit on `POST /api/trips/generate` (from F4)

- **Why**: any signed-in user can call generation without limit, and each call can make up to 6 Gemini requests (503 retry) on the shared free-tier key, so one script or spike can exhaust the RPM/RPD quota for everyone. Accepted as an MVP risk; jitter was added to the retry pause in the meantime.
- **Scope**: a simple per-user limit (e.g. N generations per minute) that holds across Workers isolates — KV (`SESSION` binding exists, but KV is eventually consistent) or a Supabase counter table with RLS.
- **Before starting**: check the actual free-tier RPM/RPD for `gemini-3.1-flash-lite`.

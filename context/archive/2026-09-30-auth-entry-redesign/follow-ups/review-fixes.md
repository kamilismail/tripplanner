# Review follow-ups: auth-entry-redesign

## From impl-review-phase-2 (2026-11-15)

### F8: Auth error messages via codes, not reflected text

- **Source**: `reviews/impl-review-phase-2.md` F8. This predates Phase 2 and is outside this change's plan scope.
- **Problem**:
  - `/auth/signin` and `/auth/signup` render `?error=` verbatim in the destructive Alert. React escapes it, so it is
    not XSS, but a crafted link can show attacker-chosen text (content spoofing).
  - `src/pages/api/auth/{signin,signup}.ts` forward Supabase `error.message` as is, which may allow account
    enumeration on sign-up.
- **Proposed fix**: The API routes redirect with `?error=<code>` (for example `invalid_credentials`,
  `invalid_input`, `signup_failed`, `not_configured`). The pages map known codes to fixed English messages and fall
  back to a generic message for unknown codes.
- **Touches**: the API routes, `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, a small mapping module
  in `src/lib/`, and the `scripts/smoke.mjs` assertions (the `?error=` prefixes stay the same).
- **Open**: list the Supabase auth error messages and codes that can reach the UI.
- **Where**: a separate change through `/10x-new` (not Phase 3 of this plan).

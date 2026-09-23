---
starter_id: 10x-astro-starter
package_manager: npm
project_name: trip-planner
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: manual-promotion
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
---

## Why this stack

TripPlanner is a solo-built, small-scale web app with a 7-week after-hours MVP budget, requiring email/password auth (FR-001) and an AI-generated itinerary step (FR-003, backed by Google Gemini). 10x Astro Starter is the recommended default for `(web-app, js)`: Astro + React + TypeScript + Supabase gives auth and a Postgres database out of the box, matching FR-001 and the data-isolation guardrail without extra integration work, while TypeScript-first contracts keep the AI-generation boundary (city/day-count in, day-grouped JSON out) explicit and agent-friendly. AI generation itself is provider-agnostic at the framework level — Gemini is called from a server-side Astro API route/Cloudflare Worker — though the starter's edge-runtime constraint on long-running tasks is worth watching given the NFR that generation must show continuous feedback past ~2 seconds. Bootstrapper confidence is first-class (registered CLI, not yet battle-tested), so expect occasional manual scaffolding steps. Deployment defaults to Cloudflare Pages per the starter; CI runs on GitHub Actions, with deploy gated behind a passing test job (manual-promotion flow) rather than auto-deploying straight from Cloudflare Builds.

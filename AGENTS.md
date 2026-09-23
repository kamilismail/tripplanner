# Repository Guidelines

tripplanner is an Astro 7 SSR web app (React 19 islands, Tailwind 4, Supabase auth) deployed to Cloudflare Workers.

## Hard Rules

- New Supabase tables must enable RLS with granular per-operation, per-role policies before merging — see `@CLAUDE.md`.
- `SUPABASE_URL` / `SUPABASE_KEY` are declared server-only in `astro.config.mjs`'s `env` schema — never read via `import.meta.env` or pass to a client component.
- Don't bypass the husky pre-commit hook with `--no-verify`; it runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

## Project Structure & Module Organization

- `src/pages/` — Astro pages; `src/pages/api/` — API endpoints.
- `src/components/` — Astro & React components; `src/components/auth/` — auth forms; `src/components/ui/` — shadcn/ui ("new-york" style; add via `npx shadcn@latest add <name>`).
- `src/lib/` — helpers/services (`supabase.ts`, `utils.ts`); `src/middleware.ts` — auth + route protection (`PROTECTED_ROUTES` array).
- `supabase/` — local Supabase CLI config; migrations belong in `supabase/migrations/`.
- Full auth-flow breakdown: `@CLAUDE.md`.

## Build, Test, and Development Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime).
- `npm run build` / `npm run preview` — production build / preview it.
- `npm run lint` / `npm run lint:fix` — type-checked ESLint.
- `npm run smoke` — auth-flow smoke test against a running server (`BASE_URL`, default `http://localhost:4321`).

## Coding Style & Naming Conventions

- Formatting enforced by `@.prettierrc.json` (2-space indent, double quotes, 120-char width, trailing commas) — run `npm run format`.
- Path alias `@/*` → `./src/*` (`@tsconfig.json`).
- Merge conditional Tailwind classes with `cn()` from `@/lib/utils` — don't concatenate class strings manually.
- ESLint (`@eslint.config.js`): `typescript-eslint` strict + stylistic type-checked configs; unused vars must be prefixed with `_`.

## Testing Guidelines

- No unit/integration test suite exists yet. `npm run smoke` (`scripts/smoke.mjs`) is a dependency-free sanity check of the auth flow (sign-up, sign-in, protected page, sign-out) — run after dependency upgrades, not as a substitute for real tests.

## Commit & Pull Request Guidelines

- Repository has a single initial commit — no message convention established yet; use a short, imperative summary line.
- CI (`@.github/workflows/ci.yml`) runs `lint`, `astro check`, and `build` on every push/PR to `master`, plus a `smoke` job against a local Supabase instance — both must pass before merging.

## Security & Configuration Tips

- Copy `.env.example` to `.env` (Node) and to `.dev.vars` (Cloudflare local dev, gitignored) — never commit real `SUPABASE_URL` / `SUPABASE_KEY`.
- Local Supabase stack: `npx supabase start` (requires Docker).

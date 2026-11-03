# 01: Monorepo skeleton, health check and Docker Compose

Blocked by: none

## What to build
The thinnest end-to-end path: a pnpm workspace whose Hono API reports database health, serves a placeholder Nuxt page, and runs in Docker Compose with Postgres.

- pnpm workspace with `apps/api`, `apps/web` and `packages/core`; shared strict `tsconfig`; Vitest; ESLint and Prettier.
- `apps/api`: Hono app (exported separately from the Node server start-up so tests can call `app.request()`). Drizzle connected to Postgres through `DATABASE_URL`. drizzle-kit set up, with migrations run on start-up (an empty initial migration is fine). `GET /api/health`.
- `apps/web`: Nuxt with `ssr: false`, shadcn-vue and TanStack Query for Vue installed, and one placeholder page that calls `/api/health` and shows the result.
- Hono serves the `nuxi generate` output with an `index.html` fallback; `pnpm dev` runs both with Nuxt proxying `/api`.
- Multi-stage `Dockerfile`, `compose.yaml` (app + Postgres with a named volume and a health check), `.env.example`.
- GitHub Actions workflow running typecheck, lint and tests on push.
- Add the agreed working rules to `CLAUDE.md`: all API code lives in Hono, not Nuxt's `server/`; domain logic lives in `packages/core`; use the glossary in `CONTEXT.md`.

## Acceptance criteria
- [x] `docker compose up` with a copied `.env.example` serves the placeholder page at `http://localhost:3000`, showing that the database is healthy.
- [x] `GET /api/health` returns `200 {"status":"ok"}`, tested with `app.request()` against PGlite.
- [x] Reloading the browser on any front-end route serves `index.html`.
- [x] `pnpm dev` runs the API and the web app together.
- [x] CI passes on the branch.

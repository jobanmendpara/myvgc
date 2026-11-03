# Working rules

- **Use the glossary.** Name things with the terms in `CONTEXT.md` (Team, Pokémon build, Round, never "Match", and so on), in code, tests, UI text and commits.
- **All API code lives in Hono** (`apps/api`). Nuxt runs as a single-page app; never add code to Nuxt's `server/` folder.
- **Domain logic lives in `packages/core`**: Pokémon builds, Teams, paste reading and writing, shared Zod schemas. It does no I/O, so it can be tested without HTTP, a browser or a database.
- **Decisions are in `docs/adr/`.** Follow them; if a change goes against one, record a new ADR rather than drifting silently.
- **Test behaviour through public interfaces** (ADR 13): Vitest unit tests in `packages/core`; API tests through `app.request()` against PGlite with migrations applied.

## Layout

- `apps/api`: Hono API. `src/app.ts` builds the app (tests call it directly); `src/server.ts` runs migrations and starts the Node server. Migrations live in `apps/api/drizzle` (generate with `pnpm --filter @myvgc/api db:generate`) and run on start-up.
- `apps/web`: Nuxt (`ssr: false`), shadcn-vue components in `app/components/ui`, TanStack Query for server state.
- `packages/core`: domain logic.

## Commands

- `pnpm db:up`: start Postgres for development (needs a `.env` copied from `.env.example`).
- `pnpm dev`: run the API (port 3001) and the web app (port 3000, proxying `/api`).
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`: what CI runs.
- `docker compose up --build`: run the production image with Postgres.

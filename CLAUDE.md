# Working rules

- **Use the glossary.** Name things with the terms in `CONTEXT.md` (Team, Pokémon build, Round, never "Match", and so on), in code, tests, UI text and commits.
- **All API code lives in Hono** (`apps/api`). Nuxt runs as a single-page app; never add code to Nuxt's `server/` folder.
- **Domain logic lives in `packages/core`**: Pokémon builds, Teams, paste reading and writing, shared Zod schemas. It does no I/O, so it can be tested without HTTP, a browser or a database.
- **Decisions are in `docs/adr/`.** Follow them; if a change goes against one, record a new ADR rather than drifting silently.
- **Test behaviour through public interfaces** (ADR 13): Vitest unit tests in `packages/core`; API tests through `app.request()` against PGlite with migrations applied.

## Tracking

- **Issues live in Linear**: team DEV, project MyVGC. Use the labels Feature, Bug, Improvement, Refactor, Chore and Decision. Don't use GitHub Issues.
- **Link work to its issue.** Put the Linear identifier (such as `DEV-31`) in the branch name (Linear's suggested `gitBranchName` works) or the PR title, so the Linear–GitHub integration links them.
- **Decisions**: the ADR in `docs/adr/` is the source of truth. When you add or change one, mirror it as a document in the MyVGC project titled "ADR N: <title>", starting with a line naming the repo file. A decision still to be made is an issue labelled Decision.

## Layout

- `apps/api`: Hono API. `src/app.ts` builds the app (tests call it directly); `src/server.ts` runs migrations and starts the Node server. Migrations live in `apps/api/drizzle` (generate with `pnpm --filter @myvgc/api db:generate`) and run on start-up.
- `apps/web`: Nuxt (`ssr: false`), shadcn-vue components in `app/components/ui`, TanStack Query for server state.
- `packages/core`: domain logic. `@myvgc/core` loads Showdown's data (about 900 KB gzipped), so the web app imports only `@myvgc/core/schema` and gets display names from the API.
- `e2e`: the Playwright smoke test, run against the built image in Compose.

## Commands

- `pnpm db:up`: start Postgres for development (needs a `.env` copied from `.env.example`).
- `pnpm dev`: run the API (port 3001) and the web app (port 3000, proxying `/api`).
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`: what CI runs.
- `pnpm up:local`: build the image from this checkout and start it with Postgres (`compose.yaml` plus `compose.build.yaml`). Plain `compose.yaml` pulls the published GHCR image.
- `pnpm smoke`: the Playwright smoke test against a running app (default `http://localhost:3000`).
- Releases: pushing a tag such as `v0.1.0` runs the smoke test, then publishes `ghcr.io/jobanmendpara/myvgc:0.1.0` and `:latest`.

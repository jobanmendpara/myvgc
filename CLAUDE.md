# Working rules

- **Use the glossary.** Name things with the terms in `CONTEXT.md` (Team, Pokémon build, Round, never "Match", and so on), in code, tests, UI text and commits.
- **All API code lives in Hono** (`apps/api`). Nuxt runs as a single-page app; never add code to Nuxt's `server/` folder.
- **Domain logic lives in `packages/core`**: Pokémon builds, Teams, paste reading and writing, shared Zod schemas. It does no I/O, so it can be tested without HTTP, a browser or a database.
- **Decisions are in `docs/adr/`.** Follow them; if a change goes against one, record a new ADR rather than drifting silently.
- **Test behaviour through public interfaces** (ADR 13): Vitest unit tests in `packages/core`; API tests through `app.request()` against PGlite with migrations applied.
- **Judge reading changes with `pnpm accuracy`** (ADR 24). A PR that changes the image reader's instructions, `seenTeamSchema`, the default model or the web app's image shrinking runs `pnpm accuracy` before and after the change and pastes both summaries. A change that makes any case worse needs the maintainer's sign-off.

## Tracking

- **Issues live in Linear**: team DEV, project MyVGC. Use the labels Feature, Bug, Improvement, Refactor, Chore and Decision. GitHub Issues are mirrors synced from Linear: create and edit issues in Linear, never in GitHub.
- **Link work to its issue.** Put the Linear identifier (such as `DEV-31`) in the branch name (Linear's suggested `gitBranchName` works) or the PR title, so the Linear–GitHub integration links them.
- **Name unfinished issues without closing keywords.** In a PR body or commit message, write "Related to" or "Part of" before an issue the work doesn't finish, never close, fix or resolve in any form. Linear's GitHub integration reads those words right before an identifier as a closing keyword, even after "doesn't", and closes the issue when the PR merges.
- **Decisions**: the ADR in `docs/adr/` is the source of truth. When you add or change one, mirror it as a document in the MyVGC project titled "ADR N: <title>", starting with a line naming the repo file. A decision still to be made is an issue labelled Decision.

## Shipping

- **Branch off `origin/main`.** When you open the PR, compare your files with `origin/main`'s newer commits (`git diff --name-only <merge-base>..origin/main`); rebase only if they overlap.
- **Queue the merge** straight after `gh pr create`: `gh pr merge <n> --auto --merge --delete-branch`. Never run a plain `gh pr merge`: the admin token merges at once and skips the required checks.
- **Wait in the foreground.** Run `scripts/wait-for-checks.sh <n>` again and again until it exits 0 (merged; it prints the merge commit) or 1 (a check failed: fix it and push).
- **History** of this flow is in `docs/wiki/shipping-flow.md`.

## Layout

- `apps/api`: Hono API. `src/app.ts` builds the app (tests call it directly); `src/server.ts` runs migrations and starts the Node server. Migrations live in `apps/api/drizzle` (generate with `pnpm --filter @myvgc/api db:generate`) and run on start-up.
- `apps/web`: Nuxt (`ssr: false`), shadcn-vue components in `app/components/ui`, TanStack Query for server state.
- `packages/core`: domain logic. `@myvgc/core` loads Showdown's data (about 900 KB gzipped), so the web app imports only `@myvgc/core/schema` and gets display names from the API.
- `e2e`: the Playwright smoke test, run against the built image in Compose.

## Commands

- `pnpm db:up`: start Postgres for development (needs a `.env` copied from `.env.example`).
- `pnpm dev`: run the API (port 3001) and the web app (port 3000, proxying `/api`).
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`: what CI runs. `pnpm test` ends with `pnpm test:scripts`, the tests for `scripts/`.
- `pnpm up:local`: build the image from this checkout and start it with Postgres (`compose.yaml` plus `compose.build.yaml`). Plain `compose.yaml` pulls the published GHCR image.
- `pnpm accuracy`: the image reader against the real model on the fixtures in `apps/api/test/reading-fixtures` (costs money, needs `ANTHROPIC_API_KEY`; `--repeat n` runs each case n times). Never in CI. `pnpm --filter @myvgc/e2e reading-fixtures <folder> <team>` remakes a Team's fixtures from screenshots.
- `pnpm smoke`: the Playwright smoke test against a running app (default `http://localhost:3000`).
- Releases: pushing a tag such as `v0.1.0` runs the smoke test, then publishes `ghcr.io/jobanmendpara/myvgc:0.1.0` and `:latest`.

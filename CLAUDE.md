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
- **Close the finished issue, and only that one.** In the PR body, write "Closes DEV-N" for the issue the PR finishes, so Linear closes it on merge. Before any issue the work doesn't finish, in a PR body or commit message, write "Related to" or "Part of", never close, fix or resolve in any form: Linear's GitHub integration reads those words right before an identifier as a closing keyword, even after "doesn't".
- **Decisions**: the ADR in `docs/adr/` is the source of truth. When you add or change one, mirror it as a document in the MyVGC project titled "ADR N: <title>", starting with a line naming the repo file. A decision still to be made is an issue labelled Decision.

## Shipping

- **Branch off `origin/main`.** When you open the PR, compare your files with `origin/main`'s newer commits (after `git fetch`, `git diff --name-only HEAD...origin/main`; the three dots compare from the merge base); rebase only if they overlap.
- **Queue the merge** straight after `gh pr create`: `gh pr merge <n> --auto --merge --delete-branch`. Never run a plain `gh pr merge`: the admin token merges at once and skips the required checks.
- **Wait in the foreground.** Run `scripts/wait-for-checks.sh <n>` again and again until it exits 0 (merged; it prints the merge commit) or 1 (a check failed: fix it and push). Exit 4 means the PR conflicts with `main` (`DIRTY`): rebase onto `origin/main`, push with `--force-with-lease`, and run it again. Exits 2 (still pending) and 3 (a `gh` error) mean run it again. Exit 5 means the PR changes a risky path and the `risky-change-gate` check is waiting on the maintainer's `approved` label: stop waiting and tell the maintainer, since adding the label merges it.
- **History** of this flow is in `docs/wiki/shipping-flow.md`.

## Layout

- `apps/api`: Hono API. `src/app.ts` builds the app (tests call it directly); `src/server.ts` runs migrations and starts the Node server. Migrations live in `apps/api/drizzle` (generate with `pnpm --filter @myvgc/api db:generate`) and run on start-up.
- `apps/web`: Nuxt (`ssr: false`), shadcn-vue components in `app/components/ui`, TanStack Query for server state.
- `packages/core`: domain logic. `@myvgc/core` loads Showdown's data (about 900 KB gzipped), so the web app imports only `@myvgc/core/schema` and gets display names from the API.
- `e2e`: the Playwright smoke test, run against the built image in Compose.

## Commands

- `pnpm db:up`: start Postgres for development (needs a `.env` copied from `.env.example`).
- `pnpm dev`: run the API (port 3001) and the web app (port 3000, proxying `/api`).
- `pnpm preview`: run this checkout's app to look at UI changes, from any worktree. It starts in the background on free ports with a throwaway database, signs up a User with a Team, prints the address and login, and never touches the dev database or ports 3000/3001. `pnpm screenshots [path...]` saves each whole page, scrolling panes included, at phone and desktop width to `.preview/screenshots` (no path: the Team), once images have loaded or failed; a shot taller than 1,600 px is also saved as `.partN.png` slices to read. Options before the first path apply to every path; options after a path apply to it alone. `--click <text>` clicks the element with that exact text or accessible name first, in order (List styles too: `--click Grouped`); when several match, the error names a `--within <region>` or `--nth <n>` for each, to put before the `--click`. To open a picker on a build page, click its field's label: `pnpm screenshots /teams/new/build --nth 1 --click "Add a Pokémon" --click "Held item"` (on a saved build, `--nth 3 --click Change` first; `docs/wiki/preview.md` has the order). `--sprite-style <inline|leading-slot|stacked-tiles>`, `--type-icon-style <compact|badges|labelled>` and `--move-layout <one-column|two-columns>` store the page's Display options before it loads: `pnpm screenshots --sprite-style stacked-tiles /teams/<id>/edit /opponents`; open the dialog with `--click "Display options for Teams"`. Add `--dark` for the dark theme and `--2x` for 2× pixel ratio; `--help` lists the options. File names include the options and the page's Display options, defaults too, so runs don't overwrite each other. Both widths of a path are saved, or neither. A shot with a dialog open shows just the window, grown to hold the whole dialog. Stop with `pnpm preview:stop`.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`: what CI runs. `pnpm test` ends with `pnpm test:scripts`, the tests for `scripts/`.
- `pnpm up:local`: build the image from this checkout and start it with Postgres (`compose.yaml` plus `compose.build.yaml`). Plain `compose.yaml` pulls the published GHCR image.
- `pnpm accuracy`: the image reader against the real model on the fixtures in `apps/api/test/reading-fixtures` (costs money, needs `ANTHROPIC_API_KEY`; `--repeat n` runs each case n times). Never in CI. `pnpm --filter @myvgc/e2e reading-fixtures <folder> <team>` remakes a Team's fixtures from screenshots.
- `pnpm smoke`: the Playwright smoke test against a running app (default `http://localhost:3000`).
- Releases: pushing a tag such as `v0.1.0` runs the smoke test, then publishes `ghcr.io/jobanmendpara/myvgc:0.1.0` and `:latest`.

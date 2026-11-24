# Preview

How agents run the app and look at it, from any checkout. Added by [DEV-184](https://linear.app/mendpara/issue/DEV-184) in PR #296, merged 2026-11-23 as `jobanmendpara/myvgc@efba1bf`. Facts below are from the DEV-184 implementer's report, 2026-11-23, and describe the code as of `jobanmendpara/myvgc@efba1bf`.

## Why

On 2026-11-23 the DEV-180 agent shipped three Sprite styles without seeing them in a browser: the dev servers run from the main checkout, and the smoke test would have written a test user into the dev database. See [sprites rollout](sprites-rollout.md) and [up:local shares the dev DB](up-local-shares-dev-db.md).

## What it does

- `pnpm preview` starts the app from the current checkout; `pnpm preview status` shows what is running; `pnpm screenshots [path...]` takes screenshots; `pnpm preview:stop` stops it.
- It picks free ports in the range 3100 to 3999, so several worktrees can preview at once without touching ports 3000 and 3001.
- The API runs from `apps/api/scripts/preview-server.ts` against an in-memory PGlite database. It never reads `.env`, so it cannot reach the dev Postgres.
- The web app runs under `nuxt dev`, pointed at the API by `API_PORT`.
- State lives in `.preview/state.json`, which git ignores.
- The database is seeded with the User `preview@example.com`, who has a Team.
- Screenshots are taken at 375 and 1280 px wide and saved to `.preview/screenshots/`.

## Known gaps

Filed on 2026-11-23:

- [DEV-186](https://linear.app/mendpara/issue/DEV-186): act on the page (tap, type) before a shot, and capture a pane's full height.
- [DEV-187](https://linear.app/mendpara/issue/DEV-187): the root `scripts/` folder isn't typechecked. The editor showed a type error in `scripts/preview.test.ts` at line 24 that `pnpm typecheck` didn't catch.

Related: [up:local shares the dev DB](up-local-shares-dev-db.md), [sprites rollout](sprites-rollout.md), [parallel agents](parallel-agents.md).

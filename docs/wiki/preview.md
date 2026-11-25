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
- The database is seeded with the User `preview@example.com`. Since [DEV-197](https://linear.app/mendpara/issue/DEV-197) (2026-11-24) `apps/api/scripts/preview-seed.ts` seeds it through the app's routes before the API listens: three Teams (the Worlds 2026 winner's, one with long species names, one with Cramorant-Gulping, which has no Sprite file), a Tournament in the current Regulation with three Rounds, Games with Brought and Leads, and a Bye, and three Opponents with Opponent's Teams. `/statistics` has rows without a query. `pnpm preview` prints a path for each seeded page. `apps/api/test/preview-seed.test.ts` runs the seed against a fresh PGlite.
- Species the API turned down for the seed on 2026-11-23: Urshifu, Amoonguss, Tornadus and Ogerpon-Hearthflame. Meloetta-Pirouette has no Sprite but is Mythical, so illegal in Reg M-C.
- Since [DEV-199](https://linear.app/mendpara/issue/DEV-199) (2026-11-24) the seed also has a fourth played Round against Riley Park, whose Opponent's Team has an item, ability, Nature and four moves on each Pokémon, and whose Leads include Cramorant-Gulping, so Statistics has a Lead pair with no Sprite. `pnpm preview` prints that Opponent and that Round.
- Screenshots are taken at 375 and 1280 px wide and saved to `.preview/screenshots/`. Since DEV-199, `--dark` takes a shot in the dark theme (stored as `myvgc-mode`, as the theme Device setting is), `--2x` takes it at 2× pixel ratio, and `--help` prints the usage and exits 0.

## Known gaps

Filed on 2026-11-23:

- [DEV-186](https://linear.app/mendpara/issue/DEV-186): act on the page (tap, type) before a shot, and capture a pane's full height. (Closed 2026-11-24: DEV-198's `--click` and 1,600 px slices cover it, see "Changes" below.)
- [DEV-187](https://linear.app/mendpara/issue/DEV-187): the root `scripts/` folder isn't typechecked. The editor showed a type error in `scripts/preview.test.ts` at line 24 that `pnpm typecheck` didn't catch. (Closed 2026-11-24: PR #300 typechecks the root scripts, `jobanmendpara/myvgc@7777f1c`, merged 01:32 UTC; Linear moved by hand, see [shipping flow](shipping-flow.md).)
- Gaps found by [DEV-183](https://linear.app/mendpara/issue/DEV-183) on 2026-11-23 (seeding by hand, no clicks, no dark theme) were filed as DEV-197 and DEV-198 and closed on 2026-11-24, see "Changes" below.

## Changes

From the implementers' reports, 2026-11-24. Times are merge times from `gh pr view`, UTC, 2026-11-24.

- [DEV-197](https://linear.app/mendpara/issue/DEV-197), PR #314, 09:43, `jobanmendpara/myvgc@6768984`: the seed runs through `app.request()` in `apps/api/scripts/preview-seed.ts`, from `seed.json`, and `pnpm preview` prints the seeded pages (the seed is described under "What it does" above). PR #316, 09:51, `jobanmendpara/myvgc@a0e0ce8`, added a hint at start-up.
- [DEV-198](https://linear.app/mendpara/issue/DEV-198), PR #315, 09:43, `jobanmendpara/myvgc@096d460`: `pnpm screenshots --click` clicks labels before a shot, `--sprite-style` picks the Sprite style, shots wait for images to load, file names are unique with a hash, tall pages are cut into 1,600 px slices, and the root script runs `node` directly.
- [DEV-199](https://linear.app/mendpara/issue/DEV-199), PR #323, 10:12, `jobanmendpara/myvgc@a49030d`: `--dark`, `--2x` and `--help` (exits 0), and the Riley Park Round with Cramorant-Gulping in the Leads and an Opponent's Team with moves (described under "What it does" above). DEV-199 closed on merge, see [shipping flow](shipping-flow.md).

## Screenshots in PRs (2026-11-25)

- Until 2026-11-25 the `pr` skill called screenshots the best Evidence, and agents put them in PR bodies. DEV-213's PR #374 (merged 2026-11-25 as `jobanmendpara/myvgc@fd524c0`) hosted its images on a branch, `screenshots/dev-213`. The same day the [DEV-223](https://linear.app/mendpara/issue/DEV-223) agent uploaded its shots to the Linear issue instead.
- On 2026-11-25 the maintainer decided that PRs no longer embed screenshots, and that no GitHub branch hosts PR images. For a visual change the agent still takes screenshots with `pnpm screenshots` and looks at them itself, then writes in the PR's Evidence section what it checked (widths, themes, Sprite styles, edge cases). When the maintainer may want to see them, the agent attaches them to the Linear issue. The `pr` skill's "Evidence" section says this from 2026-11-25, on the branch `chore/screenshot-standard-2026-11-25`.
- Why, as the maintainer gave it on 2026-11-25: PRs auto-merge with no reviewer (see [shipping flow](shipping-flow.md)), the only maintainer is always logged in to Linear, and images hosted on a branch break once that branch is deleted.
- As of 2026-11-25, [DEV-224](https://linear.app/mendpara/issue/DEV-224), [DEV-225](https://linear.app/mendpara/issue/DEV-225) and [DEV-226](https://linear.app/mendpara/issue/DEV-226) (Backlog) still say in "Done when" that the PR includes screenshots. They were left unedited.

## Tips

From the implementers' reports, 2026-11-24:

- On macOS, `sips --cropOffset 0 0` crops from the middle, not the top left. Use `--cropOffset 1 0`.
- No pixel library is installed. To measure an element, write a short Playwright script.
- The seed's Lead with no Sprite (Cramorant-Gulping) is always the back Sprite of its pair, so DEV-189's fill on the front Sprite hasn't been seen. See [sprites rollout](sprites-rollout.md).

## Known issues

- As of `jobanmendpara/myvgc@a49030d` (2026-11-24), the seeded Tournament starts today, whatever day the seed runs.
- On 2026-11-25 the DEV-213 agent found that `pnpm screenshots /teams/<id>/edit --click Dragonite` stops on the desktop shot, because two elements match there (the list pane and the Team's Pokémon list). The phone shot, taken first, is saved. Filed as [DEV-227](https://linear.app/mendpara/issue/DEV-227) the same day.

Related: [up:local shares the dev DB](up-local-shares-dev-db.md), [sprites rollout](sprites-rollout.md), [parallel agents](parallel-agents.md).

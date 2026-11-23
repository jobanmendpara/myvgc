# Sprites rollout

On 2026-11-23 the chief-of-staff ran agents on the four Sprite issues: [DEV-177](https://linear.app/mendpara/issue/DEV-177), [DEV-178](https://linear.app/mendpara/issue/DEV-178), [DEV-179](https://linear.app/mendpara/issue/DEV-179) and [DEV-180](https://linear.app/mendpara/issue/DEV-180), from the Map [DEV-168](https://linear.app/mendpara/issue/DEV-168). The decision is ADR 29 (`docs/adr/0029-sprites-from-pokeapi-champions-icons.md`), which stays the source of truth. Each agent ran in its own worktree. Facts below are from the implementers' reports and the chief-of-staff, 2026-11-23, unless marked otherwise.

In order of merge (times from `gh pr view`, UTC, 2026-11-23):

| Issue | What | PR | Merged | Merge commit |
| --- | --- | --- | --- | --- |
| DEV-177 | Commit the Sprite files, with their notice and disclaimer | #284 | 20:37 | `jobanmendpara/myvgc@37fe54d` |
| DEV-179 | Keep every Sprite on the device for offline use | #288 | 20:47 | `jobanmendpara/myvgc@9c5b863` |
| DEV-178 | Show a Sprite next to every species, in the Inline style | #287 | 20:49 | `jobanmendpara/myvgc@02de6a8` |
| DEV-180 | Let the User pick a Sprite style for each page | #289 | 21:09 | `jobanmendpara/myvgc@ba167d6` |

Two PRs from other work merged in the same window and touched this round: DEV-46's PR #283 (installable offline app shell) at 20:21 as `jobanmendpara/myvgc@f209c7a`, and DEV-45's PR #282 at 20:38 as `jobanmendpara/myvgc@0d89acf`.

## What each changed

- As of `jobanmendpara/myvgc@37fe54d` (DEV-177), `packages/core/src/sprites.ts` holds a table of 382 rows, 360 generated and 22 by hand, from PokeAPI/sprites pinned at commit `c0542f7c`. `pnpm sprites:update` (`packages/core/scripts/update-sprites.ts`, using sharp) regenerates the files: 382 WebP images at 96×96, quality 80, 1,373,174 bytes in all. That is over ADR 29's "well under 1 MB", filed as [DEV-182](https://linear.app/mendpara/issue/DEV-182). `static.ts` now answers 404 for a missing Sprite.
- The research note's hand rows missed Maushold: Showdown's base form is Family of Three, while PokeAPI's 925 is Family of Four. The DEV-177 agent caught it.
- As of `jobanmendpara/myvgc@02de6a8` (DEV-178), `Sprite.vue` renders a Sprite, `apps/web/app/lib/sprites.ts` holds `SPRITE_SIZES` by style and surface, and `useSpriteStyle` is the seam DEV-180 later filled. ADR 29 was amended in place, and its Linear ADR document was mirrored.
- As of `jobanmendpara/myvgc@9c5b863` (DEV-179), Workbox's `globPatterns` include `sprites/*.webp` and `/sprites/` is in `navigateFallbackDenylist`. The precache went from 108 entries (875.72 KiB) to 490 (2216.71 KiB). The smoke test's offline case loads a Sprite the page hadn't shown before.
- As of `jobanmendpara/myvgc@ba167d6` (DEV-180), the User picks a Sprite style for each page (Teams, Opponents, Tournaments, Statistics) with `SpriteStyleButton.vue`, stored in `localStorage` under `myvgc-sprite-styles`.

## How it ran

- DEV-177: DEV-46's PR #283 merged while #284's CI ran and conflicted with it. `scripts/wait-for-checks.sh` only reported "auto-merge still pending" and never said the PR had a conflict. Filed as [DEV-181](https://linear.app/mendpara/issue/DEV-181). See [shipping flow](shipping-flow.md).
- DEV-178 started in parallel with DEV-177, then waited about 45 minutes for #284 to merge before opening its PR, and rebased with no conflict. Its first poll for the blocker, `gh pr list --search DEV-177`, also matched the old merged wiki PRs #202 and #207, so it stopped at once. Briefs should name the blocker's PR number or branch, not its issue identifier.
- DEV-179 was blocked by DEV-46, which another session built (PR #283); the user said to wait for it. Before #284 merged, the web build failed under Workbox's `globStrict`, because `sprites/*.webp` matched no file yet. It rebased twice, onto #284 and then onto DEV-45's PR #282, which touched `smoke.spec.ts`, both with no conflict.
- DEV-180: the first smoke run failed because tapping a style closed the dialog before the radio applied it. The fix went into the label's click handler (`jobanmendpara/myvgc@66350f1`).
- The DEV-180 agent never saw the layouts in a browser: the dev server runs from the main checkout, and the smoke test would have written a test user into the dev database. Filed as [DEV-183](https://linear.app/mendpara/issue/DEV-183) (look at every style) and [DEV-184](https://linear.app/mendpara/issue/DEV-184) (agents run the app from a worktree and take screenshots).
- DEV-177 and DEV-178 hit the 5-hour usage limit early, and SendMessage resumed both after the reset with their work intact. See [parallel agents](parallel-agents.md), "Environment on 2026-11-23".

## Not filed

The chief-of-staff's call, 2026-11-23:

- A check that the precache is complete: DEV-177's test already fails when a Sprite file is missing.
- The `NUXT_B2010` warning from `@vite-pwa/nuxt`.

## Open question

For the maintainer, 2026-11-23: should `TournamentTeam.vue`, `OpponentTimeline.vue`, `StatisticsCounted.vue` and the `BuildEditor` heading also show Sprites?

Related: [shipping flow](shipping-flow.md), [parallel agents](parallel-agents.md).

# Icons rollout

Item icons and Type icons in v0.3.0: DEV-222, DEV-224, DEV-225 and DEV-226 (Map [DEV-214](https://linear.app/mendpara/issue/DEV-214), look decided in [DEV-218](https://linear.app/mendpara/issue/DEV-218), prototype branch `prototype/dev-218-type-and-item-icons`). The icon files came first in DEV-221 (`jobanmendpara/myvgc@783d2f6`).

## Plan (2026-11-25)

On 2026-11-25 the maintainer asked the chief-of-staff to finish the four v0.3.0 Backlog issues with agents. The Linear relations at that time:

- DEV-222 (types and move power/accuracy in the names list) blocks DEV-224 and DEV-225.
- DEV-224 (build card) blocks DEV-226 (Display options). Its notes say DEV-224 or DEV-225, whichever lands first, creates the `ItemIcon` and `TypeIcon` components.

The chief-of-staff ran them in two waves, keeping to the maintainer's two or three agents at a time (see [parallel agents](parallel-agents.md), 2026-11-24):

1. DEV-222, and DEV-224 started early against DEV-222's branch (the "start a blocked issue early" pattern from [shipping flow](shipping-flow.md), 2026-11-23). DEV-224 alone creates the two components, so DEV-225 doesn't build a second copy of them.
2. DEV-225 and DEV-226 after DEV-224 merges, both reusing its components.

The third slot in wave 1 went to DEV-227 and DEV-228, two `pnpm screenshots` bugs (see [preview](preview.md)). Without the fixes, the screenshot checks in DEV-224 to DEV-226 (all Sprite styles, pickers open) would need workarounds. DEV-226 will add more stored-setting options next to `--sprite-style`.

## Wave 1 results

- On 2026-11-25 DEV-227 and DEV-228 merged in PR #381 (`jobanmendpara/myvgc@41ee853`), on the first CI run, with no rebase. As of that commit, options before the first path apply to every path, `--within <region> --click <text>` picks one of several matches, and the page settings are one table, `PAGE_SETTINGS` in `e2e/scripts/screenshot-args.ts`, where DEV-226 adds the Type icon style and Move layout (subagent report). Breaking change: `--click X /teams` no longer takes an extra Team shot. DEV-228 had to be closed by hand (see [shipping flow](shipping-flow.md), 2026-11-25).
- On 2026-11-25 DEV-222 merged in PR #380 (`jobanmendpara/myvgc@f1aefc2`). As of that commit `GET /api/names` also returns `typesBySpecies`, `moveTypes` and `powerAndAccuracy` (`{ power, accuracy }`: `null` for varying power or a move that never misses, and no entry for a status move), the 18 types live in `packages/core/src/pokemon-type.ts`, and the web names cache key is v4 (subagent report). The gzipped names list grew from about 23 KB to about 31 KB, over DEV-217's 3 to 5 KB estimate, and the size test's limit went from 25,000 to 32,000 bytes. The smoke test read the cache key by name and broke on the bump; a one-off flake in the same run is in [flaky tests](flaky-tests.md). The chief-of-staff asked the DEV-224 agent to key `TYPE_ICON_NUMBERS` by `TypeId` in its PR.
- On 2026-11-25 DEV-224 merged in PR #384 (`jobanmendpara/myvgc@2d3f404`), opened after DEV-222 merged, and rebased. As of that commit it adds `ItemIcon.vue`, `TypeIcon.vue`, helpers in `apps/web/app/lib/icons.ts`, and `useBuildCardDisplay.ts` fixed at Compact and One column for DEV-226 to make choosable (subagent report). The worktree guard refused a `git ls-remote` loop, so the agent polled DEV-222's branch with `gh api`. Linear returned a 502 once while it attached a screenshot.
- On 2026-11-25 DEV-225 was started early against DEV-224's branch, as DEV-224 had been against DEV-222's. DEV-226 waited for DEV-224 to merge, because both rewrite `PokemonBuildCard.vue`, and started straight after. Its brief told it to stay out of `NamePicker.vue`, DEV-225's file.
- On 2026-11-25 DEV-225 merged in PR #386 (`jobanmendpara/myvgc@4a6d211`), opened after DEV-224 merged, and rebased cleanly. It used DEV-224's components unchanged. The Type icon puts the type at the start of a move option's accessible name ("Normal Fake Out"), so the smoke test's `pick` helper now matches by text (subagent report). Its picker screenshots needed a one-off script ([DEV-232](https://linear.app/mendpara/issue/DEV-232), see [preview](preview.md)).
- On 2026-11-25 DEV-226 merged in PR #388 (`jobanmendpara/myvgc@fae9b31`) on its first CI run, after a clean rebase over DEV-225's smoke test change. As of that commit the header's Sprite style button is `DisplayOptionsButton.vue`, and the Type icon style and Move layout are stored per page under two new keys, `myvgc-type-icon-styles` and `myvgc-move-layouts`. The agent chose not to use one stored object per page, which the issue had suggested, so that stored Sprite styles didn't need migrating. `pnpm screenshots` gained `--type-icon-style` and `--move-layout` as `PAGE_SETTINGS` entries (subagent report).
- Unlike the prototype, a tap in the Display options dialog no longer closes it, so all three choices can be made in one visit. As of 2026-11-25 the maintainer has not confirmed this.
- Follow-ups filed on 2026-11-25: [DEV-233](https://linear.app/mendpara/issue/DEV-233) (Labelled with Stacked tiles wraps long item names at desktop width, as the prototype did) and [DEV-234](https://linear.app/mendpara/issue/DEV-234) (a dialog shot shows only the part in view). The longer shot names, now carrying three settings, were not filed.
- On 2026-11-25 DEV-233 merged in PR #404 (`jobanmendpara/myvgc@824b7ab`); see the [2026-11-25 Follow-ups round](followups-round-2026-11-25.md). As of that commit the Labelled pills sit in a row under the item in every Sprite style. This supersedes, for Labelled, DEV-226's "pills stacked at the top right" from the DEV-218 decision.

## Outcome

On 2026-11-25 all four issues had merged, in the order DEV-222, DEV-224, DEV-225, DEV-226, each on its first or second CI run. Starting DEV-224 and DEV-225 early against their blocker's branch worked again, and no two agents wrote the same component. The round also filed DEV-229 to DEV-234.

Related: [sprites rollout](sprites-rollout.md), [preview](preview.md), [shipping flow](shipping-flow.md).

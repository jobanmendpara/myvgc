# Refactor round, 2026-11-18

On 2026-11-18 the chief-of-staff ran agents on three Refactor issues: DEV-148 and DEV-149, filed after the [2026-11-17 Refactor round](refactor-round-2026-11-17.md), and DEV-153, filed after DEV-131 (see [team reading rollout](team-reading-rollout.md)). Three ran in parallel, one per issue, each in its own worktree. All three merged on their first CI run, with no rebase.

In order of merge (times from `gh pr view`, UTC):

| Issue | What | PR | Merged | Merge commit |
| --- | --- | --- | --- | --- |
| DEV-153 | Pick the accuracy check's model through the app's rule | #227 | 16:02 | `jobanmendpara/myvgc@7ea1221` |
| DEV-148 | Build Team and Opponent links in one place | #226 | 16:03 | `jobanmendpara/myvgc@6e1334e` |
| DEV-149 | Share one Team fields form section between the paste page and the Team builder | #228 | 16:04 | `jobanmendpara/myvgc@94dffd9` |

Linear showed all three Done on 2026-11-18, each within seconds of its merge.

## What each changed

- As of `jobanmendpara/myvgc@7ea1221` (DEV-153), `apps/api/src/config.ts` exports `teamReaderModel(env)`, which reads `TEAM_READER_MODEL` with the same schema `loadConfig` uses, and `apps/api/test/reading.accuracy.ts` calls it. It calls `teamReaderModel` rather than `loadConfig`, because `loadConfig` also needs settings the check has no use for. The agent didn't run `pnpm accuracy`, and PR #227 says why: the change touches none of the things CLAUDE.md names, and the model chosen is the same for every value of `TEAM_READER_MODEL`.
- As of `jobanmendpara/myvgc@6e1334e` (DEV-148), `apps/web/app/lib/paths.ts` has `teamPath`, `editTeamPath` and `opponentPath`, and `ListRows.vue` takes a `path` function in place of a `base`. The hand-built Team and Opponent links in `TournamentTeam`, `TeamBuilder`, `teams/new/paste`, the Team pages, the dashboard and `opponents` use them. List roots and `/api/...` URLs were left as they were.
- As of `jobanmendpara/myvgc@94dffd9` (DEV-149), `apps/web/app/components/TeamFieldsSection.vue` renders a Team's name, Regulation, Replica Team ID and notes, with a slot for the paste or the Pokémon builds. `TeamBuilder.vue` and `teams/new/paste.vue` both use it. The paste page's notes now have the Team builder's length limit and show the API's notes error, which they didn't before.

## How it ran

From the implementers' reports and the chief-of-staff, 2026-11-18:

- All three agents ran in parallel. Each PR merged on its first CI run, and none rebased. This is the second round in a row to do so, after the [2026-11-17 round](refactor-round-2026-11-17.md).
- DEV-148 and DEV-149 both edited `apps/web/app/components/TeamBuilder.vue` and `apps/web/app/pages/teams/new/paste.vue`, in different lines. PR #228's body notes that it left the `navigateTo` lines to DEV-148.
- Known gap, 2026-11-18: branch protection has `strict: false` (see [shipping flow](shipping-flow.md), "Branch protection and auto-merge"), so neither PR's CI ran on the other's change. The first CI run on the combined code was `main`'s run for `jobanmendpara/myvgc@94dffd9`: `check` passed, and `smoke` was skipped, because it doesn't run on pushes to `main`. `main`'s run for `jobanmendpara/myvgc@6e1334e` was cancelled when `94dffd9` landed a few seconds later (`gh run list`). So no smoke test ran on the combined Team builder and paste page that day.
- The worktree guard refused compound commands that included git. See [parallel agents](parallel-agents.md), "Environment on 2026-11-18".
- SSH push worked for all three agents. Compare 2026-11-17, when all three were refused.
- `scripts/wait-for-checks.sh` needed 3 to 4 calls per agent, at about 125 seconds a call. None ran past the 180-second limit, as two did on 2026-11-17 before DEV-147.
- One agent reported that its `save_issue` call to move its issue to In Progress seemed not to take. On 2026-11-18 Linear showed a start time for all three issues (15:53 UTC), so each did reach In Progress at some point.

## Follow-ups

Raised by the agents on 2026-11-18, not filed in Linear that day:

- From DEV-148 (PR #226): the remaining hand-built list and new-Team links, and `ListDetail`'s `base`.
- From DEV-149 (PR #228): a render test for `TeamFieldsSection`.
- From DEV-153 (PR #227): a test of the price table. It belongs in [DEV-152](https://linear.app/mendpara/issue/DEV-152) (show the cost of an accuracy run for any model), which Linear showed in Backlog on 2026-11-18.

Related: [2026-11-17 Refactor round](refactor-round-2026-11-17.md), [2026-11-15 Refactor round](refactor-round-2026-11-15.md), [parallel agents](parallel-agents.md), [shipping flow](shipping-flow.md), [team reading rollout](team-reading-rollout.md).

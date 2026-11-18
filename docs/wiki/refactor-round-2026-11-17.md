# Refactor round, 2026-11-17

On 2026-11-17 the user asked the chief-of-staff to run agents on the new Refactor issues filed after the [2026-11-15 Refactor round](refactor-round-2026-11-15.md). Three ran, one per issue, each in its own worktree. All three merged on their first CI run, with no rebase.

In order of merge:

| Issue | What | PR | Merge commit |
| --- | --- | --- | --- |
| DEV-139 | Build Tournament links in one place | #212 | `jobanmendpara/myvgc@95f2c43` |
| DEV-142 | Tidy up the S3 storage settings | #213 | `jobanmendpara/myvgc@1de3948` |
| DEV-140 | Hold the paste page's Team fields as `TeamFields` | #214 | `jobanmendpara/myvgc@e3fa59c` |

## What each changed

- As of `jobanmendpara/myvgc@95f2c43` (DEV-139), `apps/web/app/lib/paths.ts` builds Tournament and Round links: `tournamentPath`, `editTournamentPath`, `newRoundPath`, and `roundPath`, moved there from `format.ts`.
- As of `jobanmendpara/myvgc@1de3948` (DEV-142), `S3Options.credentials` holds the access key pair, so the rule that both are set together is checked once. The type-only import loop between `config.ts` and `storage.ts` is gone, and `S3_REGION` is refused without a bucket. The agent updated ADR 27 and its Linear mirror.
- As of `jobanmendpara/myvgc@e3fa59c` (DEV-140), `apps/web/app/lib/team-form.ts` has `newTeamFields()`, and `teams/new/paste.vue` holds its fields as `reactive<TeamFields>`.

## How it ran

From the implementers' reports and the chief-of-staff, 2026-11-17:

- All three PRs merged on their first CI run, and none rebased. This is the first round run under the 2026-11-15 rebase rule and auto-merge (see [shipping flow](shipping-flow.md), "Branch protection and auto-merge"). Compare the 2026-11-15 round, where DEV-113 alone rebased 4 times and had 5 CI runs.
- The chief-of-staff held DEV-140 until the user's PR #210 (DEV-138, merged as `jobanmendpara/myvgc@676f6e4`) had merged, because both touched the same files. DEV-139 and DEV-142 started at once.
- The briefs were shorter than on 2026-11-15, because CLAUDE.md now has a Shipping section. They also asked agents to test only the affected packages and to write test logs to the scratchpad before filtering them (as DEV-144 asks).
- All three agents' SSH pushes were refused, and each used the HTTPS workaround in [parallel agents](parallel-agents.md). The DEV-139 agent's SSH fetch worked before its push was refused.
- `scripts/wait-for-checks.sh` ran past the 180-second foreground limit for DEV-139, and one call for DEV-142 took about 11 minutes. A fix was in progress on 2026-11-17 as DEV-147; its history will be in [shipping flow](shipping-flow.md). (Superseded 2026-11-18: DEV-147 merged in PR #221, `jobanmendpara/myvgc@a7693f0`, and Linear shows it Done; its history is in [shipping flow](shipping-flow.md), "Waiting for CI".)
- The DEV-142 agent's first local API test run had 7 tests time out at 30 s, all passing on a rerun. It kept the full log, so the cause is confirmed as timeouts on a busy machine. See [flaky tests](flaky-tests.md). Added to [DEV-146](https://linear.app/mendpara/issue/DEV-146) as evidence on 2026-11-17.

## Follow-ups

Filed in Linear on 2026-11-17, all in Backlog that day:

- [DEV-148](https://linear.app/mendpara/issue/DEV-148) (Refactor, from DEV-139, PR #212): `teamPath()` and `opponentPath()` in `paths.ts`, a path function for `ListRows.vue` in place of `${base}/${item.id}`, and the other hand-built Team and Opponent links, such as in `TournamentTeam.vue`.
- [DEV-149](https://linear.app/mendpara/issue/DEV-149) (Refactor, from DEV-140, PR #214): one Team fields form section shared by `paste.vue` and the Team builder, so a new Team field's input is added in one place.
- [DEV-150](https://linear.app/mendpara/issue/DEV-150) (Improvement, from DEV-140, PR #214): the smoke test checks that notes and Replica Team ID entered on the paste page reach the saved Team.
- [DEV-151](https://linear.app/mendpara/issue/DEV-151) (Chore, from DEV-142, PR #213): say in the next release's notes that `S3_REGION` set without `S3_BUCKET` now refuses to start.
- On 2026-11-18 Linear showed DEV-148 to DEV-151 still in Backlog.

Related: [2026-11-15 Refactor round](refactor-round-2026-11-15.md), [parallel agents](parallel-agents.md), [shipping flow](shipping-flow.md), [flaky tests](flaky-tests.md).

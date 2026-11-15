# Refactor round, 2026-11-15

On 2026-11-15 the user asked the chief-of-staff to run one agent for each open Refactor issue in MyVGC that had no blockers. Five ran in parallel, one per worktree. All five merged with `check` and `smoke / smoke` green and no merge conflicts.

In order of merge:

| Issue | What | PR | Merge commit |
| --- | --- | --- | --- |
| DEV-127 | Share sign-up and Tournament setup across the smoke tests | #191 | `jobanmendpara/myvgc@b535004` |
| DEV-116 | Drive the Statistics tables from one list | #194 | `jobanmendpara/myvgc@3154112` |
| DEV-109 | List a Team's fields in one place | #193 | `jobanmendpara/myvgc@facb7e1` |
| DEV-110 | Gather the S3 storage settings into one group | #192 | `jobanmendpara/myvgc@16c5b11` |
| DEV-113 | Build Round links in one place | #190 | `jobanmendpara/myvgc@946dac7` |

## What each changed

- As of `jobanmendpara/myvgc@b535004` (DEV-127), `e2e/tests/smoke.spec.ts` has `signUp` and `createTournament` helpers.
- As of `jobanmendpara/myvgc@3154112` (DEV-116), the Statistics response has `user` and `opponent` groups (`SideStatistics`), and the page's tables come from `apps/web/app/lib/statistics-tables.ts`. No ADR covered the response shape.
- As of `jobanmendpara/myvgc@facb7e1` (DEV-109), `packages/core/src/team.ts` has `teamFieldsSchema`, `pickTeamFields` and `BLANK_TEAM_FIELDS`.
- As of `jobanmendpara/myvgc@16c5b11` (DEV-110), the API config has one `s3` group, and `S3_FORCE_PATH_STYLE` is refused without a bucket. The agent also updated ADR 27 and its Linear mirror.
- As of `jobanmendpara/myvgc@946dac7` (DEV-113), Round links are built by `roundPath()` in `apps/web/app/lib/format.ts`.

## How it ran

- DEV-127 merged first, so it didn't rebase. It ran the smoke stack off the default ports as Compose project `myvgc-dev127` on port 3427, and reported no environment trouble.
- DEV-116 rebased once, DEV-109 and DEV-110 twice each, all cleanly. DEV-113 merged last and rebased and force-pushed three times; each CI round took about 5 to 6 minutes.
- Five Opus implementers ran at once without hitting the session limit (compare 2026-11-11 in [parallel agents](parallel-agents.md)).
- Every agent merged its own PR; none was refused `gh pr merge`. The same day auto mode refused the chief-of-staff's merge of wiki PR #177, which was still open when this page was written.
- The environment facts the agents reported (the worktree guard, `pnpm test` past 180 s, branch cleanup) are in [parallel agents](parallel-agents.md). DEV-113's 4 API test failures that passed on a rerun are in [flaky tests](flaky-tests.md).
- Linear had moved DEV-127 to In Progress only because wiki PR #177 mentioned it. At 15:46 UTC on 2026-11-15, after PR #191 merged, DEV-127 still read In Progress.

## Follow-ups

Filed in Linear on 2026-11-15, all in Backlog that day:

- [DEV-139](https://linear.app/mendpara/issue/DEV-139) (Refactor, from DEV-113): a `tournamentPath()` helper for the hand-built Tournament links, the "Log Round" link in `TournamentRounds.vue`, and the path helpers moved into `app/lib/paths.ts`.
- [DEV-140](https://linear.app/mendpara/issue/DEV-140) (Refactor, from DEV-109): `teams/new/paste.vue` holds its fields as `TeamFields`, starting from `BLANK_TEAM_FIELDS`.
- [DEV-141](https://linear.app/mendpara/issue/DEV-141) (Improvement, from DEV-116): check Statistics responses against a shared Zod schema.
- [DEV-142](https://linear.app/mendpara/issue/DEV-142) (Refactor, from DEV-110): the type-only import loop between `config.ts` and `storage.ts`, the access key and secret pairing rule checked in three places, and refusing `S3_REGION` without a bucket.
- [DEV-143](https://linear.app/mendpara/issue/DEV-143) (Decision, from DEV-116): a glossary term for the Statistics tables' third column, the field now called `outcome`.
- [DEV-144](https://linear.app/mendpara/issue/DEV-144) (Chore): a bounded way for agents to run the full test suite, like `scripts/wait-for-checks.sh`.

Not filed: the DEV-127 agent also suggested a start-date parameter for its smoke-test helpers.

Related: [parallel agents](parallel-agents.md), [shipping flow](shipping-flow.md), [flaky tests](flaky-tests.md), [statistics rollout](statistics-rollout.md), [2026-11-12 Todo round](todo-round-2026-11-12.md).

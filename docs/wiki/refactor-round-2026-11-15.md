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
- DEV-116 rebased once, DEV-109 and DEV-110 twice each, all cleanly. The DEV-113 agent reported that it merged last after three rebases and force-pushes, each CI round taking about 5 to 6 minutes. (Superseded 2026-11-15 by the DEV-113 retro, see below.)

## DEV-113 retro (2026-11-15)

From the chief-of-staff's retro on the DEV-113 implementer's transcript (subagent report, 2026-11-15):

- DEV-113 rebased 4 times, not 3, and PR #190 had 5 CI runs. It opened first and merged last; each of the other four merges moved `main` under it. All 4 rebases were clean.
- The run took about 40 minutes, about 32 of them shipping. Its first green came at about 14 minutes in, and merging then would have ended the run there.
- The trigger was the brief's "if main moves under you, rebase and re-run CI", backed by the "whichever PR merges second rebases onto main" line in [parallel agents](parallel-agents.md). `main` has no branch protection, so GitHub never required those rebases. (Superseded 2026-11-15: branch protection and auto-merge were applied later that day, see [shipping flow](shipping-flow.md).)
- On 2026-11-15 the chief-of-staff decided a new rule for when a PR rebases before merging, recorded in [shipping flow](shipping-flow.md) and [parallel agents](parallel-agents.md). The branch protection and auto-merge settings are left for the user to decide. (Superseded 2026-11-15: the user approved both, see [shipping flow](shipping-flow.md).)
- `pnpm test` is CI's critical path at 5m18s, `apps/api` taking 310 s of it (run 43730954370). Filed as [DEV-146](https://linear.app/mendpara/issue/DEV-146).
- Five Opus implementers ran at once without hitting the session limit (compare 2026-11-11 in [parallel agents](parallel-agents.md)).
- Every agent merged its own PR; none was refused `gh pr merge`. The same day auto mode refused the chief-of-staff's merge of wiki PR #177, which was still open when this page was written. (Superseded 2026-11-16: PR #177 merged on 2026-11-15 as `jobanmendpara/myvgc@c6158e3`, see below.)
- On 2026-11-16 the lint found wiki PR #177 merged on 2026-11-15 (`jobanmendpara/myvgc@c6158e3`), so the refusal above held only for the chief-of-staff's own merge attempt.
- The environment facts the agents reported (the worktree guard, `pnpm test` past 180 s, branch cleanup) are in [parallel agents](parallel-agents.md). DEV-113's 4 API test failures that passed on a rerun are in [flaky tests](flaky-tests.md).
- Linear had moved DEV-127 to In Progress only because wiki PR #177 mentioned it. At 15:46 UTC on 2026-11-15, after PR #191 merged, DEV-127 still read In Progress.

## Follow-ups

Filed in Linear on 2026-11-15, all in Backlog that day:

- [DEV-139](https://linear.app/mendpara/issue/DEV-139) (Refactor, from DEV-113): a `tournamentPath()` helper for the hand-built Tournament links, the "Log Round" link in `TournamentRounds.vue`, and the path helpers moved into `app/lib/paths.ts`.
- [DEV-140](https://linear.app/mendpara/issue/DEV-140) (Refactor, from DEV-109): `teams/new/paste.vue` holds its fields as `TeamFields`, starting from `BLANK_TEAM_FIELDS`.
- [DEV-141](https://linear.app/mendpara/issue/DEV-141) (Improvement, from DEV-116): check Statistics responses against a shared Zod schema.
- [DEV-142](https://linear.app/mendpara/issue/DEV-142) (Refactor, from DEV-110): the type-only import loop between `config.ts` and `storage.ts`, the access key and secret pairing rule checked in three places, and refusing `S3_REGION` without a bucket.
- [DEV-143](https://linear.app/mendpara/issue/DEV-143) (Decision, from DEV-116): a glossary term for the Statistics tables' third column, the field now called `outcome`.
- [DEV-144](https://linear.app/mendpara/issue/DEV-144) (Chore): a bounded way for agents to run tests locally, like `scripts/wait-for-checks.sh`. Widened the same day after the DEV-113 retro: write the full output to a scratchpad log before filtering it, and run locally only the affected packages, leaving the full suite to CI.
- [DEV-146](https://linear.app/mendpara/issue/DEV-146) (Chore, from the DEV-113 retro): cut CI time for the API tests, by sharding them behind an aggregate job still named `check`, and by profiling the 49 `createTestApp` PGlite boots, each applying 17 migrations.

Not filed: the DEV-127 agent also suggested a start-date parameter for its smoke-test helpers.

Related: [parallel agents](parallel-agents.md), [shipping flow](shipping-flow.md), [flaky tests](flaky-tests.md), [statistics rollout](statistics-rollout.md), [2026-11-12 Todo round](todo-round-2026-11-12.md).

# Todo round, 2026-11-12

On 2026-11-12 the chief-of-staff built the four Todo issues that had been moved out from under DEV-38 (see [team reading rollout](team-reading-rollout.md)).

| Issue | What | PR | Merge commit |
| --- | --- | --- | --- |
| DEV-67 | Store a Replica Team ID on a Team | #147 | `jobanmendpara/myvgc@95a6d7e` |
| DEV-71 | Store Teamsheet attachments in S3-compatible storage | #148 | `jobanmendpara/myvgc@9169d19` |
| DEV-60 | See the Rounds and Games behind a statistic | #149 | `jobanmendpara/myvgc@634fed0` |
| DEV-61 | Statistics on the Opponent's side of Games | #160 | `jobanmendpara/myvgc@319cadd` |

## How it ran

- DEV-67 and DEV-71 picked up unpushed commits that an interrupted earlier session had left in their worktrees, and finished from there.
- DEV-60 and DEV-61 ran one after the other, because both change the Statistics page (see [statistics rollout](statistics-rollout.md)). No more than three implementers ran at once, and the session limit wasn't hit (compare 2026-11-11 in [parallel agents](parallel-agents.md)).
- All four PRs merged with `check` and `smoke / smoke` green on their first run.
- DEV-60 merged after DEV-67 without rebasing onto it. Main's CI passed after both were in.
- The DEV-61 implementer handed back twice before its checks finished, so it didn't merge PR #160 itself. The retro is in [shipping flow](shipping-flow.md).
- The environment facts the implementers reported are in [parallel agents](parallel-agents.md).

## Follow-ups

Filed in Linear on 2026-11-12, all in Backlog that day:

- Replica Team ID: DEV-105 (default the Teamsheet's Battle Team box to it), DEV-106 (fill it when reading a Team), DEV-107 (Decision: does a Tournament's Team snapshot keep it?), DEV-108 (check its validation against real IDs).
- Teams: DEV-109 (list a Team's fields in one place).
- S3 storage: DEV-110 (gather the S3 settings into one group), DEV-111 (check the Teamsheet file name before opening the stored file), DEV-112 (move stored attachments between disk and S3).
- Statistics: DEV-113 to DEV-116, listed in [statistics rollout](statistics-rollout.md).

Related: [statistics rollout](statistics-rollout.md), [team reading rollout](team-reading-rollout.md), [parallel agents](parallel-agents.md), [shipping flow](shipping-flow.md).

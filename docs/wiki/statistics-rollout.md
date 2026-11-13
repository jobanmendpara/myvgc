# Statistics rollout

DEV-56, the Statistics page, and its follow-ups DEV-60 and DEV-61.

| Issue | What | Status (dated) |
| --- | --- | --- |
| DEV-56 | A Statistics page by species faced and by Lead | Merged in PR #88, `jobanmendpara/myvgc@9aa42e3` (2026-11-11) |
| DEV-60 | See the Rounds and Games behind a statistic | Merged in PR #149, `jobanmendpara/myvgc@634fed0` (2026-11-12) |
| DEV-61 | Statistics on the Opponent's side of Games | Merged in PR #160, `jobanmendpara/myvgc@319cadd` (2026-11-12) |

## Notes

- On 2026-11-12 DEV-60 and DEV-61 were found sitting under DEV-38 and moved out to relate to DEV-56 (see [team reading rollout](team-reading-rollout.md)).
- On 2026-11-12 DEV-60 and DEV-61 ran one after the other, not side by side, because both change the Statistics page. See the [2026-11-12 Todo round](todo-round-2026-11-12.md).
- As of `jobanmendpara/myvgc@634fed0` (DEV-60, 2026-11-12), each Statistics row carries `counted` (`{ round }` or `{ round, game }`), the response has a shared `rounds` lookup, and `StatisticsCounted.vue` with `countedListing()` in `apps/web/app/lib/format.ts` lists the Rounds or Games behind a row. It was built so DEV-61 could reuse it for the Opponent's side.
- As of `jobanmendpara/myvgc@319cadd` (DEV-61, 2026-11-12), the page adds tables for the Opponent's Brought Pokémon, the Opponent's Leads and Lead pairs, and how often each species on an Opponent's Team was Brought. They follow DEV-56's counting rules, each has a coverage line, and each row has the DEV-60 click-through. See PR #160 for the details.
- Follow-ups filed on 2026-11-12, all in Backlog that day: DEV-113 (build Round links in one place), DEV-114 (smoke test the Statistics page), DEV-115 (count Brought species missing from a partly recorded Opponent's Team) and DEV-116 (drive the Statistics tables from one list).

Related: [2026-11-12 Todo round](todo-round-2026-11-12.md), [shipping flow](shipping-flow.md).

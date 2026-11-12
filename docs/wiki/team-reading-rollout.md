# Team reading rollout

DEV-38, "Read uploaded PDFs and replica-team screenshots into Teams". The sub-issues are below.

| Issue | What | Status (dated) |
| --- | --- | --- |
| DEV-62 | Read a teamsheet.gg PDF into a Team | Merged in PR #71, `jobanmendpara/myvgc@93b4a27` (merge commit dated 2026-11-09) |
| DEV-63 | Read images (replica-team screenshots) with a vision model | Open on 2026-11-11, waiting on the user's decision about an Anthropic API key |
| DEV-64 | Read a Teamsheet into an Opponent's Team from the Round form | Merged in PR #138, `jobanmendpara/myvgc@eabc54a` (2026-11-11) |
| DEV-65 | Read a stored Teamsheet attachment into a Team | Merged in PR #139, `jobanmendpara/myvgc@4ebfd44` (2026-11-11), after rebasing onto DEV-64 |
| DEV-66 | Read MyVGC's own Teamsheet export back | Merged in PR #137, `jobanmendpara/myvgc@9636f0f` (2026-11-11) |

## Notes

- As of `jobanmendpara/myvgc@9636f0f` (DEV-66, 2026-11-11), no new test was added. The existing writeTeamsheet "reads back as the same Team" test was already the round trip. ADR 24 and its Linear document were amended. Exports drop nicknames and gender and write battle-only forms as their base form, and ADR 24 doesn't claim the export is lossless.
- As of `jobanmendpara/myvgc@eabc54a` (DEV-64, 2026-11-11):
  - The Round form's Their Team section has a "Read their Teamsheet" action.
  - It keeps species, ability, held item and moves, plus flags. It ignores the Battle Team name.
  - It replaces their Team draft, adds back Game picks while there is room, and lists the rest as left out.
  - A read that finishes after the Opponent changes is discarded. Spec review found this.
  - A new shared `useTeamReader` composable is also used by `/teams/new/teamsheet`.
  - Image types go in `TEAM_FILE_TYPES` (web and API), ready for DEV-63.
  - Known: a sheet with flags marks the form dirty.
- As of `jobanmendpara/myvgc@4ebfd44` (DEV-65, 2026-11-11):
  - The API has `POST /api/tournaments/:id/teamsheet/read`. The Tournament page has a "Read into a Team" link to `/teams/new/teamsheet?tournament=<id>`.
  - `useTeamReader` gained an optional `{ tournamentId }` and `readStored()`. The page reads on open or when the connection returns. Cancel goes back to the Tournament.
  - Saving creates a new Team that is not linked to the Tournament. The attachment stays; the CONTEXT.md glossary was updated.
  - It came with 8 API tests and one new smoke test.
- On 2026-11-11 the implementers for DEV-64, 65 and 66 ran at once and hit the session limit. See [parallel agents](parallel-agents.md).

## Gotchas

- Found 2026-11-11 during the DEV-38 work: a comment placed between chained Hono calls makes Prettier re-indent the whole chain, so `pnpm format:check` fails. Put the comment above the chain.

Related: [parallel agents](parallel-agents.md), [shipping flow](shipping-flow.md).

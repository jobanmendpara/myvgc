# Team reading rollout

DEV-38, "Read uploaded PDFs and replica-team screenshots into Teams". The sub-issues are below.

| Issue | What | Status (dated) |
| --- | --- | --- |
| DEV-62 | Read a teamsheet.gg PDF into a Team | Merged in PR #71, `jobanmendpara/myvgc@93b4a27` (merge commit dated 2026-11-09) |
| DEV-63 | Read images (replica-team screenshots) with a vision model | Open on 2026-11-11, waiting on the user's decision about an Anthropic API key. (Superseded 2026-11-12: merged in PR #142, see the notes below.) |
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
- As of `jobanmendpara/myvgc@45590f5` (DEV-63, PR #142, 2026-11-12):
  - The web app has `/teams/new/images`, and the API has an `image_reads` table (migration 0014). The PDF and image readers now share `readBuild`. See PR #142 for the file layout, tests and Merge Danger, and [ADR 24](../adr/0024-reading-teams-from-files.md) for the product choices.
  - It was built against a stubbed model at the user's request. Nothing in tests or CI calls Anthropic. DEV-102 was filed to check image reading against the real Anthropic model, and is still open on 2026-11-12. (Superseded 2026-11-16: Linear shows DEV-102 Done on 2026-11-13; its baseline is in the DEV-118 section below.)
- DEV-38 was closed as Done on 2026-11-12. Four Todo issues had been found sitting under it (last updated 2026-11-12 09:46 UTC, by whom isn't known) and were moved out, not built:
  - DEV-60 and DEV-61 (Statistics follow-ups), now related to DEV-56.
  - DEV-67 (Replica Team ID), related to DEV-38.
  - DEV-71 (S3 storage), related to DEV-38 and DEV-37.
- All four were built later on 2026-11-12: DEV-67 in PR #147 (`jobanmendpara/myvgc@95a6d7e`), DEV-71 in PR #148 (`jobanmendpara/myvgc@9169d19`), and DEV-60 and DEV-61 as in [statistics rollout](statistics-rollout.md). See the [2026-11-12 Todo round](todo-round-2026-11-12.md).
- On 2026-11-11 the implementers for DEV-64, 65 and 66 ran at once and hit the session limit. See [parallel agents](parallel-agents.md).

## Map for real screenshots (DEV-118)

- On 2026-11-13 DEV-118 was charted as a map: build issues plus ADR 24 amendments so image reading works on real Pokémon Champions screenshots. DEV-102's baseline (resolution comment on DEV-102) found the reader read every field it was asked for correctly but lost Stat Alignments, held items and the Replica Team ID without a flag. On 2026-11-13 DEV-125 made Haiku 5.5 the default model. (Corrected 2026-11-16: DEV-125 was the decision, Done on 2026-11-13. Building it is DEV-131, still Todo in Linear on 2026-11-16.)
- On 2026-11-14 and 2026-11-15 the user and the chief-of-staff grilled the map's six questions in this session: DEV-120 (what the reader returns), DEV-121 (Stat Alignment from arrows), DEV-124 (nicknames and species), DEV-122 (image count and shrinking), DEV-123 (the accuracy check) and DEV-126 (flags). Each one's decisions are in its "Resolution" comment, and the map's "Decisions so far" summarises them. The user accepted every recommended answer. On 2026-11-15 DEV-126 changed one of the map's standing notes: the Team's name is left blank with no flag, since no supported screen shows a Battle Team name.
- On 2026-11-15 two issues were filed from the grillings: DEV-128 (the user captures a second fixture Team covering a Rotom form, a neutral Stat Alignment and a female gender form) and the sample requests on DEV-123.
- On 2026-11-15 the ADR 24 amendment for DEV-118 was drafted, before any of it was built. Still open on the map that day: the phone flow, and splitting the build into issues. (Superseded 2026-11-16: the amendment merged on 2026-11-15 in PR #179, `jobanmendpara/myvgc@f12396a`. By 2026-11-16 Linear held the build as DEV-129 to DEV-137, plus DEV-106, which also carries DEV-126's Team-level flags. DEV-129 was In Progress with PR #206 open; the others were Todo.)
- Facts found during the grillings, from the samples in `~/Downloads/temp-vgc-screenshots`: the Replica Team's Stats tab shows stat values and Stat Points with tiny ▲/▼ icons, and has no Battle Team name. A detail screen shows the nickname by the Poké Ball and the species after "No.". The Champions data has three gender forms (Meowstic, Indeedee and Basculegion).
- As of `jobanmendpara/myvgc@e289510`, the web app's `readTeamToDraft` drops any flag whose path isn't a Pokémon. DEV-126 decided Team-level flags get shown.
- On 2026-11-16 the lint found that, as of `jobanmendpara/myvgc@138630b`, `readTeamToDraft` in `apps/web/app/lib/team-form.ts` still keeps only flags whose path starts at a Pokémon, so DEV-126's decision to show Team-level flags isn't built yet in the code. DEV-118's build issues are not in git history up to that commit.

## Gotchas

- Found 2026-11-11 during the DEV-38 work: a comment placed between chained Hono calls makes Prettier re-indent the whole chain, so `pnpm format:check` fails. Put the comment above the chain.

Related: [parallel agents](parallel-agents.md), [shipping flow](shipping-flow.md).

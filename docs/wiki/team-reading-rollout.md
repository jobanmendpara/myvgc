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

- On 2026-11-13 DEV-118 was charted as a map: build issues plus ADR 24 amendments so image reading works on real Pokémon Champions screenshots. DEV-102's baseline (resolution comment on DEV-102) found the reader read every field it was asked for correctly but lost Stat Alignments, held items and the Replica Team ID without a flag. On 2026-11-13 DEV-125 made Haiku 5.5 the default model. (Corrected 2026-11-16: DEV-125 was the decision, Done on 2026-11-13. Building it is DEV-131, still Todo in Linear on 2026-11-16. Superseded 2026-11-18: DEV-131 merged in PR #222, `jobanmendpara/myvgc@3d0b382`, see "Build on 2026-11-17 and 2026-11-18" below.)
- On 2026-11-14 and 2026-11-15 the user and the chief-of-staff grilled the map's six questions in this session: DEV-120 (what the reader returns), DEV-121 (Stat Alignment from arrows), DEV-124 (nicknames and species), DEV-122 (image count and shrinking), DEV-123 (the accuracy check) and DEV-126 (flags). Each one's decisions are in its "Resolution" comment, and the map's "Decisions so far" summarises them. The user accepted every recommended answer. On 2026-11-15 DEV-126 changed one of the map's standing notes: the Team's name is left blank with no flag, since no supported screen shows a Battle Team name.
- On 2026-11-15 two issues were filed from the grillings: DEV-128 (the user captures a second fixture Team covering a Rotom form, a neutral Stat Alignment and a female gender form) and the sample requests on DEV-123.
- On 2026-11-15 the ADR 24 amendment for DEV-118 was drafted, before any of it was built. Still open on the map that day: the phone flow, and splitting the build into issues. (Superseded 2026-11-16: the amendment merged on 2026-11-15 in PR #179, `jobanmendpara/myvgc@f12396a`. By 2026-11-16 Linear held the build as DEV-129 to DEV-137, plus DEV-106, which also carries DEV-126's Team-level flags. DEV-129 was In Progress with PR #206 open; the others were Todo. Superseded 2026-11-18: DEV-129 and DEV-131 have merged, see "Build on 2026-11-17 and 2026-11-18" below.)
- Facts found during the grillings, from the samples in `~/Downloads/temp-vgc-screenshots`: the Replica Team's Stats tab shows stat values and Stat Points with tiny ▲/▼ icons, and has no Battle Team name. A detail screen shows the nickname by the Poké Ball and the species after "No.". The Champions data has three gender forms (Meowstic, Indeedee and Basculegion).
- As of `jobanmendpara/myvgc@e289510`, the web app's `readTeamToDraft` drops any flag whose path isn't a Pokémon. DEV-126 decided Team-level flags get shown. (Superseded 2026-11-18: DEV-106 built it, `jobanmendpara/myvgc@4ca8aa3`, see "DEV-130 and DEV-106 on 2026-11-18" below.)
- On 2026-11-16 the lint found that, as of `jobanmendpara/myvgc@138630b`, `readTeamToDraft` in `apps/web/app/lib/team-form.ts` still keeps only flags whose path starts at a Pokémon, so DEV-126's decision to show Team-level flags isn't built yet in the code. DEV-118's build issues are not in git history up to that commit. (Superseded 2026-11-18 for DEV-129 and DEV-131, see below. The flag filter is unchanged as of `jobanmendpara/myvgc@3d0b382`. Superseded later on 2026-11-18: as of `jobanmendpara/myvgc@4ca8aa3` (DEV-106) the draft keeps Team-level flags, see below.)

## Build on 2026-11-17 and 2026-11-18

From the 2026-11-18 lint, checked against `gh` and Linear:

- DEV-129 (check reading accuracy against fixture screenshots) merged in PR #206 as `jobanmendpara/myvgc@8c4e603`, at 03:27 UTC on 2026-11-18 (the evening of 2026-11-17 in US Central). It added `pnpm accuracy` and the `sun-charizard` fixtures in `apps/api/test/reading-fixtures`. See PR #206 and [ADR 24](../adr/0024-reading-teams-from-files.md). Linear shows it Done.
- DEV-131 (make Haiku 5.5 the default image reader) merged in PR #222 as `jobanmendpara/myvgc@3d0b382`, at 12:49 UTC on 2026-11-18. As of that commit, `DEFAULT_TEAM_READER_MODEL` in `apps/api/src/config.ts` is `claude-haiku-5-5`, and the accuracy check uses the same constant. PR #222 has the before and after `pnpm accuracy` summaries that CLAUDE.md asks for: no case read worse on Haiku, every case failed on both models for reasons DEV-131 doesn't touch, and Haiku cost about an eighteenth as much. Linear shows it Done.
- Follow-ups filed in Linear on 2026-11-18, about 15 minutes after DEV-131 merged, both in Backlog that day: [DEV-152](https://linear.app/mendpara/issue/DEV-152) (Improvement: show the cost of an accuracy run for any model) and [DEV-153](https://linear.app/mendpara/issue/DEV-153) (Refactor: pick the accuracy check's model through `loadConfig`). (Superseded later on 2026-11-18 for DEV-153: it merged in PR #227 as `jobanmendpara/myvgc@7ea1221`, and Linear shows it Done. As of that commit, the check gets its model from `teamReaderModel(env)` in `apps/api/src/config.ts`, which `loadConfig` shares. See the [2026-11-18 Refactor round](refactor-round-2026-11-18.md). DEV-152 was still in Backlog that day.)
- On 2026-11-18 Linear showed the rest of DEV-118's build still Todo: DEV-106, DEV-130 and DEV-132 to DEV-137. (Superseded later on 2026-11-18: DEV-130 and DEV-106 merged, see the next section. DEV-132 to DEV-137 were still open. Superseded 2026-11-19: DEV-132 and DEV-133 merged, see "DEV-132 and DEV-133 on 2026-11-19" below.)

## DEV-130 and DEV-106 on 2026-11-18

Two implementers ran in parallel on 2026-11-18. Each PR merged on its first CI run, and neither needed a rebase.

- DEV-130 (read up to 8 images and shrink them before upload) merged in PR #232 as `jobanmendpara/myvgc@dc7f147`, at 21:00 UTC. As of that commit, `MAX_TEAM_IMAGES` is 8 and `MAX_TEAM_IMAGE_MB` is 7 in `packages/core/src/team.ts`, and the web app runs each image through `imageToUpload` (`apps/web/app/lib/shrink-image.ts`), which uses DEV-129's `shrinkImage` and falls back to the original. The size check applies to the file sent. See PR #232 for the tests. Linear shows it Done.
- DEV-106 (fill the Replica Team ID when reading a Team, and show Team-level flags) merged in PR #233 as `jobanmendpara/myvgc@4ca8aa3`, at 21:05 UTC. As of that commit, `seenTeamSchema` has `battleTeamName` and `replicaTeamId` in place of `name`, `readSeenTeam` normalises and flags the ID, `ReadTeamView` carries `replicaTeamId` (`''` from PDF reads), and the Team builder's alert lists Team-level flags from the draft's `readFlags`. See PR #233. Linear shows it Done.
- Both PRs touched `apps/api/test/team-read-images.test.ts`, and were open at once, so neither PR's CI saw the other's change. `main`'s CI on `jobanmendpara/myvgc@4ca8aa3`, the first run on the combined code, passed `check`; `smoke` was skipped, the gap recorded on 2026-11-18 in [shipping flow](shipping-flow.md).
- `pnpm accuracy`, Haiku 5.5, single runs, before and after summaries in each PR body. No case got worse in either, so no maintainer sign-off was needed:
  - DEV-130: identical before and after, 0 of 6 passed, $0.0192 each time.
  - DEV-106: 0 of 6 both times. Differences for `all` / `detail` / `pair` went from 14 / 20 / 14 to 12 / 20 / 12, at $0.0194 before and $0.0197 after. The Replica Team ID no longer lands in the Team's name. The remaining `detail` differences belong to DEV-134, DEV-135 and DEV-137 (PR #233).
- DEV-145 ("Stop offering the Replica Team ID as a Team name in the reader prompt"): on 2026-11-18 the DEV-106 implementer judged it covered by PR #233, which says so but doesn't close it, and the session left it open for the maintainer to decide. Linear, checked by the wiki agent the same day, shows DEV-145 Done at 21:05 UTC, three seconds after DEV-106. Most likely the Linear–GitHub integration closed it because PR #233's body names it; whether the maintainer agrees is still open. (Superseded 2026-11-18: the maintainer accepted that DEV-145 stays Done. The same day PR #237, `jobanmendpara/myvgc@b05508a`, added CLAUDE.md's rule against closing keywords before an issue the work doesn't finish; see [shipping flow](shipping-flow.md).)
- Open questions for the maintainer on 2026-11-18, not filed yet:
  - Must a Replica Team ID be exactly 10 characters? The example `9TCG84KWX` (9 characters) is valid under the schema as of `jobanmendpara/myvgc@4ca8aa3`.
  - Should Teamsheet PDF reads put an ID-looking "Battle Team Number / Name" value into `replicaTeamId`? As of `jobanmendpara/myvgc@4ca8aa3` PDF reads always give `''`.
  - (Superseded 2026-11-19 for the second question: filed at 01:28 UTC as [DEV-156](https://linear.app/mendpara/issue/DEV-156), Backlog that day. The length question is still not filed on its own; DEV-156's agent notes point to it, and DEV-108, filed 2026-11-12, asks to check the ID rule against real IDs.)
- Follow-ups found on 2026-11-18, not filed yet:
  - The "paper Teamsheet" wording on `/teams/new/images` and in `ImageTeamReader`'s comment (fits DEV-133). (Superseded 2026-11-19: DEV-133 removed it, `jobanmendpara/myvgc@34b9b94`, see below.)
  - No progress is shown while images shrink. (Superseded 2026-11-19: filed at 01:28 UTC as [DEV-157](https://linear.app/mendpara/issue/DEV-157), Backlog that day.)
  - ADR 24's status line. (Superseded 2026-11-19: as of `jobanmendpara/myvgc@34b9b94` it lists what DEV-118 has built so far: DEV-106, DEV-130, DEV-131, DEV-132 and DEV-133.)
  - No real-browser test of `shrinkImage`.
- `pnpm accuracy` needs `ANTHROPIC_API_KEY`. On 2026-11-18 each implementer symlinked the main checkout's `.env` into its worktree for the run only, and removed it afterwards. See [parallel agents](parallel-agents.md).

## DEV-132 and DEV-133 on 2026-11-19

Dates are UTC.

- DEV-132 ("Send JPEG once it reads as well as PNG") first ran as a measurement only, against `jobanmendpara/myvgc@9900d95`. Its comment on DEV-132 (01:33 UTC) compares PNG and JPEG over 36 reads for $0.1189: the two formats got the same fields wrong in every run, but the ▲/▼ arrows couldn't be judged, because nothing in `seenTeamSchema` depended on them yet and every Stat Alignment in `pair` came back blank. The run stopped there, with nothing built.
- On 2026-11-19 the maintainer chose to adopt JPEG anyway (DEV-132's 02:37 UTC comment), without making DEV-135 a formal blocker. DEV-135's 02:26 UTC comment asks its own `pnpm accuracy` run to compare the JPEG and PNG `pair` cases for the arrows, and to say so in the PR if JPEG reads them worse, since that would reopen the decision. (Superseded later on 2026-11-19: DEV-135's run read the arrows equally well in JPEG and PNG, so the JPEG decision stands. See "DEV-135 on 2026-11-19" below.)
- DEV-132 merged in PR #238 as `jobanmendpara/myvgc@7589886` (commit `3d5681e`), at 02:36 UTC. As of that commit, the web app's `imageToUpload` shrinks with `UPLOAD_ENCODING` (JPEG at quality 0.9) and names the upload `.jpg`, so a full set is about 3 MB instead of about 26 MB; `e2e/scripts/make-reading-fixtures.ts` uses the same constant, and the committed fixtures were not remade. PR #238 names DEV-135 with "Related to". Linear shows DEV-132 Done.
- DEV-133 ("Read only Replica Team tabs and Pokémon detail screens", part of DEV-118) merged in PR #239 as `jobanmendpara/myvgc@34b9b94` (commit `5dbbf7a`), at 03:01 UTC, on its first CI run. As of that commit, `seenTeamSchema` has an `images` list labelling each image `replicaTeamMoves`, `replicaTeamStats`, `pokemonDetail` or `unsupported`; `readSeenTeam` flags each unsupported image, fails the read when every image is unsupported, and returns `{ ok, ... }` like `readTeamsheet`. The reader's instructions were rewritten for the two supported screens, and photos of a paper Teamsheet are no longer supported (ADR 24 as of `34b9b94`). See PR #239 for the tests. Linear shows DEV-133 Done.
- `pnpm accuracy`, Haiku 5.5, single runs, before and after summaries in each PR body. No case got worse, so no maintainer sign-off was needed:
  - DEV-132: 0 of 6 both times, the same fields wrong before and after, $0.0197 before and $0.0199 after.
  - DEV-133: 0 of 6 both times, identical field by field. The longer prompt costs about 7% more ($0.0210 against $0.0196). No `images.N` flag appeared, so the model labelled every fixture image as supported.
- As of `jobanmendpara/myvgc@34b9b94`, `make-reading-fixtures.ts` paints the made-up name "Pip" (`PAINTED_NAME`) over the Trainer Name in Game on the two Replica Team tabs. It is not a nickname. (Checked 2026-11-19 because the session had called the painted name "Banjo"; no wiki page had recorded that name. "Banjo" is one of the random Team-name words added in DEV-138, `packages/core/src/team-name.ts`.)
- Follow-ups raised on 2026-11-19, not filed:
  - From DEV-133: an accuracy fixture with an unsupported image; checking the length of the model's `images` list against the number of uploads; the Team builder showing which image an `images.N` flag means.
  - From DEV-132: comparing Safari's JPEG encoder with Chromium's; putting the model's raw answer in the accuracy report. (Partly superseded later on 2026-11-19: the report now carries flag messages, but still not the raw answer. See "DEV-135 on 2026-11-19" below.)
- Linear on 2026-11-19 shows the rest of DEV-118's build still Todo: DEV-134 (nicknames and gender), DEV-135 (Stat Alignment from the arrows), DEV-136 and DEV-137. (Superseded later on 2026-11-19 for DEV-134: it merged, see "DEV-134 on 2026-11-19" below. DEV-135, DEV-136 and DEV-137 were still open.) (Superseded later on 2026-11-19 for DEV-135: it merged, see "DEV-135 on 2026-11-19" below. DEV-136 and DEV-137 were still open.)

## DEV-134 on 2026-11-19

Dates are UTC.

- DEV-134 ("Read nicknames and gender, and choose gender forms", part of DEV-118) merged in PR #241 as `jobanmendpara/myvgc@c0800d7` (commit `0a93d00`), at 14:43 UTC. Linear shows it Done. As of that commit, `seenTeamSchema` gives each Pokémon a `nickname` and a `gender`, and `unsure` can name either. `readSeenTeam` picks the form of Meowstic, Indeedee and Basculegion from the gender, flags a missing gender or one that contradicts a form named in the species text, never swaps species and nickname, and drops a nickname equal to the species as read. The reader's instructions say where the species and nickname are on a detail screen and to keep the gender out of the species. ADR 24's status line lists DEV-134, and its species bullet says the nickname's stats check is left to DEV-136. See PR #241 for the tests.
- `pnpm accuracy`, Haiku 5.5, `--repeat 3` on each side as well as single runs, both summaries in PR #241:
  - Before (`origin/main`): 0 of 18 passed, $0.0628. After: 6 of 18, $0.0662, about 5% more per read.
  - Now right: every nickname and gender the fixtures show. `all` passes in every run, on JPEG and PNG.
  - Left for other issues: `pair`'s 6 Stat Alignments (DEV-135) and `detail`'s 8 missing item and Replica Team ID flags (DEV-137).
  - Read worse in some runs: Basculegion's first move on the JPEG detail screen came back as "Wave Crush", flagged (`Couldn't read "Wave Crush".`), so the User sees it. It happened in 2 of 16 JPEG detail reads after the change and in none of 12 before. The implementer couldn't rule out the longer instructions, so under CLAUDE.md's accuracy rule it held back auto-merge for the maintainer's sign-off. The maintainer signed off on 2026-11-19, before the merge.
  - Read better: the first version of the instructions put "Basculegion (Male)" in the species twice in a single run. The implementer rewrote them to keep the gender out of the species, and after that it happened in no run; before the change the species was sometimes left blank.
- `pnpm accuracy` reports neither flag messages nor the model's raw answer, so the implementer wrote a scratch script (a `.mts` file run with tsx) to see them while chasing "Wave Crush" and "Basculegion (Male)". This adds to the 2026-11-19 follow-up above about putting the model's raw answer in the accuracy report.

## DEV-135 on 2026-11-19

Dates are UTC.

- DEV-135 ("Work out the Stat Alignment from the arrows, and check it against the numbers", part of DEV-118) merged in PR #243 as `jobanmendpara/myvgc@205133a` (commit `1bf6212`), at 14:59 UTC. As of that commit, `seenTeamSchema` gives each Pokémon a `raisedStat` and a `loweredStat` from the ▲/▼ arrows. `readSeenTeam` takes the Stat Alignment's name where it is shown, else looks the arrows up in `STAT_ALIGNMENTS`, else gives Serious when a Stats tab was read; arrows that can't be a Stat Alignment leave it blank with two flags. `readBuild` now checks every stat that has both a value and Stat Points, so the check covers every reader, and flags the Stat Alignment when the stats fit exactly one other. ADR 24's status line lists DEV-135, and its JPEG line now says the arrows read as well in JPEG. See PR #243 for the tests and the design decisions in the resolution comments on DEV-120 and DEV-121.
- `pnpm accuracy --repeat 3`, Haiku 5.5, both summaries in PR #243:
  - Before (`origin/main` at `c0800d7`): 6 of 18 passed, $0.0658. After: 12 of 18, $0.0707, about 7% more.
  - Now right: `pair` went from 6 differences in every run (all six Stat Alignments blank) to passing in every run.
  - Unchanged: `all` passes in every run. `detail` keeps the same 8 differences, the missing not-shown flags for the held item and Replica Team ID (DEV-137).
  - JPEG against PNG for the arrows: equal. Both formats read every arrow right in all 3 runs each, and no numbers-check flag appeared. So the DEV-132 JPEG decision stands; this supersedes the open question in "DEV-132 and DEV-133 on 2026-11-19" above.
  - "Wave Crush" (see "DEV-134 on 2026-11-19" above): 0 of 12 reads that include Basculegion's detail screen after DEV-135 (6 JPEG, 6 PNG). Before, one JPEG `detail` run dropped the move. Across PR #241's runs and these, it has only appeared on JPEG.
  - Nothing read worse, so no maintainer sign-off was needed.
- As of `jobanmendpara/myvgc@205133a`, the accuracy report's "flag not expected" lines include the flag's message (such as `Couldn't read "Wave Crush".`). This closes part of the gap noted in "DEV-134 on 2026-11-19" above; the model's raw answer is still not shown.
- Follow-ups raised on 2026-11-19 by the implementer, not filed:
  - The Teamsheet PDF reader gives only stat values, so the numbers check never fires for it.
  - Serious when there are no arrows still rests on a neutral sample that doesn't exist yet (DEV-128).
  - When the model reads a Stat Alignment name that disagrees with the arrows, the name wins and the disagreement isn't in `seenTeamSchema` (DEV-120, DEV-126).
- Environment friction from the same run is in [parallel agents](parallel-agents.md), "Environment on 2026-11-19 (DEV-135)".

## Gotchas

- Found 2026-11-11 during the DEV-38 work: a comment placed between chained Hono calls makes Prettier re-indent the whole chain, so `pnpm format:check` fails. Put the comment above the chain.

Related: [parallel agents](parallel-agents.md), [shipping flow](shipping-flow.md).

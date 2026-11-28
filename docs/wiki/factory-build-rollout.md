# Factory build rollout

How the Factory spec ([DEV-269](https://linear.app/mendpara/issue/DEV-269)) was planned and built. The spec, its acceptance criteria and its tickets are in Linear; this page records how the work went. The Factory's own vocabulary is to go in `docs/wiki/factory.md` (DEV-276).

## Planning (2026-11-26 to 2026-11-27)

- The map [DEV-247](https://linear.app/mendpara/issue/DEV-247) was charted on 2026-11-26. Its twelve tickets, DEV-248 to DEV-256 and DEV-258 to DEV-260, were closed on 2026-11-27, each with a "## Resolution" comment that the spec builds on.
- On 2026-11-27 the chief-of-staff wrote the spec with `to-spec`, as DEV-269, labelled `spec`. Following DEV-260, the maintainer's set-up steps are in the spec as human work (H-1 to H-7). The `spec` label was created that day.
- The maintainer signed DEV-269 off the same day, by adding `signed-off`, and created the Agent label group. The chief-of-staff added `ready-for-agent` to it: the group is at workspace level, so a DEV-only label can't join it.
- `/to-tickets` was then run by hand, since the H-3 edits to `to-tickets` weren't made yet. It published DEV-270 to DEV-289 as sub-issues with native blocking links and "Covers: AC-x.y" lines. H-1 to H-6 are `ready-for-human`, and the build tickets are `ready-for-agent`.
- On 2026-11-27 Linear refused H-7 (the pilot spec ticket) with "You've exceeded the free issue limit for this workspace". As of that day it is unpublished. The same limit will block the pilot spec and the Factory's follow-up issues.

## Built interactively by the chief-of-staff (2026-11-27)

All of these were built in the chief-of-staff's own session. Each was reviewed by the `code-review` skill's two sub-agents, fixed, and merged through auto-merge.

| Ticket | PR | Merge commit |
| -- | -- | -- |
| DEV-273: wait-for-checks.sh exit 5 | #468 | `jobanmendpara/myvgc@8351e01` |
| DEV-274: the factory workspace, start-up refusals | #469 | `jobanmendpara/myvgc@53543e8` |
| DEV-277: the frontier, `--dry-run` | #470 | `jobanmendpara/myvgc@638bf6b` |
| DEV-278: the tracer bullet, `--only` to a merged PR | #471 | `jobanmendpara/myvgc@01546b9` |
| DEV-279: parking, and picking a ticket up again | #472 | `jobanmendpara/myvgc@540638a` |
| DEV-283: fix rounds, per-Run model flags | #473 | `jobanmendpara/myvgc@c6bb9b3` |

## How the tickets proved their tests could fail

- From DEV-273, every PR maps each criterion to a test and replays a sabotage for each one: a small change to the code that must fail a test on an assertion. This applies to the Factory's own build too (DEV-269, Testing Decisions).
- The replays found weak tests more than once:
  - DEV-273: AC-30.3's test passed with a passing gate taken for pending.
  - DEV-278: a load error beside a real failure counted as caught.
  - DEV-279: the test for continuing a parked branch couldn't fail. That led to `factory/src/hostgit.ts`, tested against real throwaway git repos (`jobanmendpara/myvgc@1c4f6e8`).
- On 2026-11-27 the replay script was put in the chief-of-staff's session scratchpad (`factory-tools/`) for wave agents. It isn't in the repo as of `jobanmendpara/myvgc@c6bb9b3`.

## Security findings from the reviews (2026-11-27)

- DEV-278's spec review found that `git config` inside a worktree writes the config the maintainer's checkout shares, so the bot's identity would have leaked into the maintainer's commits. From `jobanmendpara/myvgc@3a0de8d` the author is set in the sandbox's environment.
- DEV-278's standards review found that Sandcastle mounts the repo's git folder into the sandbox, so an agent can plant git config or hooks that host git then runs.
  - At `jobanmendpara/myvgc@3a0de8d`, the host's push and `gh` stopped trusting that config.
  - At the same commit, closing a sandbox started refusing loudly if the config or hooks had changed.
  - At `jobanmendpara/myvgc@1c4f6e8`, `hostgit.ts` turned off credential helpers, a custom ssh command and any protocol but ssh and https.
  - The write itself is not prevented; doing that would mean changing how Sandcastle mounts the repo.
- DEV-279's review found that an Implementer's park reason could put a closing keyword in a draft PR. From `jobanmendpara/myvgc@1c4f6e8` closing keywords in agent text become "Related to".
- As of 2026-11-27, the Factory tells its own Linear comments from the maintainer's only by the "🏭 Factory" prefix, because both are written with the maintainer's key.

## Wave 1 (2026-11-27)

The maintainer asked the chief-of-staff to run subagents for the rest. Three implementers started in parallel worktrees: DEV-284, DEV-282 and DEV-280. All three edit `factory/src/run.ts`, so the round was capped at three, and a conflicting PR rebases on `scripts/wait-for-checks.sh` exit 4.

- Soon after they started on 2026-11-27, all three hit the 5-hour usage limit (HTTP 429, reset 12:30 America/Chicago). This was after a long interactive session building six tickets on Opus 5.5. Each was resumed with a message once the limit reset, as [parallel agents](parallel-agents.md) records from 2026-11-23. It bears on the pilot: three Opus agents in a single session window exhausted it.
- On 2026-11-27 DEV-280 merged as PR #475 (`jobanmendpara/myvgc@75028e7`); the agent's report gives these details:
  - All 22 sabotages failed on assertions.
  - `ANTHROPIC_API_KEY` for `pnpm accuracy` comes from `~/.config/myvgc-factory/config.env`. It isn't a start-up check: an ADR 24 ticket without the key parks.
  - The Sandbox port's `exec` gained an optional `env`.
  - The note that the ADR 24 list must match the risky-path gate's sits in `factory/src/accuracy.ts`'s header, for DEV-276 to copy into `factory.md`.
  - The accuracy summaries aren't judged.
  - The agent's worktree vanished mid-task. It rebuilt the worktree from `origin/main` without losing work, and fetched over HTTPS after SSH failed.
- The same day, DEV-281 started in the slot DEV-280 freed.
- On 2026-11-27 DEV-284 merged as PR #476 (`jobanmendpara/myvgc@7e89747`) after one rebase. The agent's report gives these details:
  - All 19 sabotages failed on assertions.
  - A ticket waiting on `approved` ends its turn with exit 0.
  - The CI round, the rebase and each push make a new sandbox.
  - Fetching failed jobs' logs needs the App's Actions read permission. The chief-of-staff added that to DEV-271 the same day.
- Like DEV-280's, DEV-284's worktree was deleted while the agent was paused by the usage limit, and the agent redid the work in a new one. From 2026-11-27 briefs say to rebuild a vanished worktree from the pushed branch or `origin/main`.
- The same day, DEV-285 started in the slot DEV-284 freed.
- Later on 2026-11-27, all three running agents (DEV-282, DEV-281 and DEV-285) hit the 5-hour limit again (reset 17:30 America/Chicago).
  - DEV-282 was mid force-push.
  - DEV-281 was mid-rebase.
  - Each was resumed with a message after the reset.
  - That made two limits in one day with three Opus implementers. The factory's own cap of 2 agents at once (DEV-253) looks right for the subscription.
- On 2026-11-27 DEV-282 merged as PR #477 (`jobanmendpara/myvgc@61eccf7`), rebuilt onto #475 and #476. The agent's report gives these details:
  - All 33 sabotages failed on assertions.
  - `.factory/runs/<id>/run.json` is rewritten after every step, with each ticket's steps, agents (session, paths, cost), reviews and replays.
  - Agent output is kept in `<ticket>/agents/NN-<step>.stdout.txt` and `.jsonl`.
  - Nothing reads `run.json` back yet.
- DEV-286 started next. DEV-287 waited for a slot, to keep the round at three agents.
- On 2026-11-27 DEV-281 merged as PR #478 (`jobanmendpara/myvgc@6f933a9`) after two rebases. The agent's report gives these details:
  - All 20 sabotages failed on assertions, re-run after each rebase.
  - The Forge port gained `pushFiles`.
  - Seen rows carry `screenshots`, `matches` and `judgement`.
  - A ticket parked after the push gate passes gets a draft PR without screenshots.
  - Running `pnpm screenshots` in the container is untested until the pilot.
- DEV-281's agent noticed a conflict that is the maintainer's to settle. On 2026-11-25 the maintainer decided that no GitHub branch hosts PR images ([preview](preview.md), "Screenshots in PRs"). The signed-off AC-33.1 asks the Factory to push screenshots to the orphan branch `factory-screenshots`. PR #478 follows the AC. As of 2026-11-27 it is unsettled whether the 2026-11-25 decision covers Factory PRs. (Superseded 2026-11-28: see the next line.)
- On 2026-11-28 the maintainer decided to keep the orphan `factory-screenshots` branch for Factory PRs. The 2026-11-25 decision covers interactive agents' PRs only. AC-33.1 stands unchanged, so the spec needs no new sign-off, and PR #478's code (as of `jobanmendpara/myvgc@1efd4bf`) already follows it. The branch is never a PR's head, so GitHub's deletion of merged branches doesn't remove it.
- DEV-287 started in the slot DEV-281 freed.
- On 2026-11-27 DEV-285 merged as PR #479 (`jobanmendpara/myvgc@2526421`), rebased onto DEV-282 and DEV-281. The agent's report gives these details:
  - All 12 sabotages failed on assertions.
  - Without `--only`, a Run works the whole frontier, two tickets at a time. Slots are in `factory/src/slots.ts`, one per sandbox from create to close.
  - The harness gained `hold(match)`, to hold a step open, and `note()`, which fake ports must record through.
  - A stalled Run now fails on an assertion.
  - The chief-of-staff told the DEV-286 and DEV-287 agents about the harness change before they rebased.
- That evening, DEV-286 and DEV-287 hit the 5-hour limit, the round's third (reset 22:30 America/Chicago). This time only two agents were running. Both were resumed after the reset.
- On 2026-11-27 DEV-287 merged as PR #480 (`jobanmendpara/myvgc@0856fc4`), rebased onto #479. The agent's report gives these details:
  - 26 of 27 sabotages failed on assertions. The one left untested is a guard for `endRun` throwing, which no fake port can trigger.
  - The end notification is built in `summary.ts`'s `endRun`.
  - Crash text comes from `crashNotification()` in `src/notify.ts`.
  - Clicking a macOS notification opens Script Editor, not the link.
  - AC-36.2's 429 part waited on DEV-286. The chief-of-staff told the DEV-286 agent to test that a 429 pause sends no notification.
- DEV-288, the last ticket, started the same day.
- On 2026-11-27 DEV-286 merged as PR #481 (`jobanmendpara/myvgc@35b6341`), rebased onto #479, #478 and #480. The agent's report gives these details:
  - All 36 sabotages failed on assertions, and there were 227 factory tests.
  - run.json gained `pid`, `resumedAt[]` and `pauses[]`, plus a per-ticket `checkpoint`.
  - A Clock port replaced `now`.
  - A 429 pause notifies nothing, and a test checks it.
- DEV-286 left two things for the pilot. A ticket adopted while waiting on CI keeps its slot. And if Claude reports a 429 only on stderr, the reset time is lost, so the Run waits 15 minutes instead.
- On 2026-11-27 DEV-288 merged as PR #482 (`jobanmendpara/myvgc@76aeb21`). The agent's report gives these details:
  - All 36 sabotages failed on assertions.
  - `pnpm factory retro DEV-N` writes the bundle with no model.
  - A PR waiting on `approved` keeps the spec open, and Canceled counts as finished.
  - The new `Forge.prComments` and `Tracker.getRelatedIssues` adapters are untested until the first real retro.

## The build finished (2026-11-27)

- By 2026-11-27 every build ticket of DEV-269 was Done: DEV-273, DEV-274, DEV-277 to DEV-288. That was 14 tickets in PRs #468 to #482; PR #474 belongs to other work. Eight were built by subagents in waves of at most three.
- As of 2026-11-27 the human set-up tickets DEV-270, DEV-271, DEV-272, DEV-275, DEV-276 and DEV-289 were still open. H-7 was unpublished because of the issue limit.
- Things the build left for the pilot's first real Run, from the agents' reports:
  - No real adapter has met Linear, GitHub or Claude yet.
  - Two sandboxes at once and `pnpm screenshots` in the container are untested.
  - The orphan `factory-screenshots` branch push is untested.
  - Reading a 429's reset time is untested.
- Open for the maintainer on 2026-11-27: whether the 2026-11-25 decision against hosting PR images on a branch covers Factory PRs (see DEV-281 above).
- After the round, the chief-of-staff removed the round's worktrees and their local branches. 26 older `worktree-agent-*` branches from earlier sessions were left as they were.

## Retro on the DEV-284 agent (2026-11-28)

The maintainer asked for a retro on the DEV-284 implementer. The sources were its transcript and its two reviewers' transcripts (subagent transcripts, 2026-11-27), and `factory/src/run.ts` and `factory/src/github.ts` as of `jobanmendpara/myvgc@79310e3`.

- The run was healthy. It read for 2 minutes, stopped on the usage limit, and after the reset took 32 minutes to merge PR #476: 134 tool calls, one rebase and 5 `wait-for-checks.sh` calls.
- Its worktree had been removed while it was paused. It had made no edits yet, so nothing was lost. It made a new worktree off `origin/main` in under a minute. Briefs from 2026-11-27 already cover this.
- Both reviewers took about a minute. Both found the same bug: a ticket left waiting on `approved` ended the Run with a failing exit code. The agent fixed it, along with four of the Standards reviewer's other points, before pushing.
- The rebase onto DEV-280 conflicted in all of `run.ts`, because DEV-284 had restructured `workTicket`. The agent took its own version and re-applied DEV-280's accuracy step by hand. All 141 tests passed afterwards, DEV-280's 19 included, and all 19 sabotages still failed on assertions.
- SSH `git fetch` failed for 7 of the round's 8 implementers, each losing about a minute before the HTTPS URL worked. The maintainer's 2026-11-25 decision keeps SSH first (see [parallel agents](parallel-agents.md)).
- Across the 8 implementers, about 110 Bash calls chained `git` with `&&` and about 27 used heredocs, against the shell-habits rule, and the worktree guard refused none of them. Several agents had moved to worktrees they made themselves, which the guard may not cover. That is too little evidence to drop the rule.
- Two findings in the Factory's code, as of `79310e3`, for the pilot:
  - The wait loop after the push has no limit. `wait-for-checks.sh` exits 2 (pending) and 3 (a `gh` error) are retried forever, and so is a clean rebase followed by exit 4 again. A check that never reports, or a `gh` call that always fails, would keep a Run going with no notice to the maintainer.
  - `failedCheckLogs` in `github.ts` filters the failed checks, reads job IDs with a regex and formats the log. The adapter has no tests, so the pilot's first CI failure is the first time this code runs.

Related: [shipping flow](shipping-flow.md), [parallel agents](parallel-agents.md).

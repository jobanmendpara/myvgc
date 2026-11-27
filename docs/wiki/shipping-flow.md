# Shipping flow

On 2026-11-11 the user asked for each implementation agent to work this way: commit the work, open a PR, then merge into `main` once every check passes, with no human review before the merge.

- The CI checks on PRs, as of PR #113 (2026-11-11), are `check` and `smoke / smoke`.
- PRs are merged with a merge commit (see the history at `jobanmendpara/myvgc@91d1ca8`).
- The branch name or PR title carries the Linear identifier (CLAUDE.md).
- Agents follow `.claude/skills/implement/SKILL.md`, which ends with the `code-review` skill, and write the PR body with the `pr` skill.
- On 2026-11-11 the DEV-97 agent skipped `code-review` because its diff was small. From then on the chief-of-staff tells agents that the code-review step is required, however small the diff.

On 2026-11-11 the user corrected how many agents to run: one per issue, not extra helpers. Don't add agents beyond the issues being worked on unless the user asks.

## Waiting for CI (retro on DEV-61, 2026-11-12)

- On 2026-11-12 the DEV-61 implementer's brief said to merge PR #160 once `check` and `smoke / smoke` passed. It handed back twice before they finished, saying it "was told to hand back while checks were still running".
- What told it: after opening the PR it started a Monitor on `gh pr checks`, then ended its turn with "PR #160 is open; waiting on CI." The harness at once sent `[handback-send-enforce] Your report has not been delivered. Call SubagentHandback ... now`, and the agent obeyed. A second nudge came when the Monitor's first event (`smoke / smoke: pass`) woke it and it ended its turn again. No skill told it to stop: `implement` ends at committing and `pr` covers only the PR body.
- Earlier in the same run it had ended a turn while its code-review subagents were working, and no nudge came. So a subagent may end its turn while it has subagents of its own running, but a turn ending with only a Monitor or background command running counts as finished.
- Both checks passed about six minutes after the PR opened. PR #160 was merged from the `jobanmendpara` account (`jobanmendpara/myvgc@319cadd`), not by the implementer.
- On 2026-11-12, while shipping this wiki change (PR #163), the retro agent found that `gh pr checks <n> --watch` with a 600000 ms timeout doesn't hold a turn open either: the harness moved it to the background after 180 seconds. What held was a foreground loop that runs `gh pr checks <n>` every 30 seconds for at most 150 seconds, called again until neither check is `pending`.
- Fixes were proposed to the chief-of-staff on 2026-11-12 and not yet made: brief implementers to wait for CI with such bounded foreground polls, called back to back, keeping their turn open until both checks pass and the PR is merged. (Partly superseded 2026-11-12: the poll is now a script, see below.)
- On 2026-11-12 DEV-117 added that bounded poll as `scripts/wait-for-checks.sh <pr>` (`jobanmendpara/myvgc@d017a90`); its header gives the exit codes. Briefs can say: run `scripts/wait-for-checks.sh <n>` in the foreground until it exits 0 (both checks passed) or 1 (one failed).
- On 2026-11-17 a call by each of the DEV-139 and DEV-142 agents ran 567 and 648 seconds, because the Mac slept for 536 seconds mid-call, and both the script's clock and the harness's 180-second limit count that time. The script also gave no `gh` call a time limit and asked `gh` again on waking past its deadline. From DEV-147 (`jobanmendpara/myvgc@857ca5c`), a `gh` call still running at the deadline is killed, and a call that wakes past the deadline exits 2 without calling `gh`. A machine asleep still pushes a call past 180 seconds, and nothing in the script can prevent that.
- DEV-147 merged in PR #221 as `jobanmendpara/myvgc@a7693f0`, at 04:16 UTC on 2026-11-18, and Linear shows it Done (2026-11-18 lint).
- On 2026-11-18, in the first round after DEV-147, each of the three implementers needed 3 to 4 calls of the script, at about 125 seconds a call, and none ran past the 180-second limit. See the [2026-11-18 Refactor round](refactor-round-2026-11-18.md).

## When to rebase before merging (2026-11-15)

- On 2026-11-15 the chief-of-staff's retro on DEV-113 (subagent report) found that the DEV-113 implementer spent about 32 of its 40 minutes shipping PR #190: 4 clean rebases and 5 CI runs, because its brief said "if main moves under you, rebase and re-run CI". Merging at its first green would have ended the run at about 14 minutes. `main` has no branch protection, so GitHub never required the rebases. (Superseded 2026-11-15: see "Branch protection and auto-merge" below.) See the [2026-11-15 Refactor round](refactor-round-2026-11-15.md).
- On 2026-11-15 the chief-of-staff decided the rule for briefs from then on. Once checks pass, run `git fetch` and compare `git diff --name-only <merge-base>..origin/main` with the PR's files. If nothing overlaps, merge without rebasing. If something overlaps, rebase, run that package's checks locally, re-run CI, then merge. `main`'s own CI after each merge is the backstop. This supersedes the "whichever PR merges second rebases onto main" line in [parallel agents](parallel-agents.md).
- On 2026-11-25, with the maintainer's approval, CLAUDE.md's "Branch off `origin/main`" bullet replaced `<merge-base>..origin/main` with `git diff --name-only HEAD...origin/main` after `git fetch`: the same list in one command, since the worktree guard refuses `$(git merge-base …)` (see [parallel agents](parallel-agents.md), "Shell habits in a worktree").
- Branch protection and auto-merge on `main` were left for the user to decide (2026-11-15). (Superseded 2026-11-15: the user approved both, see below.)
- The CI time behind each extra round is filed as DEV-146 (2026-11-15).

## Branch protection and auto-merge (2026-11-15)

- On 2026-11-15 the user approved branch protection with auto-merge on `main`, and a chief-of-staff subagent applied it with `gh api`. Settings before and after:

  | Setting                     | Before                             | After                                                       |
  | --------------------------- | ---------------------------------- | ----------------------------------------------------------- |
  | Repo `allow_auto_merge`     | `false`                            | `true`                                                      |
  | `main` protection           | none (404, "Branch not protected") | on                                                          |
  | Required status checks      | none                               | `check` and `smoke / smoke`, both from GitHub Actions (app 15368) |
  | `strict` (must be up to date) | n/a                              | `false`                                                     |
  | `enforce_admins`            | n/a                                | `false`                                                     |
  | Required reviews            | n/a                                | none                                                        |
  | Push restrictions           | n/a                                | none                                                        |
  | Force pushes, deletions     | allowed                            | blocked (GitHub's default for a protected branch)           |

  The other repo settings were left as they were: merge, squash and rebase merges all allowed, `delete_branch_on_merge` off. No rulesets exist. (Superseded 2026-11-17: `delete_branch_on_merge` is on, see below.)
- The check names come from the check runs on PR #202's head commit (`f6d4773`): `check` and `smoke / smoke`. On a push to `main` the smoke job reports as `smoke` and is skipped, because `ci.yml` runs it only on pull requests into `main`. That doesn't matter, since required checks only gate PRs.
- From 2026-11-15 an agent ships a PR this way:
  1. Open the PR (`gh pr create`).
  2. Straight away, queue the merge: `gh pr merge <n> --auto --merge --delete-branch`. GitHub merges it with a merge commit as soon as both checks pass.
  3. Never run a plain `gh pr merge <n>`. The user's token is an admin and `enforce_admins` is off, so a plain merge goes through at once and skips the checks. The admin bypass is the owner's escape hatch, not an agent's.
  4. Run `scripts/wait-for-checks.sh <n>` in the foreground, again and again, until it exits 0 or 1.
- This supersedes the 2026-11-12 brief "run `scripts/wait-for-checks.sh <n>` until it exits 0, then merge" above: the agent no longer merges.
- Agents still wait. On 2026-11-15 the user's view was that they should wait until the PR shows `MERGED` or a check fails, so they can fix red CI and report the merge commit. Waiting is cheap now that `strict` is off and no rebase is forced. On 2026-11-15 the same PR changed `scripts/wait-for-checks.sh` to wait for that: once both checks pass and auto-merge is queued, it polls `gh pr view` every 5 seconds until the PR is `MERGED` and prints the merge commit; if the merge is still pending when its 150 seconds run out, it exits 2 like a pending check.
- With `strict` off, GitHub never asks for a rebase, so the 2026-11-15 rebase rule above still stands, with one change of timing: auto-merge lands the PR as soon as the checks pass, so the agent compares its files with `origin/main` when it opens the PR, not after the checks. If files overlap, it rebases, runs that package's checks locally and pushes; a queued auto-merge then waits for the new head's checks. `main`'s own CI after each merge stays the backstop.
- Known gap found on 2026-11-18: the backstop runs `check` only. PRs #226 (DEV-148) and #228 (DEV-149) both edited `TeamBuilder.vue` and `teams/new/paste.vue`, in different lines, and were open at once, so neither PR's CI saw the other's change. The first run on the combined code was `main`'s for `jobanmendpara/myvgc@94dffd9`: `check` passed and `smoke` was skipped, as it doesn't run on pushes to `main`. When two open PRs touch the same files without overlapping lines, the overlap check above doesn't catch it, and the combination gets no smoke test until a later PR or a release tag runs one. See the [2026-11-18 Refactor round](refactor-round-2026-11-18.md).
- The gap came up again later on 2026-11-18: PRs #232 (DEV-130) and #233 (DEV-106) both edited `apps/api/test/team-read-images.test.ts` and were open at once. `main`'s CI on `jobanmendpara/myvgc@4ca8aa3`, the combined code, passed `check`, and `smoke` was skipped. See [team reading rollout](team-reading-rollout.md).
- On 2026-11-15 this flow was first used on its own wiki PR, #204. It was queued with `--auto` straight after `gh pr create` and read `BLOCKED` while `check` and `smoke / smoke` ran. A second commit pushed after queuing (this line) left the auto-merge queued for the new head's checks.
- On 2026-11-16, with the user's approval, this flow and the rebase rule above went into CLAUDE.md as its "Shipping" section, so agents get them without a brief (PR #205, `jobanmendpara/myvgc@138630b`).
- On 2026-11-15 PR #204 showed a gap in step 2: with `--auto`, `gh pr merge --delete-branch` doesn't delete the remote branch, because GitHub merges the PR later, after `gh` has returned. #204's branch stayed on GitHub after it merged, so remote branches had to be deleted by hand. (Superseded 2026-11-17, see the next line.)
- On 2026-11-17, with the user's approval, the chief-of-staff turned on the repo setting `delete_branch_on_merge`. From then on GitHub deletes a PR's branch itself when the PR merges, auto-merge included, so neither agents nor the chief-of-staff delete remote branches by hand. `--delete-branch` in step 2 is now redundant for the remote branch but harmless. Local branches and worktrees still need cleaning up, see [parallel agents](parallel-agents.md).
- On 2026-11-18 the lint found one exception. `jobanmendpara/dev-129-check-reading-accuracy-against-fixture` was still on GitHub, though its PR #206 merged at 03:27 UTC on 2026-11-18, after the setting was on (`gh api repos/jobanmendpara/myvgc` still gave `delete_branch_on_merge: true`). The branches of PRs #210, #212 to #214, #221 and #222, merged around the same time, were gone. The cause is unknown, so check for a leftover remote branch after a merge rather than assume GitHub removed it.
- On 2026-11-18 PR #233 (DEV-106) named DEV-145, an issue it didn't finish, right after the word "close" in a negated sentence, and Linear marked DEV-145 Done when the PR merged (see [team reading rollout](team-reading-rollout.md)). The same day, with the maintainer's approval, CLAUDE.md's "Tracking" section gained a rule: before an issue the work doesn't finish, a PR body or commit message uses "Related to" or "Part of", never close, fix or resolve in any form. The rule merged in PR #237 as `jobanmendpara/myvgc@b05508a` (01:33 UTC on 2026-11-19, the evening of 2026-11-18 in US Central), and the maintainer accepted that DEV-145 stays Done. On 2026-11-19 PR #238 (DEV-132) followed it, naming DEV-135 with "Related to".

## Sprites round (2026-11-23)

From the implementers' reports, 2026-11-23. See [sprites rollout](sprites-rollout.md).

- On 2026-11-23 DEV-46's PR #283 merged (`jobanmendpara/myvgc@f209c7a`) while DEV-177's PR #284 waited on CI, and #284 went `DIRTY` (conflicting). Auto-merge stays queued on a conflicting PR without saying so, and `scripts/wait-for-checks.sh` only reported "auto-merge still pending". Filed as [DEV-181](https://linear.app/mendpara/issue/DEV-181).
- The same day the chief-of-staff started the agents for blocked issues early: DEV-178 (blocked by DEV-177) and DEV-179 (blocked by DEV-46, and needing DEV-177's Sprite files to build). Each was told to build, then wait for the blocker's PR to merge and rebase before opening its own. It worked for both: DEV-178 waited about 45 minutes and rebased cleanly, and DEV-179 rebased twice with no conflict. Name the blocker's PR number or branch in the brief, since `gh pr list --search DEV-177` also matched old wiki PRs.

## Sprite Bugs (2026-11-23 to 2026-11-24)

From the implementers' reports and the chief-of-staff, 2026-11-24. See [sprites rollout](sprites-rollout.md) and [preview](preview.md).

- Agents wrote "Related to" in PR bodies for the issue the PR finished, following the 2026-11-18 rule above too widely, so Linear didn't close those issues on merge. DEV-184, DEV-187, DEV-193, DEV-194 and DEV-198 were moved to Done by hand.
- From 2026-11-24 the chief-of-staff's briefs say "Closes DEV-N" for the issue the PR finishes, and "Related to" only for issues it doesn't. DEV-199's PR #323 (`jobanmendpara/myvgc@a49030d`) used it, and DEV-199 closed on merge.
- On 2026-11-24 a change to CLAUDE.md's wording, to say this outright, was proposed to the maintainer. As of 2026-11-24 it is not decided. (Superseded 2026-11-24, see the next line.)
- On 2026-11-24 the maintainer approved the change. CLAUDE.md's "Tracking" bullet now says both halves: write "Closes DEV-N" in the PR body for the issue the PR finishes, and "Related to" or "Part of" before any issue it doesn't. It landed in PR #334. The `pr` skill and the repo (no PR template) had no rule of their own to align.
- `scripts/wait-for-checks.sh` returns after about 125 seconds, while CI's `check` takes 7 to 8 minutes, so each PR needed 3 to 4 calls (2026-11-24), as on 2026-11-18 above.
- Now and then `gh pr merge --auto` and `scripts/wait-for-checks.sh` (exit 3) failed with a GitHub GraphQL error (2026-11-24). Running the command again fixed it.
- As of 2026-11-24 [DEV-181](https://linear.app/mendpara/issue/DEV-181) (report a `DIRTY` PR, see "Sprites round" above) is still in Backlog. (Superseded 2026-11-25, see "Conflicts exit 4" below.)

## DEV-213 and DEV-223 (2026-11-25)

From the DEV-223 agent's report, 2026-11-25.

- DEV-223's PR #375 went `DIRTY` after DEV-213's PR #374 merged first (`jobanmendpara/myvgc@fd524c0`); the only conflict was in a shared `<dt>`. Its brief told it to check `mergeStateStatus` while waiting, so the agent saw it, rebased and force-pushed with `--force-with-lease`, and #375 merged as `jobanmendpara/myvgc@42c7e3e`. That brief line is a workaround for [DEV-181](https://linear.app/mendpara/issue/DEV-181) (see "Sprites round" above), still in Backlog on 2026-11-25. (Superseded 2026-11-25, see "Conflicts exit 4" below.)

## Conflicts exit 4 (2026-11-25)

- On 2026-11-25 DEV-181's PR #379 changed `scripts/wait-for-checks.sh` to ask `gh pr view` for `mergeStateStatus` while checks are pending and while auto-merge is queued. When it is `DIRTY` the script says the PR conflicts with `main`, tells the agent to rebase onto `origin/main` and push with `--force-with-lease`, and exits 4. A failed check still exits 1 first; exits 0, 1, 2 and 3 are unchanged, and the script's header lists every code. CLAUDE.md's "Shipping" section names exit 4. GitHub runs no checks on a conflicting PR, so before this the script reported pending checks or pending auto-merge until the agent looked.
- From this PR, briefs no longer need to tell agents to check `mergeStateStatus` while they wait, as the DEV-223 brief above did.

## GraphQL errors retried once (2026-11-25)

- On 2026-11-25 DEV-236 changed `scripts/wait-for-checks.sh` so that when `gh pr checks` or `gh pr view` fails with GitHub's "GraphQL: Something went wrong" (see "Sprite Bugs" above), it waits 5 seconds (`WAIT_FOR_CHECKS_RETRY_DELAY`) and asks once more. It exits 3 only when the retry fails too, and exits 2 when the deadline leaves no time to retry. Other `gh` errors still exit 3 at once, and the other exit codes are unchanged. `gh pr merge --auto` has no such retry: run it again by hand.

## The 180-second limit still holds (DEV-240, 2026-11-25)

- At about 125 seconds a call, the script needed 3 to 6 calls per PR, since CI's checks take 6 to 8 minutes (2026-11-18, 2026-11-24, and about 6 for the DEV-234 agent on 2026-11-25). DEV-240 asked for one call to wait about 9 minutes, on the belief that agents' foreground commands can run for 10 minutes.
- On 2026-11-25 the DEV-240 agent raised the default deadline to 540 seconds and ran it on its own PR #411 with a 600000 ms Bash timeout. The harness moved the call to the background after 180 seconds ("Command was moved to the background ... after running for 180s"), as it did to `gh pr checks --watch` on 2026-11-12 (see "Waiting for CI" above). A background command lets the turn end, which counts as the agent's hand-back, so a deadline past 180 seconds can't be used. The agent stopped the call and cancelled the PR's auto-merge.
- What PR #411 changed instead: the default deadline went from 150 to 170 seconds, leaving 10 seconds of the 180 for a slow start and killing a last `gh` call. With 30-second polls a call now lasts about 155 seconds instead of 125. The script prints its deadline first ("Waiting up to 170s for PR #n."). Exit codes are unchanged. Fewer calls per PR would need a longer harness limit, which is a Claude Code setting, not something this repo controls; DEV-240 stays open for the maintainer to decide.

## Screenshots stay out of PRs (2026-11-25)

- On 2026-11-25 the maintainer decided that PR bodies carry no screenshots and no GitHub branch hosts PR images: the agent looks at its own `pnpm screenshots` shots, writes what it checked in the PR's Evidence section, and attaches shots to the Linear issue when the maintainer may want them. One reason is the auto-merge above: no one reviews the PR. See [preview](preview.md), "Screenshots in PRs (2026-11-25)".

## Two issues in one PR (2026-11-25)

From the DEV-227 agent's report, 2026-11-25.

- On 2026-11-25 PR #381 (`jobanmendpara/myvgc@41ee853`) had both "Closes DEV-227" and "Closes DEV-228" in its body, on the branch `jobanmendpara/dev-227-…`. Linear closed DEV-227 on merge but left DEV-228 In Progress, and the agent moved it to Done by hand. It looks as if only the issue named in the branch closes on its own; one example so far. From 2026-11-25 the chief-of-staff gives each issue its own PR, or tells the agent to move any extra issue to Done after the merge.

## Waiting longer than 180 seconds (2026-11-25)

From the claude-code-guide agent's report, 2026-11-25, citing code.claude.com/docs/en/tools-reference.md, sub-agents.md and env-vars.md:

- The docs describe the 180-second move to the background as a separate behaviour of interactive sessions: a background subagent's command can move after 3 minutes, before its timeout. `BASH_DEFAULT_TIMEOUT_MS` and `BASH_MAX_TIMEOUT_MS` raise only the timeout an agent can ask for, and no documented setting changes the 180 s point.
- `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` turns off auto-backgrounding. The docs don't say whether that covers the 180 s move, and it is untested here.
- The Monitor tool is the documented fit for "poll a PR or CI job and report when its status changes". It has a default deadline of 5 minutes and a maximum of 30 in interactive sessions. The docs don't say whether every subagent has it.
- As of 2026-11-25 nothing was changed. A Monitor-based wait would replace CLAUDE.md's "Wait in the foreground" rule, so it went to the maintainer.

## Waiting on approved exits 5 (2026-11-27)

- On 2026-11-27 DEV-273 (`jobanmendpara/myvgc@4069fd9`) taught `scripts/wait-for-checks.sh` the risky-path gate's check, `risky-change-gate`, part of the Factory spec ([DEV-269](https://linear.app/mendpara/issue/DEV-269)). DEV-273 picked the name. As of 2026-11-27 the gate's workflow, `.github/workflows/risky-change-gate.yml`, doesn't exist yet: DEV-289 (the spec's set-up step H-6) adds it with a job of that name.
- When `check` and `smoke / smoke` have passed and the gate has failed, the script exits 5: the PR changes a risky path and waits on the maintainer to add `approved`. With auto-merge queued, adding the label merges it. CLAUDE.md's "Shipping" section tells interactive sessions to stop waiting and tell the maintainer; the factory is to mark the ticket `needs-human` and move on.
- A failed `check` or `smoke / smoke` still exits 1 first, and a conflict (exit 4) comes before exit 5, since adding the label can't merge a `DIRTY` PR. A pending or cancelled gate run is waited for like a pending check, because a label event starts a new run, and a skipped one counts as passed. A PR on which the gate isn't reported, as on every PR before the workflow exists, behaves as before.
- `gh pr checks` shows each check's latest run on the commit, so after a label event only the newest gate run counts.

## Releases

- On 2026-11-19 v0.2.0 was released from `jobanmendpara/myvgc@8e8a992` (tag `v0.2.0`, published 16:25 UTC, [release notes](https://github.com/jobanmendpara/myvgc/releases/tag/v0.2.0)). The "Release" workflow on the tag passed, so the smoke test ran on code that has both DEV-148 and DEV-149. This closes, for that combination, the 2026-11-18 gap noted above. The notes carried DEV-151's `S3_REGION` note (see the [2026-11-17 Refactor round](refactor-round-2026-11-17.md)). The only earlier release was v0.1.0, a pre-release, on 2026-11-03.
- `docs/roadmap.md` was not updated for v0.2.0: as of `jobanmendpara/myvgc@8e8a992` most of its "Later" list (Games, Note entries, merging Opponents, export and import, attachments, reading Teams) is built. No wiki page relies on the roadmap being current.
- On 2026-11-25 v0.3.0 was released from `jobanmendpara/myvgc@e3b3d94` (tag `v0.3.0`, [release notes](https://github.com/jobanmendpara/myvgc/releases/tag/v0.3.0)), once every issue in the v0.3.0 milestone was Done. DEV-210, the 8-day iPhone storage recheck, ships no code and can't finish before 2026-12-02, so it was moved to a new v0.3.1 milestone rather than hold up the release; the notes list it under "Known gaps". The "Release" workflow (run 45688979530) failed its first attempt on the DEV-231 flake (see [flaky tests](flaky-tests.md)); rerunning the failed job passed, and the image went out as `ghcr.io/jobanmendpara/myvgc:0.3.0` and `:latest` for amd64 and arm64. The notes add that offline use and installing to the Home Screen need HTTPS or `localhost`, which the README doesn't say.

Related: [parallel agents](parallel-agents.md), [2026-11-12 Todo round](todo-round-2026-11-12.md), [2026-11-15 Refactor round](refactor-round-2026-11-15.md).

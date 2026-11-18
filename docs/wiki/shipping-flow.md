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

Related: [parallel agents](parallel-agents.md), [2026-11-12 Todo round](todo-round-2026-11-12.md), [2026-11-15 Refactor round](refactor-round-2026-11-15.md).

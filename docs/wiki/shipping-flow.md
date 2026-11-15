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

## When to rebase before merging (2026-11-15)

- On 2026-11-15 the chief-of-staff's retro on DEV-113 (subagent report) found that the DEV-113 implementer spent about 32 of its 40 minutes shipping PR #190: 4 clean rebases and 5 CI runs, because its brief said "if main moves under you, rebase and re-run CI". Merging at its first green would have ended the run at about 14 minutes. `main` has no branch protection, so GitHub never required the rebases. See the [2026-11-15 Refactor round](refactor-round-2026-11-15.md).
- On 2026-11-15 the chief-of-staff decided the rule for briefs from then on. Once checks pass, run `git fetch` and compare `git diff --name-only <merge-base>..origin/main` with the PR's files. If nothing overlaps, merge without rebasing. If something overlaps, rebase, run that package's checks locally, re-run CI, then merge. `main`'s own CI after each merge is the backstop. This supersedes the "whichever PR merges second rebases onto main" line in [parallel agents](parallel-agents.md).
- Branch protection and auto-merge on `main` were left for the user to decide (2026-11-15).
- The CI time behind each extra round is filed as DEV-146 (2026-11-15).

Related: [parallel agents](parallel-agents.md), [2026-11-12 Todo round](todo-round-2026-11-12.md), [2026-11-15 Refactor round](refactor-round-2026-11-15.md).

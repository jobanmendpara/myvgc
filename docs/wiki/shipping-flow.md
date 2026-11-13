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
- Fixes were proposed to the chief-of-staff on 2026-11-12 and not yet made: brief implementers to wait for CI in a foreground call, `gh pr checks <n> --watch --interval 30` with a 600000 ms timeout, run again if it prints "no checks reported" or times out.

Related: [parallel agents](parallel-agents.md), [2026-11-12 Todo round](todo-round-2026-11-12.md).

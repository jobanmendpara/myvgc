# Shipping flow

On 2026-11-11 the user asked for each implementation agent to work this way: commit the work, open a PR, then merge into `main` once every check passes, with no human review before the merge.

- The CI checks on PRs, as of PR #113 (2026-11-11), are `check` and `smoke / smoke`.
- PRs are merged with a merge commit (see the history at `jobanmendpara/myvgc@91d1ca8`).
- The branch name or PR title carries the Linear identifier (CLAUDE.md).
- Agents follow `.claude/skills/implement/SKILL.md`, which ends with the `code-review` skill, and write the PR body with the `pr` skill.
- On 2026-11-11 the DEV-97 agent skipped `code-review` because its diff was small. From then on the chief-of-staff tells agents that the code-review step is required, however small the diff.

On 2026-11-11 the user corrected how many agents to run: one per issue, not extra helpers. Don't add agents beyond the issues being worked on unless the user asks.

Related: [parallel agents](parallel-agents.md).

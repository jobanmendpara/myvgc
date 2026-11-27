# Gating risky PRs on an `approved` label

Research for the Linear issue "How a path-based check can gate risky PRs on an approved label", part of the map "Map: a software factory from idea to merged PR". Researched 2026-11-26.

**Question.** How can a required GitHub check fail any PR that touches the risky paths (migrations, `docs/adr/`, the ADR 24 reading paths) until the maintainer adds an `approved` label, in a way that works with this repo's branch protection and `gh pr merge --auto`, and that the agent's token can't get around?

## Summary

- **Today nothing can tell the agent from the maintainer.** Agents use the maintainer's own `gh` login (`jobanmendpara`, the repo's owner and only admin). Whatever the maintainer can do, an agent can do: add the label, approve nothing (authors can't approve their own PRs), merge past the checks, or switch the protection off. Any gate needs **a separate agent identity first**: a GitHub App (recommended) or a machine-user collaborator, with no admin rights and no permission to change workflow files. The maintainer's token never goes into the sandbox.
- **The check itself is simple**: a workflow of its own, on `pull_request` with the `labeled` and `unlabeled` types added, that always runs, lists the PR's changed files, and fails when a risky path changed and the `approved` label wasn't added by `jobanmendpara` after the latest push. Make it a required status check. Auto-merge stays queued while it fails and merges as soon as the label run passes, so adding the label is the merge.
- **What stops an agent approving itself**: the check trusts only a `labeled` event whose actor is the maintainer (any collaborator or App that can open PRs can also add labels, so presence alone proves nothing); the agent's token lacks the `workflow` scope or permission, so it can't edit the gate; the gate reads nothing from the PR's own files; and the agent identity isn't an admin, so `enforce_admins` doesn't need to change.
- **A native alternative** does the same with no custom code: CODEOWNERS on the risky paths plus "require review from Code Owners". It also needs the separate identity, and approval is a review rather than a label.

## What the repo has now

Read with `gh api` on 2026-11-26 (read-only; nothing was changed).

| Setting | Value | Source |
| --- | --- | --- |
| Owner | personal account (`"type": "User"`), public repo | `gh api repos/jobanmendpara/myvgc` |
| Required status checks on `main` | `check` and `smoke / smoke`, both pinned to GitHub Actions (`app_id` 15368), `strict: false` | `gh api repos/jobanmendpara/myvgc/branches/main/protection` |
| `enforce_admins` | `false` | same |
| Required reviews | none | same |
| Rulesets | none (`[]`) | `gh api repos/jobanmendpara/myvgc/rulesets` |
| `allow_auto_merge`, `delete_branch_on_merge` | both `true` | `gh api repos/jobanmendpara/myvgc` |
| Agents' token | `jobanmendpara`'s `gh` OAuth token (`gho_`), scopes `gist`, `read:org`, `repo`, admin on the repo | `gh auth status`, `gh api user` |
| CODEOWNERS | none | no `.github/CODEOWNERS`, `CODEOWNERS` or `docs/CODEOWNERS` |

Shipping today (`docs/wiki/shipping-flow.md`, "Branch protection and auto-merge (2026-11-15)"): open the PR, queue `gh pr merge <n> --auto --merge --delete-branch` at once, never run a plain `gh pr merge` ("The user's token is an admin and `enforce_admins` is off, so a plain merge goes through at once and skips the checks"), and run `scripts/wait-for-checks.sh <n>` until it exits 0 or 1. That rule is the only thing keeping agents off the admin bypass.

`ci.yml` runs on `pull_request` with the default types and has `concurrency: group: ${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress` on PR branches.

## How the check reruns when a label is added

- `pull_request` has `labeled` and `unlabeled` activity types, but "By default, a workflow only runs when a `pull_request` event's activity type is `opened`, `synchronize`, or `reopened`." The gate must list `types: [opened, synchronize, reopened, labeled, unlabeled]`. ([Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#pull_request))
- **Put the gate in its own workflow file.** If the label types were added to `ci.yml`, every label change would start a new CI run in the same concurrency group and cancel the running `check` and `smoke / smoke`. That's an inference from `ci.yml`'s concurrency block above.
- **The gate must always run and decide inside.** A required workflow skipped by a `paths` filter leaves its check "Pending" and blocks the merge: "Avoid requiring workflows that can be skipped." ([Troubleshooting required status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks)) A *skipped job*, by contrast, counts as passing ("Required status checks must have a `successful`, `skipped`, or `neutral` status", [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)), so a job-level `if:` that skips the gate would let a risky PR through. The gate needs one job with no `paths` filter and no job `if:` that passes or fails explicitly.
- The label run is a new check run with the same name on the same head commit. "Required checks must pass on the latest commit SHA" (same troubleshooting page). The docs don't say in so many words that the newest run of a name replaces an older failed one; that's GitHub's observed behaviour, to confirm on the first real PR.
- Give the job a name no other workflow uses: "Using the same job name in multiple workflows can cause ambiguous status check results" (About protected branches).
- **Not `pull_request_target`.** It would run the base branch's copy of the workflow, which sounds safer, but its `GITHUB_SHA` is the "Last commit on the PR base branch" (Events that trigger workflows, `pull_request_target`), so its check run doesn't land on the PR's head commit and can't satisfy a required check. The `workflow` permission (below) protects a plain `pull_request` gate instead.

## How auto-merge reacts

- "Auto-merge merges a pull request automatically after all required reviews and status checks pass." It is turned off only when "someone without write permissions pushes new changes to the head branch" or someone "switches the base branch". A failing check doesn't cancel it: auto-merge "waits for all merge requirements to be met". ([Automatically merging a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request))
- So the agent can still queue `--auto` straight after `gh pr create`. A risky PR sits queued and blocked; when the maintainer adds `approved`, the `labeled` run passes and GitHub merges within seconds. **Adding the label is the merge**, so the maintainer adds it only after reading the PR (and, for ADR 24 changes, both `pnpm accuracy` summaries).
- `scripts/wait-for-checks.sh` watches only `check` and `smoke / smoke` (`CHECKS=(...)`). With the gate required but not listed, a risky PR would read "auto-merge still pending" (exit 2) forever. The gate's name needs adding to `CHECKS`, and a failing gate needs its own exit code: it means "park for the maintainer" (`needs-human`), not "fix it and push" (exit 1).

## Does "do not allow bypassing" stop an admin's plain merge?

- Branch protection: "By default, the restrictions of a branch protection rule do not apply to people with admin permissions." Turning on `enforce_admins` ("Do not allow bypassing the above settings") applies them "to admins and roles with the 'bypass branch protections' permission, too." (About protected branches) Then a plain `gh pr merge` by the admin waits for the checks like anyone else's.
- Rulesets: bypass is a list you choose ("users with a certain role, such as repository administrator", teams or GitHub Apps); rulesets and branch protection "work alongside each other, and all applicable rules are enforced", the most restrictive winning. ([About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)) A ruleset with an empty bypass list stops the admin too. The rulesets endpoint answers `[]` on this public repo, not 404, so rulesets are available here.
- **It doesn't stop a determined admin token**: the same token that can't bypass can switch `enforce_admins` off or delete the ruleset with `gh api`. Against the maintainer's own token it's a guard against slips, not a lock.
- **What it costs the maintainer**: every merge of theirs, hotfixes included, waits for `check` and `smoke / smoke` (several minutes) and for the gate. Getting around it means switching the setting off and on again.
- **With a separate agent identity it isn't needed.** A collaborator with write access, or an App without `administration` permission, can't bypass protection at all; only admins and bypass-listed actors can. So the recommendation leaves `enforce_admins` off and keeps the admin bypass as the maintainer's escape hatch, as the shipping flow already says.

## Who can add the label, and stopping self-approval

- "Anyone with triage access to a repository can apply and dismiss labels." ([Managing labels](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels)) On a personal-account repo, collaborators get write ("repository owners can only grant write access to collaborators"), which includes managing labels and enabling auto-merge. ([Permission levels for a personal account repository](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-user-account-settings/permission-levels-for-a-personal-account-repository)) An App that can open PRs can label them too. **Any agent identity able to ship can add `approved`**, so the label's presence proves nothing.
- **Same token, today**: the agent *is* `jobanmendpara` to GitHub. It can add the label, and the labeler check below can't tell it apart. No path-based gate holds until the agent has its own identity.
- **What stops it, layer by layer:**
  1. **Separate identity.** Recommended: a GitHub App owned by the maintainer, installed on this repo only, with `contents: write`, `pull_requests: write`, `issues: write` (for `needs-human` and similar labels) and `metadata: read`; *no* `workflows`, `administration`, `statuses` or `checks`. Its installation tokens last an hour; PRs show as `<app>[bot]`. A machine user also works but needs a classic PAT (scope `repo`, without `workflow`) and a second GitHub account.
  2. **Check who labelled.** The gate reads `GET /repos/{owner}/{repo}/issues/{n}/events`; a `labeled` event carries `actor`, `label.name` and `created_at`, and PRs are issues for this endpoint ([Issue events](https://docs.github.com/en/rest/issues/events#list-issue-events)). It passes only when the label is on the PR now and its latest `labeled` event's `actor.login` is `jobanmendpara`.
  3. **Approval goes stale on a new push.** On `synchronize`, when a risky path changed, the gate removes `approved` with `GITHUB_TOKEN` (`pull-requests: write`) and fails. Removal by `GITHUB_TOKEN` starts no new run: "other `GITHUB_TOKEN`-triggered events do not create workflow runs at all" (Events that trigger workflows). This keeps an agent from pushing more risky changes under an earlier approval.
  4. **The agent can't edit the gate.** A `pull_request` workflow runs the PR's own copy, so an agent that could edit the YAML could make it always pass. The OAuth `workflow` scope "Grants the ability to add and update GitHub Actions workflow files" ([Scopes for OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)); without it (or the App's `workflows` permission) GitHub refuses a push that touches `.github/workflows/`. So the gate keeps its path list and script **inline in the YAML** and reads nothing from the checkout (no repo script, no `package.json`), or the agent could change behaviour through a file it *can* edit. Add `.github/` to the risky paths anyway, so the maintainer sees any such change.
  5. **The maintainer's token stays out of the sandbox.** Sandcastle's Docker container gets only the App's token. Interactive sessions on the host still have the admin token; there the rule "never plain `gh pr merge`, never add `approved`" stays a rule.
- **Required review from the maintainer instead of a label.** "Pull request authors cannot approve their own pull requests" ([Approving a pull request with required reviews](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/approving-a-pull-request-with-required-reviews)). Today every PR is authored by `jobanmendpara`, so **the maintainer couldn't approve agent PRs at all**; reviews work only with a separate agent identity. With one, the native route is:
  - a `.github/CODEOWNERS` naming `@jobanmendpara` for the risky paths and for `/.github/` itself ("you also need to define an owner for the CODEOWNERS file itself"; the base branch's CODEOWNERS is the one used; [About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners));
  - a ruleset (or branch protection) on `main` requiring a PR with 0 approvals and "require review from code owners": "any pull request that modifies content with a code owner must be approved by that code owner" ([Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)), plus dismissing stale approvals on push.
  - Path-based out of the box, no custom workflow, nothing for the agent to edit. Whether 0 required approvals plus code-owner review blocks only the owned-path PRs should be confirmed on a test PR. The cost: approval is a review in the PR, not one label click, and it differs from the map's decision ("a GitHub check needing an `approved` label").
- Push rulesets with "Restrict file paths" would block risky paths outright, but they're for "a private or internal repository" (About rulesets), and this repo is public; they'd also block the maintainer's own changes rather than gate them.

## The risky paths

The map names migrations, `docs/adr/` and the ADR 24 reading changes. CLAUDE.md and ADR 24's Consequences list what counts as a reading change: "the image reader's instructions, `seenTeamSchema`, the default model or the web app's image shrinking". In the code (2026-11-26, `origin/main` `d51f12f`):

| Path | Why |
| --- | --- |
| `apps/api/drizzle/**` | migrations (CLAUDE.md, Layout) |
| `docs/adr/**` | decisions |
| `apps/api/src/team-reader.ts` | the image reader: its `INSTRUCTIONS` (sent as `system`) and the `betaZodOutputFormat(seenTeamSchema)` call |
| `packages/core/src/seen-team.ts` | `seenTeamSchema` (line 61), and `readSeenTeam`, which turns what the model saw into the draft |
| `apps/api/src/config.ts` | `DEFAULT_TEAM_READER_MODEL = 'claude-haiku-5-5'` and `TEAM_READER_MODEL` parsing |
| `apps/web/app/lib/shrink-image.ts` | the web app's image shrinking (2576 px, JPEG 0.9), used by `apps/web/app/composables/useTeamReader.ts` |
| `apps/api/test/reading-fixtures/**`, `apps/api/test/reading.accuracy.ts`, `apps/api/scripts/accuracy.ts` | the `pnpm accuracy` harness and its expected drafts; changing them changes what "no worse" means |
| `.github/**` | the gate itself, other workflows, and CODEOWNERS if used |

As globs for the gate: `apps/api/drizzle/**`, `docs/adr/**`, `apps/api/src/team-reader.ts`, `packages/core/src/seen-team.ts`, `apps/api/src/config.ts`, `apps/web/app/lib/shrink-image.ts`, `apps/api/test/reading-fixtures/**`, `apps/api/test/reading.accuracy.ts`, `apps/api/scripts/accuracy.ts`, `.github/**`.

Notes on the list:

- `config.ts` also holds unrelated settings, so some non-reading PRs will need the label. Moving the default model into `team-reader.ts` or a `team-reader-config.ts` would narrow it.
- `seen-team.ts` holds `readSeenTeam` as well as the schema. ADR 24 doesn't make `readSeenTeam` a trigger, but it decides the draft the accuracy check compares, so it is in. `packages/core/src/read-build.ts` (shared with PDF reading, covered by unit tests) is left out.
- `apps/api/src/server.ts` passes `config.TEAM_READER_MODEL` to the reader; a change there could swap the model, but it holds start-up code that changes often, so it's left out and covered by `config.ts`.
- List the changed files with `GET /repos/{owner}/{repo}/pulls/{n}/files` (paginated), not a checkout, so the gate needs no PR code.

## Recommendation

1. **Give the factory its own GitHub identity** (a GitHub App as above). Without this no gate holds, and it also makes a reviewed-PR route possible later.
2. **Add `.github/workflows/risky-change-gate.yml`**: `on: pull_request` with `types: [opened, synchronize, reopened, labeled, unlabeled]`, `permissions: pull-requests: write, issues: read`, a per-PR concurrency group, one job `risky-change-gate` with no `if:`. Inline script: list changed files through the API; no risky path, pass; otherwise, on `synchronize` remove `approved` and fail; else pass only if `approved` is on and its latest `labeled` event's actor is `jobanmendpara`. Print which risky paths changed, so the run log tells the maintainer what to read.
3. **Make `risky-change-gate` a required check** on `main`, pinned to GitHub Actions (app 15368) like the other two. Leave `enforce_admins` off.
4. **Teach `scripts/wait-for-checks.sh`** the new check, with a distinct exit code for "waiting on the maintainer's approval", which the factory turns into `needs-human` and a comment listing the risky paths (and, for reading paths, both `pnpm accuracy` summaries).
5. If the label check proves fiddly, switch to CODEOWNERS plus required code-owner review; it needs the same separate identity and no custom code.

## Sources

- GitHub Docs: [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches); [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets); [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets); [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks); [Automatically merging a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request); [Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows); [Managing labels](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels); [Permission levels for a personal account repository](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-user-account-settings/permission-levels-for-a-personal-account-repository); [Approving a pull request with required reviews](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/approving-a-pull-request-with-required-reviews); [About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners); [Scopes for OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps); [Issue events](https://docs.github.com/en/rest/issues/events#list-issue-events).
- This repo: `.github/workflows/ci.yml`, `scripts/wait-for-checks.sh`, `docs/wiki/shipping-flow.md`, `docs/adr/0024-reading-teams-from-files.md`, `CLAUDE.md`, and the files in the path table.
- Read-only `gh api` calls listed under "What the repo has now".

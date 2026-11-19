# Parallel agents

How we run several implementation agents at once. First used on 2026-11-11 for DEV-85 and DEV-86.

- Each agent works in its own git worktree, on its own branch off `origin/main`.
- Shared files are likely to conflict. For the list and detail work these are `ListDetail.vue`, `layouts/default.vue` and `e2e/tests/smoke.spec.ts`. Agents keep shared changes small and backward-compatible. Whichever PR merges second rebases onto main and resolves the conflicts. (Superseded 2026-11-15: a PR now rebases only when `main` has changed its files, see the 2026-11-15 section below.)
- `pnpm dev` and `pnpm up:local` both bind ports 3000 and 3001, and both use the same dev Postgres (see [up:local shares the dev DB](up-local-shares-dev-db.md)). Parallel agents keep off the default ports and rely on CI for the smoke test.

## Outcomes

- On 2026-11-11 the DEV-85 agent merged PR #115 second. It rebased onto #114 without conflicts, re-ran CI and merged. Running the two in parallel worked.
- On 2026-11-11 the DEV-86 agent merged PR #114 with both checks green on the first run. It didn't need to rebase, because it merged first.

## Worktree gotchas (DEV-86 agent report, 2026-11-11)

- A fresh worktree has no `node_modules`. Run `pnpm install --frozen-lockfile` first.
- In a worktree, `pnpm typecheck` reports 2 errors in `app/components/ui/native-select/NativeSelect.vue` that CI doesn't. The suspected cause is that the worktree sits inside the main checkout, so modules resolve from the parent's `node_modules`. Not confirmed. Agents should compare against CI and not "fix" these errors.
- The DEV-85 agent (2026-11-11) also suspected the local Node version (23.7, while `.nvmrc` says 24) as the cause of the `NativeSelect.vue` typecheck errors. Neither cause is confirmed.
- On 2026-11-11 (DEV-88) local typecheck missed a generic-inference error that CI caught, which cost a CI round. The same day the chief-of-staff confirmed the local `node -v` is v23.7.0 while `.nvmrc` says 24, and no Node 24 is installed under `~/.nvm`. Until that's fixed, treat local `pnpm typecheck` as advisory and CI as the gate.
- On 2026-11-11 the DEV-99 agent confirmed the cause, which supersedes both suspicions above. It isn't the Node version (Node 24 gives the same errors) or the parent checkout's `node_modules`. A stray `~/node_modules` (with `~/package.json`, holding Vue 3.3 and Vite 5) is to blame. Nuxt resolves `vite/client`, `@vue/runtime-core`, `@vue/compiler-sfc`, `defu` and `consola` for its tsconfig paths by walking up from `apps/web/node_modules`, and pnpm doesn't put them there, so any checkout under `~` picked up the old types. The same code in a copy outside `~` matched CI: no `NativeSelect.vue` errors, and DEV-88's `<ListRows>` errors came back.
  - Fix (jobanmendpara/myvgc@93a6d84): `apps/web` typecheck now fails and names the stray folder when a generated path points outside the repo. `engines` pins Node `^24.11.0` with `engineStrict`, so pnpm refuses to run on Node 23. Until the user moves `~/node_modules` away, local `pnpm typecheck` stops with that message instead of disagreeing with CI.
- On 2026-11-11 the user, through the chief-of-staff, moved `~/node_modules` to `~/.local/share/home-node-project-2026-11-11/` and made Node 24 the nvm default. This supersedes the "until the user moves `~/node_modules` away" claim above. `PATH` still put Homebrew's Node 23.7 first, pending a decision. (Superseded 2026-11-11: the `PATH` order was settled later that day, see below.)
- On 2026-11-11 the DEV-100 agent found that its shells still got Node 23.7 from `/opt/homebrew/bin`, so `pnpm install` refused (`engineStrict`). It ran pnpm with `~/.nvm/versions/node/v24.22.3/bin` and `~/Library/pnpm/bin` first on `PATH`; `/usr/local/bin/pnpm` failed under Node 24 with `MODULE_NOT_FOUND`. With that, `pnpm typecheck` in its worktree passed on main and on its branch (`jobanmendpara/myvgc@aff4e71`), with no `NativeSelect.vue` errors.
- On 2026-11-11 the DEV-100 PR #134 (merged as `jobanmendpara/myvgc@b017592`) was the first whose CI run (43121805203) agreed with local `pnpm typecheck`.
- On 2026-11-11, after the user's shell config changed to put Node 24 first, agents still got Node 23.7, because Claude Code's tool shells use a `PATH` snapshot taken when the session starts. Fresh zsh shells, login and non-interactive, give Node v24.22.3 and pnpm 10.28.0 from `~/Library/pnpm/bin`, which shadows `/usr/local/bin/pnpm` (that one crashes under Node 24 with `MODULE_NOT_FOUND`). Restarting Claude Code picks the new `PATH` up. This supersedes the claim above that the `PATH` order was pending a decision. (Superseded 2026-11-12: Node 24 and pnpm worked with no workaround, see the 2026-11-12 section below.)
- `gh pr checks --watch` run straight after a push can print "no checks reported" and exit. Re-run it.
- On 2026-11-11 the DEV-89 PR #117's CI run 43095530887 sat `queued` for about an hour with no jobs, while GitHub status was green.
  - `gh run cancel` and `gh run rerun` both refused. Later that day the web UI's cancel ("Failed to cancel workflow"), the API's `force-cancel` (409, "has not been queued yet") and `gh run delete` (403) all failed too. Only GitHub Support or GitHub's own cleanup can clear such a run.
  - An empty commit (`240fd4b`) started a fresh run that passed.
  - While a run is queued, `gh pr checks` says "no checks reported" and the PR's merge state reads `CLEAN`, so `CLEAN` doesn't mean the checks passed. Agents must see the named checks pass before they merge. (Superseded 2026-11-15: `main` now requires `check` and `smoke / smoke`, so a PR whose checks haven't passed reads `BLOCKED`, not `CLEAN`, and agents queue `gh pr merge --auto` instead of merging. An admin's plain `gh pr merge` still bypasses the checks. See [shipping flow](shipping-flow.md), "Branch protection and auto-merge".)
- Worktree isolation also refuses heredoc appends (`cat >> file <<EOF`).
- Worktree isolation refuses compound shell commands such as `sed && cat > file`, or `git` chained with `&&`, loops or `perl`. Run git one command per call, and use Edit and Write for file changes. (A further refusal was found on 2026-11-12, see the section below.)
- To run the smoke test off the default ports (DEV-85, 2026-11-11), use `docker compose -p <unique-name> -f compose.yaml -f compose.build.yaml up -d --build --wait` with a `.env` holding `PORT=3400` and `APP_URL=http://localhost:3400`, then `BASE_URL=http://localhost:3400 pnpm smoke`. `compose.yaml` doesn't publish the database port, so the stack doesn't clash with the dev database. Tear it down afterwards.
- Parallel agents share the session's scratchpad. On 2026-11-11 the DEV-99 agent's `pr-body.md` overwrote the DEV-96 agent's. Since then agents are told to put the issue identifier in every scratchpad file name.
- `gh pr merge --delete-branch` deletes the remote branch but not the local one while it's checked out in a worktree. The chief-of-staff cleans these up. (Narrowed 2026-11-15: with `--auto` it doesn't delete the remote branch either, as PR #204 showed, so remote branches were left to delete by hand. Superseded 2026-11-17 for remote branches: the repo setting `delete_branch_on_merge` is on, so GitHub deletes them on merge and nobody deletes them by hand, see [shipping flow](shipping-flow.md). The chief-of-staff still cleans up local branches.)

## Session limit, SSH and worktree locks (2026-11-11, DEV-64 to DEV-66)

- On 2026-11-11 three Opus implementers ran at once (DEV-64, 65, 66), each spawning code-review subagents. They hit the claude.ai session limit (HTTP 429) after about 7 minutes, and all three stopped mid-task. SendMessage resumed each from its transcript after the reset. A code-review subagent's hand-back (the DEV-64 spec review) was delivered to the chief-of-staff instead of the implementer that spawned it, so the chief-of-staff relayed it.
- On 2026-11-11, mid-run, git over SSH failed with "agent refused operation" (the signing key was locked in the SSH agent), for both the DEV-66 agent and the chief-of-staff. The user's global git config has `url.git@github.com:.insteadof https://github.com/`, so every git network call failed, HTTPS included. The DEV-65 agent stopped before pushing. `gh` API calls still worked, and `gh api .../compare/main...<sha>` checks that main hasn't moved.
- The DEV-64 agent found the workaround on 2026-11-11: `git -c "credential.helper=!gh auth git-credential" push https://jobanmendpara@github.com/jobanmendpara/myvgc.git <branch>` works, because the username in the URL stops the `insteadOf` rewrite. Fetch takes the same form. Its off-port smoke run (port 3464) passed 10/10.
- On 2026-11-11 the chief-of-staff found that worktrees made with `isolation: worktree` stay locked after the agent finishes, so `git worktree remove` refuses them. The lock is held by the Claude Code process itself (the session's pid), not the agent, so it never clears mid-session. The chief-of-staff runs `git worktree unlock` then `remove` once a worktree is clean and its PR merged. This adds to, and only in part supersedes, the `gh pr merge --delete-branch` line above: the local branch survives while the worktree exists, and the worktree itself needs the unlock first. (Narrowed 2026-11-12: this holds only while that session runs, see below.)

## Environment on 2026-11-12 (DEV-67, DEV-71, DEV-60, DEV-61)

See the [2026-11-12 Todo round](todo-round-2026-11-12.md) for how the round ran.

- On 2026-11-12 all four implementers had Node 24, pnpm and plain SSH `git push` working with no workaround: no `PATH` changes and no HTTPS push URL. This supersedes, for that day, the Node 23.7 `PATH` claims and the SSH "agent refused operation" claim of 2026-11-11 above.
- On 2026-11-12 the worktree guard refused shell commands in which a variable sits where an option could be, such as `sed -i '' $S` or `sed -n '1p' $F`, because it can't show the command isn't git. Write file paths out in full in shell commands.
- On 2026-11-12 the chief-of-staff found that worktrees left by a session that has ended aren't locked, so `git worktree remove` works on them straight away. The 2026-11-11 lock claim above applies only to worktrees of the running session.
- On 2026-11-12 the briefs reminded implementers that seed data must use species that are in Pokémon Champions. Amoonguss isn't.
- On 2026-11-12 the chief-of-staff set up a daily scheduled check, a cron that lasts only as long as its session. It removes the worktrees of finished agents and lints the wiki. (Superseded 2026-11-16: the lint now runs as a scheduled routine, see [conventions](conventions.md). Amended 2026-11-17: both lints stay, see "Daily upkeep on 2026-11-17" below.)

## Environment on 2026-11-15 (DEV-127, DEV-116, DEV-109, DEV-110, DEV-113)

See the [2026-11-15 Refactor round](refactor-round-2026-11-15.md) for how the round ran.

- On 2026-11-15 five Opus implementers ran at once, one per worktree, and none hit the session limit (HTTP 429). This is the most run at once so far; the 2026-11-11 stop above came with three.
- On 2026-11-15 every implementer merged its own PR with `gh pr merge`, and none was refused. The same day auto mode refused the chief-of-staff's own merge of wiki PR #177, so merge rights can differ between the chief-of-staff and its agents on the same day.
- On 2026-11-15 the DEV-110 agent's full `pnpm test` run went past the 180-second foreground limit, and the harness moved it to the background, while five agents loaded the machine. Filed as DEV-144 that day: a bounded way to run tests locally, like `scripts/wait-for-checks.sh` (see [shipping flow](shipping-flow.md)).
- On 2026-11-15 the chief-of-staff's retro on DEV-113 (subagent report) found that it rebased 4 times and ran CI 5 times on PR #190, all 4 rebases clean, because the brief and the "whichever PR merges second rebases" line above told it to rebase whenever `main` moved. `main` has no branch protection, so GitHub never required it. (Superseded 2026-11-15: branch protection was applied later that day, see [shipping flow](shipping-flow.md).) See the [2026-11-15 Refactor round](refactor-round-2026-11-15.md).
- On 2026-11-15 the chief-of-staff decided a new rule, which supersedes that line. Once a PR's checks pass, run `git fetch` and compare `git diff --name-only <merge-base>..origin/main` with the PR's files. If nothing overlaps, merge without rebasing. If something overlaps, rebase, run that package's checks locally, re-run CI, then merge. `main`'s own CI after each merge is the backstop. The rule is also in [shipping flow](shipping-flow.md). (Amended 2026-11-15: with auto-merge queued, the PR lands as soon as its checks pass, so the overlap check moves to when the PR is opened, see [shipping flow](shipping-flow.md), "Branch protection and auto-merge".)
- On 2026-11-15 the worktree guard refused the DEV-116 agent's compound command that fed a `python3` heredoc. This adds to the heredoc and compound-command refusals of 2026-11-11 and 2026-11-12 above.
- On 2026-11-15 each `worktree-agent-*` placeholder branch needed `git branch -D` to delete, because local `main` lagged `origin/main` and `git branch -d` judged them unmerged. The chief-of-staff first checked that each was an ancestor of `origin/main`. This adds to the `gh pr merge --delete-branch` line above: before force-deleting a leftover branch, check it against `origin/main`, not local `main`.

## Daily upkeep on 2026-11-16

From the chief-of-staff, 2026-11-16:

- On 2026-11-16 SSH git from the chief-of-staff's session failed again with "agent refused operation", while `gh` API calls worked. This supersedes, for that day, the 2026-11-12 claim above that plain SSH worked. The 2026-11-11 HTTPS workaround above (`git -c "credential.helper=!gh auth git-credential" push https://jobanmendpara@github.com/...`) still worked for fetch and push.
- The first version of the chief-of-staff's daily upkeep cron would have removed a locked worktree whose HEAD equalled `main`, belonging to another session (DEV-129). From 2026-11-16 the cron skips locked worktrees and removes a worktree only when it is clean, its branch has a merged PR, and its HEAD is in `main`. This narrows the 2026-11-11 "unlock then remove" step above: the cron no longer unlocks.

## Daily upkeep on 2026-11-17

From the chief-of-staff, 2026-11-17:

- On 2026-11-17 SSH git failed a third time with "agent refused operation", while `gh` API calls worked, and the HTTPS workaround above worked for fetch and push. It had also failed on 2026-11-11 and 2026-11-16.
- On 2026-11-17 the upkeep removed no worktree. The only other worktree under `.claude/worktrees/` (DEV-129, PR #206 open) was locked by another session, so it was left.
- On 2026-11-17 the user decided to keep both wiki lints, which answers the question in PR #208 of which job runs what. The user's own scheduled "Wiki lint" routine starts its own session, lints the wiki and opens a `chore/wiki-lint-<date>` PR (PR #207 was the first). The chief-of-staff's daily upkeep cron removes finished worktrees and runs on `chore/wiki-upkeep-<date>`, adding only what that day's routine PR missed, such as Linear issue states. This amends the 2026-11-16 supersession of the 2026-11-12 line above: the cron still lints, as a second pass after the routine.
- On 2026-11-17 the chief-of-staff turned on `delete_branch_on_merge`, with the user's approval, so GitHub deletes a PR's remote branch when it merges. See [shipping flow](shipping-flow.md), "Branch protection and auto-merge".

## Daily upkeep on 2026-11-18

From the chief-of-staff's upkeep, 2026-11-18:

- On 2026-11-18 `git fetch` over SSH failed again ("Please make sure you have the correct access rights"), and the HTTPS workaround above worked for fetch. `gh` API calls worked. This is the fourth day it has failed, after 2026-11-11, 2026-11-16 and 2026-11-17.
- On 2026-11-18 `.claude/worktrees/` held no worktree, so the upkeep removed none. The DEV-129 worktree left on 2026-11-17 was gone, and PR #206 had merged (see [team reading rollout](team-reading-rollout.md)).

## Daily upkeep on 2026-11-19

From the chief-of-staff's upkeep, 2026-11-19, about 15:45 UTC:

- `git fetch` over SSH worked.
- The upkeep removed no worktree. Besides its own, `.claude/worktrees/` held one, the wiki agent's on `chore/wiki-reading-dev-136-137-2026-11-19`, locked by the running session, so it was left.
- No `chore/wiki-lint-2026-11-19` PR from the "Wiki lint" routine existed yet, so this upkeep's lint was the only one so far that day.

## Environment on 2026-11-17 (DEV-139, DEV-142, DEV-140)

See the [2026-11-17 Refactor round](refactor-round-2026-11-17.md) for how the round ran.

- On 2026-11-17 `ssh -T git@github.com` worked for the chief-of-staff, yet all three implementers' SSH pushes were refused that same day, and each pushed with the HTTPS workaround above. The DEV-139 agent's SSH fetch worked just before its push was refused. So SSH refusal is intermittent within a day: one working SSH call says nothing about the next. Agents should expect it and keep the HTTPS workaround to hand.

## Environment on 2026-11-18 (DEV-153, DEV-148, DEV-149)

See the [2026-11-18 Refactor round](refactor-round-2026-11-18.md) for how the round ran.

- On 2026-11-18 SSH push worked for all three implementers. The same day the upkeep's SSH fetch failed (see "Daily upkeep on 2026-11-18" above), and so did the wiki agent's SSH fetch and push for this page ("agent refused operation"), which used the HTTPS workaround. This fits the 2026-11-17 finding that SSH refusal is intermittent within a day.
- Later on 2026-11-18 the DEV-130 and DEV-106 implementers ran `pnpm accuracy` in their worktrees, which have no `.env`. Each symlinked the main checkout's `.env` into its worktree for the run only, and removed it afterwards. See [team reading rollout](team-reading-rollout.md).
- On 2026-11-18 the worktree guard again refused compound commands that included git, as on 2026-11-11 above. The wiki agent also had a `gh pr view ... --jq` loop refused, as "too complex to verify". Run each `git` and `gh` command on its own.

## Environment on 2026-11-19 (DEV-135)

See [team reading rollout](team-reading-rollout.md), "DEV-135 on 2026-11-19".

- On 2026-11-19 zsh broke `grep --include=*.ts` searches: it expands the unquoted glob itself and fails with "no matches found". Use `git grep` (for example `git grep -n foo -- '*.ts'`) instead.
- The same day the worktree guard refused a heredoc chained with other commands, as on 2026-11-11 and 2026-11-15 above.

Related: [shipping flow](shipping-flow.md), [list and detail rollout](list-detail-rollout.md), [team reading rollout](team-reading-rollout.md).

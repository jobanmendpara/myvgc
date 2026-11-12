# Parallel agents

How we run several implementation agents at once. First used on 2026-11-11 for DEV-85 and DEV-86.

- Each agent works in its own git worktree, on its own branch off `origin/main`.
- Shared files are likely to conflict. For the list and detail work these are `ListDetail.vue`, `layouts/default.vue` and `e2e/tests/smoke.spec.ts`. Agents keep shared changes small and backward-compatible. Whichever PR merges second rebases onto main and resolves the conflicts.
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
- On 2026-11-11, after the user's shell config changed to put Node 24 first, agents still got Node 23.7, because Claude Code's tool shells use a `PATH` snapshot taken when the session starts. Fresh zsh shells, login and non-interactive, give Node v24.22.3 and pnpm 10.28.0 from `~/Library/pnpm/bin`, which shadows `/usr/local/bin/pnpm` (that one crashes under Node 24 with `MODULE_NOT_FOUND`). Restarting Claude Code picks the new `PATH` up. This supersedes the claim above that the `PATH` order was pending a decision.
- `gh pr checks --watch` run straight after a push can print "no checks reported" and exit. Re-run it.
- On 2026-11-11 the DEV-89 PR #117's CI run 43095530887 sat `queued` for about an hour with no jobs, while GitHub status was green.
  - `gh run cancel` and `gh run rerun` both refused. Later that day the web UI's cancel ("Failed to cancel workflow"), the API's `force-cancel` (409, "has not been queued yet") and `gh run delete` (403) all failed too. Only GitHub Support or GitHub's own cleanup can clear such a run.
  - An empty commit (`240fd4b`) started a fresh run that passed.
  - While a run is queued, `gh pr checks` says "no checks reported" and the PR's merge state reads `CLEAN`, so `CLEAN` doesn't mean the checks passed. Agents must see the named checks pass before they merge.
- Worktree isolation also refuses heredoc appends (`cat >> file <<EOF`).
- Worktree isolation refuses compound shell commands such as `sed && cat > file`, or `git` chained with `&&`, loops or `perl`. Run git one command per call, and use Edit and Write for file changes.
- To run the smoke test off the default ports (DEV-85, 2026-11-11), use `docker compose -p <unique-name> -f compose.yaml -f compose.build.yaml up -d --build --wait` with a `.env` holding `PORT=3400` and `APP_URL=http://localhost:3400`, then `BASE_URL=http://localhost:3400 pnpm smoke`. `compose.yaml` doesn't publish the database port, so the stack doesn't clash with the dev database. Tear it down afterwards.
- Parallel agents share the session's scratchpad. On 2026-11-11 the DEV-99 agent's `pr-body.md` overwrote the DEV-96 agent's. Since then agents are told to put the issue identifier in every scratchpad file name.
- `gh pr merge --delete-branch` deletes the remote branch but not the local one while it's checked out in a worktree. The chief-of-staff cleans these up.

## Session limit, SSH and worktree locks (2026-11-11, DEV-64 to DEV-66)

- On 2026-11-11 three Opus implementers ran at once (DEV-64, 65, 66), each spawning code-review subagents. They hit the claude.ai session limit (HTTP 429) after about 7 minutes, and all three stopped mid-task. SendMessage resumed each from its transcript after the reset. A code-review subagent's hand-back (the DEV-64 spec review) was delivered to the chief-of-staff instead of the implementer that spawned it, so the chief-of-staff relayed it.
- On 2026-11-11, mid-run, git over SSH failed with "agent refused operation" (the signing key was locked in the SSH agent), for both the DEV-66 agent and the chief-of-staff. The user's global git config has `url.git@github.com:.insteadof https://github.com/`, so every git network call failed, HTTPS included. The DEV-65 agent stopped before pushing. `gh` API calls still worked, and `gh api .../compare/main...<sha>` checks that main hasn't moved.
- The DEV-64 agent found the workaround on 2026-11-11: `git -c "credential.helper=!gh auth git-credential" push https://jobanmendpara@github.com/jobanmendpara/myvgc.git <branch>` works, because the username in the URL stops the `insteadOf` rewrite. Fetch takes the same form. Its off-port smoke run (port 3464) passed 10/10.
- On 2026-11-11 the chief-of-staff found that worktrees made with `isolation: worktree` stay locked after the agent finishes, so `git worktree remove` refuses them. The lock is held by the Claude Code process itself (the session's pid), not the agent, so it never clears mid-session. The chief-of-staff runs `git worktree unlock` then `remove` once a worktree is clean and its PR merged. This adds to, and only in part supersedes, the `gh pr merge --delete-branch` line above: the local branch survives while the worktree exists, and the worktree itself needs the unlock first.

Related: [shipping flow](shipping-flow.md), [list and detail rollout](list-detail-rollout.md), [team reading rollout](team-reading-rollout.md).

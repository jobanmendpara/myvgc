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
- `gh pr checks --watch` run straight after a push can print "no checks reported" and exit. Re-run it.
- On 2026-11-11 the DEV-89 PR #117's CI run 43095530887 sat `queued` for about an hour with no jobs, while GitHub status was green.
  - `gh run cancel` and `gh run rerun` both refused.
  - An empty commit (`240fd4b`) started a fresh run that passed.
  - While a run is queued, `gh pr checks` says "no checks reported" and the PR's merge state reads `CLEAN`, so `CLEAN` doesn't mean the checks passed. Agents must see the named checks pass before they merge.
- Worktree isolation also refuses heredoc appends (`cat >> file <<EOF`).
- Worktree isolation refuses compound shell commands such as `sed && cat > file`, or `git` chained with `&&`, loops or `perl`. Run git one command per call, and use Edit and Write for file changes.
- To run the smoke test off the default ports (DEV-85, 2026-11-11), use `docker compose -p <unique-name> -f compose.yaml -f compose.build.yaml up -d --build --wait` with a `.env` holding `PORT=3400` and `APP_URL=http://localhost:3400`, then `BASE_URL=http://localhost:3400 pnpm smoke`. `compose.yaml` doesn't publish the database port, so the stack doesn't clash with the dev database. Tear it down afterwards.
- `gh pr merge --delete-branch` deletes the remote branch but not the local one while it's checked out in a worktree. The chief-of-staff cleans these up.

Related: [shipping flow](shipping-flow.md), [list and detail rollout](list-detail-rollout.md).

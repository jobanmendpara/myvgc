# What Sandcastle needs to run MyVGC in Docker

Checked 2026-11-26 for the factory map ("Map: a software factory from idea to merged PR"), ticket "What Sandcastle needs to run MyVGC in Docker". Sources: Sandcastle `@ai-hero/sandcastle` 0.14.0, `main` at commit `1b380ca` (2026-11-16), read with `gh api`. Paths below such as `docs/guide/run.md` are in that repo unless they start with this repo's folders. Claude Code facts are from [code.claude.com/docs/en/authentication](https://code.claude.com/docs/en/authentication). Nothing here was run in a container yet. The spike should check the items marked **verify**.

## Answer in short

- **The image** is a custom `.sandcastle/Dockerfile`: `node:24-bookworm` (not Sandcastle's default Node 22, which `engineStrict` refuses), `git`, `gh`, pnpm 10.28.0, Claude Code, and Playwright 1.63.0's Chromium with its system libraries. No Postgres is needed: the API tests and `pnpm preview` both use PGlite in process. `pnpm install` must run inside the container, because the host's `node_modules` holds macOS binaries.
- **Claude Code login**: run `claude setup-token` once on the host and put the one-year token in `.sandcastle/.env` as `CLAUDE_CODE_OAUTH_TOKEN`. It uses the claude.ai subscription. Any number of sandboxes can use the same token; they share the subscription's limits. The token can't fetch claude.ai connectors, so the agent in the sandbox has no Linear.
- **Git and GitHub**: the host's global git config, with its `insteadOf` rewrite and 1Password SSH key, does not reach the container. The container gets only `user.name` and `user.email`. Commits work out of the box. Pushing from inside needs a `GH_TOKEN` and an HTTPS URL, because `origin` is `git@github.com:…`. Sandcastle's own factory does it the other way: the agent only commits, and the host script pushes and opens the PR. That is the recommendation here too.
- **Branches**: use `createWorktree({ branchStrategy: { type: "branch", branch } })` with a base of `origin/main`, one branch per ticket. Then run the Implementer and the Reviewer in one `createSandbox()`, so `node_modules` installs once.
- **Two at once**: no clashes in ports or databases. Each container has its own network namespace and its own PGlite, and `docker()` publishes no ports. The limit is the Docker VM: 8 CPUs and about 7.7 GiB here. Give each sandbox `memory: "3g"`.
- **Skills**: the project's `.claude/skills` are tracked in git, so they are in every worktree. Claude Code in the sandbox loads them along with `CLAUDE.md`. User-level skills, plugins and MCP servers (the Linear plugin included) are not there.
- **Surprises**: Sandcastle never retries on a 429 and, as the source reads, keeps no session when the agent exits non-zero, so "resume after a 429" is the factory's job (see below). `.sandcastle/` worktrees live inside the main checkout, so the factory runs from there.

## The image

What Sandcastle requires of a custom Dockerfile (`docs/guide/init.md`, "Custom Dockerfile"): a non-root `agent` user, `git`, `gh`, and the Claude Code CLI on `PATH`. Its template (`src/InitService.ts`, `CLAUDE_CODE_DOCKERFILE`; Sandcastle's own `.sandcastle/Dockerfile`) starts `FROM node:22-bookworm`, renames the `node` user to `agent` with `AGENT_UID`/`AGENT_GID` build args, installs Claude Code with `curl -fsSL https://claude.ai/install.sh | bash` as that user, and ends with `ENTRYPOINT ["sleep", "infinity"]`. Sandcastle then runs every command with `docker exec`.

`sandcastle docker build-image` passes `--build-arg AGENT_UID=$(id -u)` and `AGENT_GID=$(id -g)` (`docs/guide/cli.md`). At start-up, `docker()` checks that the image's UID matches (`src/sandboxes/docker.ts`, `checkImageUid`). Here that is 501:20. GID 20 is `dialout` in Debian, and the template's `groupmod -o` allows the clash.

What MyVGC adds:

| Need | Why | Line in the Dockerfile |
| - | - | - |
| Node 24 | `package.json` has `engines.node: ^24.11.0` and `pnpm-workspace.yaml` has `engineStrict: true` | `FROM node:24-bookworm` |
| pnpm 10.28.0 | `packageManager` in `package.json` | `RUN corepack enable` as root, or `npm i -g pnpm@10.28.0` |
| `gh` | Sandcastle requires it. The agent uses it to read the PR and CI state | the GitHub CLI apt repo, as in Sandcastle's own Dockerfile |
| Chromium for Playwright 1.63.0 | `pnpm screenshots` (`e2e/scripts/screenshots.ts` launches `chromium`) and `pnpm smoke` | as root: `npx playwright@1.63.0 install-deps chromium`; as `agent`: `npx playwright@1.63.0 install chromium` (browsers go to `~/.cache/ms-playwright`) |
| No Postgres | `apps/api/test/db.ts` makes a `new PGlite()` with migrations for each test; `scripts/preview.ts` runs the API "on a throwaway in-process database" | none |

Debian, not Alpine: Playwright's browsers need glibc. The production `Dockerfile` (`node:24-alpine`) is the wrong base.

**Dependencies.** Sandcastle's own scripts use `copyToWorktree: ["node_modules"]` with an `npm install` hook. MyVGC can't copy: `onlyBuiltDependencies` lists `esbuild`, `@parcel/watcher` and `@tailwindcss/oxide`, which ship native binaries, and the host's are for macOS. So run `pnpm install --frozen-lockfile` as a sandbox hook, with `timeoutMs` well above the default 60 s (`docs/guide/hooks.md`). The host's `node_modules` is 740 MB. To avoid downloading everything each time, mount a host folder as the pnpm store (`docker({ mounts: [{ hostPath: "~/.cache/myvgc-sandcastle-pnpm", sandboxPath: "/home/agent/.local/share/pnpm/store" }] })`). Don't mount the macOS store at `~/Library/pnpm/store`. **Verify** how long the install takes over Docker Desktop's bind mount, and whether pnpm falls back to copying across the mount.

**The smoke test.** `pnpm smoke` runs against the built image under Compose (`.github/workflows/smoke.yml`, `e2e/playwright.config.ts`), and the sandbox has no Docker. There are two options: rely on CI's required `smoke / smoke` check, or point `BASE_URL` at `pnpm preview` inside the container. **Verify** whether the smoke test passes against `pnpm preview`'s seeded database. Giving the sandbox the host's Docker socket (`groups`, `mounts`) would work, but it hands the agent the host.

## Claude Code login with the subscription

- `claudeCode()` runs `claude --print --verbose --dangerously-skip-permissions --output-format stream-json --model <model>`, with the prompt on stdin (`src/AgentProvider.ts`). The default flag is replaced by `permissionMode` when that is set (`docs/guide/agent-providers.md`). There's no `--bare`, which matters because bare mode doesn't read `CLAUDE_CODE_OAUTH_TOKEN`.
- `claude setup-token` makes "a one-year OAuth token". It "authenticates with your Claude subscription and requires a Pro, Max, Ultra, Team, or Enterprise plan. It can only make model requests, so it can't establish Remote Control sessions or fetch claude.ai connectors. MCP servers you configure locally still work." (Claude Code authentication docs, "Generate a long-lived token".)
- Precedence: `ANTHROPIC_AUTH_TOKEN`, then `ANTHROPIC_API_KEY`, then `apiKeyHelper`, then `CLAUDE_CODE_OAUTH_TOKEN`. So the map's fallback, "an API key if limits keep being hit", is just adding `ANTHROPIC_API_KEY` to `.sandcastle/.env`. It wins over the token.
- Sandcastle reads only the keys that `.sandcastle/.env` declares, taking each value from that file or, if it's empty there, from `process.env` (`src/EnvResolver.ts`). It forwards them into the container. Sandcastle's own workflows pass the token explicitly: `claudeCode(model, { env: { CLAUDE_CODE_OAUTH_TOKEN } })` (`.sandcastle/agent-workflows/shared/common.ts`).
- **Sharing**: nothing in the docs ties a token to one session or machine. Two sandboxes send the same token and draw on one subscription's usage, so the map's cap of 2 is the lever for limits. **Verify** that a fresh container needs no onboarding state (`~/.claude.json`) in `--print` mode.

## Git and GitHub from the sandbox

How the Docker sandbox sees git (`docs/guide/branch-strategies.md`, "How it works"; `src/sandboxSetup.ts`):

- The worktree and the repo's `.git` are bind-mounted. `.git/config`, `.git/hooks`, `.git/info` and the worktree's `.git` file are **read-only**, so `git config` without `--global` fails inside.
- Sandcastle writes only `safe.directory`, `user.name` and `user.email` into the container's own `~/.gitconfig`. The host's `~/.gitconfig` is not mounted.

What that means for the host problems in `docs/wiki/parallel-agents.md`:

- The host's `url.git@github.com:.insteadof https://github.com/` (checked: it's the only such key in the global config) doesn't apply inside, so HTTPS stays HTTPS.
- There's no SSH key or 1Password agent inside, so the "agent refused operation" failures can't happen, but SSH can't work either. `origin` is `git@github.com:jobanmendpara/myvgc` and lives in the read-only `.git/config`.
- Commits aren't signed, either on the host (no `commit.gpgsign` in the global config) or by `main`'s protection (`required_signatures: false`; required checks `check` and `smoke / smoke`). So unsigned commits from the container are fine.

Two ways to push and open the PR:

1. **The host does it (recommended).** The agent commits. After the Reviewer, the factory script on the host runs `git push https://jobanmendpara@github.com/jobanmendpara/myvgc.git <branch>` (the HTTPS form that works with the osxkeychain helper, per `parallel-agents.md` 2026-11-23), then `gh pr create`, then `gh pr merge <n> --auto --merge --delete-branch`, then loops on `scripts/wait-for-checks.sh <n>`. This is Sandcastle's own pattern: `.factory/implement-task.ts` says "Commits landed on FACTORY_BRANCH will be pushed and opened as a PR automatically" by the daemon, outside the sandbox. It keeps a GitHub write token out of the agent's reach. It also takes the Bash tool's 180-second limit out of the waiting, since a plain Node script has no such limit.
2. **The agent does it.** Put a fine-grained `GH_TOKEN` (this repo only: Contents, Pull requests, read and write) in `.sandcastle/.env`. Add a sandbox hook that runs `gh auth setup-git` and `git config --global url."https://github.com/".insteadOf git@github.com:`. Both write the container's global config, which isn't read-only. Sandcastle's init suggests exactly those token scopes when "your prompts have the agent push branches or open pull requests" (`src/InitService.ts`).

With option 1, a failed check means another `sandbox.run()` (or a fresh `run()` on the same `branch`) with the failing log in the prompt, up to the map's 2 fix rounds. The agent still needs read access to see CI logs itself. A read-only `GH_TOKEN` gives it that.

## Branches, iterations and what comes back

- **Branch strategy** (`docs/guide/branch-strategies.md`): `head` (the default for `docker()`) writes into the host checkout, so it's no good here. `merge-to-head` merges locally into HEAD, which is wrong for one-PR-per-ticket. Use `branch`. `createWorktree()` accepts `baseBranch` (used in `.factory/implement-task.ts` with `origin/main`). Re-running on the same branch reuses the worktree and "fast-forwards it from `origin` when safe". Worktrees go under `.sandcastle/worktrees/`, and the scaffolded `.sandcastle/.gitignore` ignores `.env`, `logs/` and `worktrees/`.
- **One container, two agents**: `worktree.createSandbox()` and then `sandbox.run()` for the Implementer and again for the Reviewer. Commits build up on the branch, and installed dependencies persist (`docs/guide/run.md`, "Multi-run implement-then-review"). `sandbox.exec("pnpm test")` gives the factory its own check between steps; a non-zero exit is returned, not thrown. On close, a dirty worktree is kept on disk.
- **Iterations and the completion signal** (`docs/guide/iterations.md`): `maxIterations` defaults to 1. The loop stops early when the output contains `<promise>COMPLETE</promise>` (or your `completionSignal`), which the prompt must ask for. `idleTimeoutSeconds` (600) fails a silent agent. `completionTimeoutSeconds` (60) succeeds when the agent has signalled but a child process keeps it alive, a real risk with `gh` or `pnpm preview` left running.
- **Structured output** (`docs/guide/structured-output.md`): `Output.object({ tag, schema })` with a Zod schema returns typed JSON from the agent. It suits the Reviewer's verdict, for example each acceptance criterion with its test and proof it can fail. `maxRetries` resumes the same session to fix bad JSON. It needs `maxIterations: 1`.
- **Hooks** (`docs/guide/hooks.md`): `host.onWorktreeReady` runs on the host in the worktree before the container starts. `sandbox.onSandboxReady` runs inside, in parallel, with `sudo: true` available on Docker. A non-zero exit fails setup.
- **Run logs** (`docs/guide/run-logs.md`): by default each run writes a log under `.sandcastle/logs/` and returns `result.logFilePath`. `onAgentStreamEvent` hands every text chunk, tool call and raw stdout line to the factory. That covers the map's "every run writes a run log" and parking a run with its log.
- **Results** (`docs/guide/run.md`): `commits`, `branch`, `iterations[].sessionId`, `sessionFilePath`, `usage` (tokens) and `contextWindow`, which feed the "cost and usage" side of model choice.

## Sessions and resuming after a 429

- After each iteration, Sandcastle copies Claude Code's session JSONL to the host's `~/.claude/projects/<encoded-path>/`, rewriting `cwd` so a plain `claude --resume <id>` works on the host (`docs/guide/agent-sessions.md`). `run({ resumeSession })` and `result.resume()` / `fork()` continue it in a new sandbox, for one iteration only.
- Sandcastle **does not retry** on rate limits or other provider errors (`.out-of-scope/provider-error-retry.md`: "Error handling and retry logic belong in the provider/harness layer").
- As read in `src/Orchestrator.ts`, a non-zero exit becomes an `AgentError` carrying only `message` and `preservedWorktreePath`. Session capture runs only after a clean stop. So after a 429 the factory has the worktree and commits, but no `sessionId` from Sandcastle. To resume anyway, take the session id from the first `system`/`init` line seen through `onAgentStreamEvent` (raw events), and mount a host folder at `/home/agent/.claude/projects` so the JSONL survives the container. Then call `run({ resumeSession })` once the limit resets. **Verify** both, or settle for a fresh run on the same branch, which keeps the commits but not the conversation.

## Two sandboxes at once

- **Names and branches**: containers are named `sandcastle-<uuid>`. Each ticket has its own branch and worktree. Forks and concurrent runs are safe only with distinct `branch` values (`docs/guide/agent-sessions.md`, "Fork is session-only").
- **Ports**: `docker()` publishes no ports and uses the default bridge network. Ports bound inside a container (`pnpm preview`'s 3100–3999, a dev server) are in that container's own network namespace, so two sandboxes can't clash with each other or with the host's `pnpm dev` on 3000/3001. The host can't reach them either, so screenshots have to be taken inside.
- **Databases**: none shared. PGlite is per process, and nothing reads the host's `.env` or dev Postgres. `pnpm up:local` and `pnpm db:up` aren't available inside, which is what keeps the dev database safe (see the `up:local` memory note in `parallel-agents.md`).
- **Disk and memory**: each worktree gets its own Linux `node_modules` (on the order of the host's 740 MB) plus a Chromium. Docker Desktop here reports 8 CPUs and 8,215,117,824 bytes of memory. Vitest, Nuxt and Chromium in two containers at once could exhaust that, so set `docker({ memory: "3g", cpus: 3 })` and raise Docker Desktop's memory if needed. Remove worktrees when their PR merges (`wt.close()` keeps dirty ones).

## Skills inside the sandbox

- Claude Code runs with the worktree as its working directory, so it loads that checkout's `CLAUDE.md` and `.claude/skills/`. All 103 files under `.claude/skills` are tracked in git (`git ls-files .claude`), so every worktree has them (research, tdd, code-review, pr, implement and so on).
- Missing inside: the host's `~/.claude` (user skills, plugins such as the Linear plugin, settings, memory) and claude.ai connectors (the token can't fetch them). Skills that talk to Linear can't work in the sandbox unless the factory adds an MCP server with a Linear API key through a project-level config. **Verify** that if the agent must touch Linear at all. The simpler path is that the host factory does all the Linear work (labels `ready-for-agent` and `needs-human`, comments, status) and passes the ticket's text to the agent as a prompt argument.
- `CLAUDE.md`'s shipping rules (`gh pr merge --auto`, `scripts/wait-for-checks.sh`) assume the agent ships its own PR. Under option 1 above, the Implementer's prompt should say not to push, and the factory takes over those steps.

## Open items for the spike

1. Build the image and run one `claude --print` with `CLAUDE_CODE_OAUTH_TOKEN` in a fresh container. Check that it needs no onboarding.
2. Time `pnpm install --frozen-lockfile` with and without the mounted pnpm store.
3. Run `pnpm test`, `pnpm typecheck` and `pnpm screenshots` inside the container. Run `pnpm smoke` against `pnpm preview`.
4. Kill a run mid-way (to stand in for a 429) and resume it from the session id found in the stream.
5. Run two sandboxes at once with the memory cap and watch the Docker VM's memory.

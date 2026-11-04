# Sandcastle as a software factory for MyVGC

Researched 2026-11-04 for MyVGC.

## How this was researched (read first)

- **Sandcastle** (`mattpocock/sandcastle`) was read from a clone of `main` at commit `8c2c5689` (2026-11-03, "fix: install maintained Pi package (#1519)"), 22 commits after tag `v0.14.0`. The clone was shallow (depth 50), so older history was not read. Paths below are relative to that repo, for example `docs/guide/hooks.md` is `https://github.com/mattpocock/sandcastle/blob/8c2c5689/docs/guide/hooks.md`. The npm registry (`npm view @ai-hero/sandcastle`) was used for versions, licence and dist-tags.
- **Not read:** the GitHub API was blocked for that repo in this session, so issues and releases were not read through `gh`. The open-issue list in section 5 comes from a **WebFetch** of `github.com/mattpocock/sandcastle/issues`, which summarises the page through a small model. Treat it as **[secondary]** and re-check before relying on any single issue. No blog posts or third-party write-ups were used.
- **Nothing was run.** Sandcastle was not installed or executed, and no Docker image was built. Every statement about how it behaves is from its docs and source, not from a trial. This sandbox has Docker's CLI but I did not start a daemon.
- **MyVGC** was read from `/home/user/myvgc` (`main`, a single visible commit `2cd28bd`).
- Tags: **[verified]** is read directly in the cited file. **[inference]** is my reasoning about MyVGC. **[unverified]** could not be checked.

## Summary

- **What it is.** Sandcastle is a TypeScript library (`@ai-hero/sandcastle`, MIT) for running coding agents (Claude Code, Codex, Pi, Copilot, Cursor, OpenCode) inside isolated sandboxes (Docker, Podman, Bubblewrap, Seatbelt, and several cloud providers). It leaves the commits on a branch or merges them back. You write the loop as an ordinary TypeScript script. It has no opinion about issue trackers or workflow. [verified]
- **Fit.** The `parallel-planner-with-review` template is almost exactly the "pick up ready issues, implement in parallel, review, merge" factory the question describes, and MyVGC's checks (`typecheck`, `lint`, `format:check`, `test`) run with **no Postgres and no browser**, so they fit a sandbox well. [verified template, inference on fit]
- **Why it is not a free win.** (1) MyVGC currently has **no open issues**: all 15 issues in `.scratch/` are done, so the factory would have no input until the next spec is split into issues. (2) The templates hard-code `npm`, and MyVGC uses pnpm. (3) Parallel agents will collide on Drizzle migration numbers. (4) The Playwright smoke test needs Docker Compose, which a sandbox can't sensibly run, so it has to stay in GitHub Actions. (5) Sandcastle is pre-1.0 (`0.14.0` is `latest`), and a `1.0.0-v1-next.*` prerelease line was being published on the day of this research. [verified/inference]
- **Recommendation.** Worth a small, time-boxed trial: one `blank`/`simple-loop` run on one `.scratch` issue, then the parallel template only if that works. Do not build more than that until a real backlog exists. See [Suggested first steps](#suggested-first-steps).

---

## 1. What Sandcastle is

| Fact | Source | Status |
|---|---|---|
| Package `@ai-hero/sandcastle`, version `0.14.0`, MIT, "CLI for orchestrating AI agents in isolated sandbox environments"; a `sandcastle` bin | `package.json`, `LICENSE` | verified |
| npm `latest` is `0.14.0`; a second dist-tag `v1-next` points at `1.0.0-v1-next.20261104174329`; the package was first published 2026-03-26 and has about 46 `0.x` versions since | `npm view @ai-hero/sandcastle dist-tags time` | verified |
| `main`'s `CHANGELOG.md` has 52 release sections; `0.1.0` already removed a public option (`agent` hidden from `RunOptions`), so breaking changes happen on `0.x` | `CHANGELOG.md` lines 656–660 | verified |
| "A TypeScript library for orchestrating AI coding agents in isolated sandboxes": you call `sandcastle.run()`, it sandboxes the agent with a branch strategy, and "the commits made on the branches get merged back" | `README.md`, `docs/guide/getting-started.md` | verified |
| Needs Git plus a sandbox provider. Native `bwrap()` (Linux/WSL2, needs `bubblewrap`) and `seatbelt()` (macOS 14+) need no image or daemon; Docker/Podman are image-based; Daytona, E2B, Fly.io Sprites, Modal and Vercel are cloud providers | `docs/guide/getting-started.md` | verified |
| Install: `npm install --save-dev @ai-hero/sandcastle`, then `npx @ai-hero/sandcastle init`, then fill `.sandcastle/.env`, then `npx tsx .sandcastle/main.mts` | `docs/guide/getting-started.md` | verified |
| The tool's own repo is dogfooded: `.sandcastle/run.ts` runs a planner and implementers over its own issues, and its remote has many `agent/issue-NNNN-…` branches (count not taken) | `.sandcastle/run.ts`, `git ls-remote --heads origin` | verified |

The smallest possible use is one call: [verified, `docs/guide/core-concepts.md`]

```typescript
const result = await run({
  agent: claudeCode("claude-opus-4-8"),
  sandbox: docker(),
  promptFile: ".sandcastle/prompt.md",
});
// result.commits, result.branch, result.iterations
```

## 2. Core concepts (what you configure)

**Agent providers.** `claudeCode()`, `codex()`, `pi()`, `copilot()`, `cursor()`, `opencode()`. Claude Code options include `effort` and `permissionMode`; by default AFK runs use `--dangerously-skip-permissions`, replaced if `permissionMode` is set. `docs/guide/agent-providers.md`. [verified]

**Sandbox providers.** For `docker()` the options include `imageName`, `mounts` (for example a package-manager cache), `network`, `env`, `capDrop`, `cpus`, and `groups`/`devices`. `docs/guide/run.md` ("All options"). Custom providers can be written with `createBindMountSandboxProvider` or `createIsolatedSandboxProvider`. [verified]

**Branch strategies.** `docs/guide/branch-strategies.md`: [verified]
- `head`: the agent writes straight into the host working directory (default for Docker/Podman).
- `merge-to-head`: a temporary branch in a git worktree, merged into the host's current branch when done; on a merge conflict Sandcastle aborts the merge so HEAD is unchanged and keeps the temp branch. Described there as the safe default "for CI or unattended runs".
- `branch`: commits land on a branch you name, in a worktree under `.sandcastle/worktrees/`. Re-running with the same branch reuses the worktree.
- `createWorktree()` and `createSandbox()` give a long-lived worktree or sandbox so an implementer and a reviewer can run one after the other on the same branch.
- The sandbox gets the repo's `.git` so the agent can commit, with `.git/config`, `.git/hooks` and `.git/info` mounted read-only.

**Iterations and completion.** `maxIterations` (default 1) is the number of agent passes; the loop stops early when the agent prints `<promise>COMPLETE</promise>` (a convention your prompt must tell it to follow). `idleTimeoutSeconds` defaults to 600. `docs/guide/iterations.md`, `docs/guide/run.md`. [verified]

**Prompts.** A prompt file can hold `{{KEY}}` arguments (`promptArgs`), built-in `{{SOURCE_BRANCH}}` and `{{TARGET_BRANCH}}`, and `` !`shell command` `` expressions that run **inside the sandbox** after setup hooks and are replaced with their stdout. `` !`…` `` found inside an argument value is not executed, which the docs say makes it safe to pass issue text through `promptArgs`. `docs/guide/prompts.md`. [verified]

**Hooks.** `host.onWorktreeReady`, `host.onSandboxReady`, `sandbox.onSandboxReady` (default 60 s each; `timeoutMs` overrides; a non-zero exit fails the setup). `copyToWorktree` copies host paths such as `node_modules` into the worktree. `docs/guide/hooks.md`. [verified]

**Structured output.** `Output.object({ tag, schema })` parses JSON inside an XML tag against a Zod schema (any Standard Schema validator); needs `maxIterations: 1`; `maxRetries` resumes the same session to fix a bad tag. `docs/guide/structured-output.md`. [verified]

**Logs.** A run log is written under `.sandcastle/logs/` by default; `onAgentStreamEvent` forwards events. `docs/guide/run-logs.md`. [verified]

**Credentials.** `.sandcastle/.env` holds `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) or `ANTHROPIC_API_KEY`, and `GH_TOKEN` for `gh`. Native sandboxes hide the host's stored logins; only the env vars Sandcastle passes in reach the agent. `docs/guide/getting-started.md`, `docs/guide/sandbox-providers.md`, `src/InitService.ts` line 922. [verified]

**Issue trackers.** Sandcastle embeds no tracker. `init` substitutes three shell commands (`LIST_TASKS_COMMAND`, `VIEW_TASK_COMMAND`, `CLOSE_TASK_COMMAND`) into the prompt files; the choices are GitHub Issues (default: open issues with the label `Sandcastle`), Beads, or **Custom**, where you fill in your own three commands. `docs/agents/adding-an-issue-tracker.md`, `src/InitService.ts` lines 741–775. [verified]

### The templates

`sandcastle init --template …` offers `blank`, `simple-loop`, `sequential-reviewer`, `parallel-planner` and `parallel-planner-with-review`. `docs/guide/init.md`. [verified]

`src/templates/parallel-planner-with-review/main.mts` is the relevant one: [verified]

1. **Plan.** One Opus run reads the issue list, builds a dependency graph, and emits `<plan>{"issues":[{id,title,branch}]}</plan>`. Branch names are deterministic (`sandcastle/issue-{id}`), so re-planning keeps progress. The plan prompt treats two issues as dependent if they "modify overlapping files or modules".
2. **Execute and review**, concurrently via `Promise.allSettled`. Per issue, `createSandbox({ branch })`, then an implementer (up to 100 iterations, Sonnet) and, if it made commits, a reviewer in the same sandbox.
3. **Merge.** One agent merges all completed branches into the current branch, resolves conflicts, runs the tests, and closes the issues.
4. The outer loop repeats up to 10 times so newly unblocked issues get picked up.

The implementer prompt tells the agent to use red-green-refactor, run `npm run typecheck` and `npm run test` before committing, prefix commit messages with `RALPH:`, leave a comment on the issue, and work on exactly one issue. The templates contain no `git push` or `gh pr create` (checked with grep over `src/templates`): **by default everything stays on local branches.** [verified]

## 3. What MyVGC has today

| Area | What is there | Source |
|---|---|---|
| Planning | A design interview produces `.scratch/<feature>/spec.md` (with a `Labels: ready-for-agent` line), then numbered issue files `.scratch/<feature>/issues/NN-slug.md` with **What to build**, **Blocked by**, **Status** and checkbox acceptance criteria. Two features so far: `teams` (6 issues) and `tournaments` (9 issues). **All 15 are done**, so there is no open backlog. | `.scratch/tournaments/spec.md`, `.scratch/tournaments/issues/04-link-team-snapshot.md` |
| Issue format drift | `teams` issues use a plain `Blocked by: 01` line and no Status; `tournaments` issues use bold `**Blocked by:**` and `**Status:** done`. | `.scratch/teams/issues/01-skeleton.md`, `.scratch/tournaments/issues/*.md` |
| CI | `pnpm install --frozen-lockfile`, then `typecheck`, `lint`, `format:check`, `test`, plus a separate smoke job. Node comes from `.nvmrc` (`24`). | `.github/workflows/ci.yml`, `.nvmrc` |
| Smoke | Builds the Docker image, starts it with Compose and Postgres, runs Playwright against it. | `.github/workflows/smoke.yml`, ADR 13 |
| Tests | Vitest everywhere. Core unit tests; API tests through `app.request()` against **PGlite**, so no Postgres is needed. | ADR 13, `apps/api/package.json` |
| Stack | pnpm 10.28 monorepo (`apps/api` Hono + Drizzle, `apps/web` Nuxt SPA, `packages/core`, `e2e`). `postinstall` in `apps/web` runs `nuxt prepare`. | `package.json`, `apps/web/package.json`, ADR 8 |
| Rules for agents | `CLAUDE.md` is short and good: use the `CONTEXT.md` glossary, API code only in Hono, domain logic in `packages/core` with no I/O, follow the ADRs or write a new one, test through public interfaces. | `CLAUDE.md` |
| Licence | AGPL-3.0-only code (ADR 1). | `package.json`, ADR 1 |
| Agent config | No `.claude/` directory, no `AGENTS.md`. | repository listing |
| Roadmap | Next: Teamsheet export (blocked on checking the official format, `docs/risks.md`), then Team builder, then recording individual Games. | `docs/roadmap.md` |

**Inference:** the `.scratch/` layout and the `ready-for-agent` label look like the output of the mattpocock-skills "spec to issues" workflow that is installed in this environment. I did not read those skill files, so I can't confirm that. If it is right, the same author's labels and Sandcastle's `Sandcastle` default label are two different conventions to reconcile.

## 4. Mapping Sandcastle onto MyVGC

### 4.1 Where each stage of the factory would live

| Factory stage | Today | With Sandcastle |
|---|---|---|
| Idea to spec to issues | Interactive design interview, files in `.scratch/` | Unchanged. Keep this human-in-the-loop; Sandcastle has no part in it. |
| Choose what is ready | A human picks the next issue | **Planner run**: reads the open issues and their `Blocked by` lines, returns a typed `<plan>`. |
| Implement | A Claude Code session | **Implementer run** per issue, in a sandbox on branch `sandcastle/issue-<id>`. |
| Feedback loop | `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` | Same commands, named in the implementer prompt and a `pnpm` version of the template. |
| Review | PR review by the owner | **Reviewer run** in the same sandbox; the owner still reviews the PR. |
| Integrate | Merge PR on GitHub | The template merges locally; MyVGC would add a push and PR step in its own script (see 4.3). |
| Smoke and release | GitHub Actions on push and tags | Unchanged. |

### 4.2 Issue source: three options [inference]

1. **Custom tracker over `.scratch/`.** Write the three commands in `.sandcastle/main.mts`: *list* prints every issue file whose Status isn't `done`; *view* prints one file; *close* rewrites its Status line. Pros: no migration, issues stay versioned with the code. Cons: the status edit is a commit on the agent's branch, so it merges with the code; the two issue formats must first be unified (section 6); the template prompts say `gh issue comment`, which would need rewording.
2. **GitHub Issues with the `Sandcastle` label.** Works with the default template and the repo already lives on GitHub. Cons: someone has to push each `.scratch` issue to GitHub (a one-off `gh issue create` loop), and `.scratch/` would duplicate or be replaced.
3. **Both.** `.scratch` stays the authoring format; a small script publishes issues to GitHub when they are `ready-for-agent`. More moving parts.

Option 1 is the smallest first experiment, since there are no GitHub issues to migrate. Option 2 is better if the owner wants the factory's progress visible in GitHub's UI.

### 4.3 The sandbox image and hooks

A MyVGC `.sandcastle/Dockerfile` would start from Sandcastle's generated one (`node:22-bookworm`, git, curl, jq, `gh`, a non-root `agent` user, the Claude Code CLI; see `.sandcastle/Dockerfile` in Sandcastle's repo and `docs/guide/init.md`) and change: [inference, based on the verified template]

- **Node 24**, to match `.nvmrc` and the product Dockerfile (`node:24-alpine`). Prefer Debian (`node:24-bookworm`) over Alpine because the generated image is Debian-based and Sandcastle documents Debian as the target for tracker CLIs.
- **pnpm** through `corepack enable` (the repo pins `packageManager: pnpm@10.28.0`).
- **No Postgres container.** PGlite covers the API tests. No Playwright browsers either, unless smoke is moved inside the sandbox (not recommended, below).
- Hook: `pnpm install --frozen-lockfile` with `timeoutMs` raised (the default is 60 s). A `docker()` `mounts` entry for the host pnpm store would avoid re-downloading on every sandbox. The `apps/web` `postinstall` runs `nuxt prepare`, so install is not trivial.
- **Do not rely on `copyToWorktree: ["node_modules"]`** as the templates do. In a pnpm workspace `node_modules` also exists under each app and package, and Sandcastle's own issue #1467 reports that the templates' install hook rewrites the host's `node_modules` **[secondary]**. A clean install from a cached store is simpler.
- The prompts in the templates say `npm run typecheck` and `npm run test`; they must say `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm test`. Sandcastle's `init` detects pnpm for its own install hints but the template prompts are written with `npm` (grep of `src/templates` and `src/InitService.ts`). [verified for the text, inference that `init` doesn't rewrite it]

### 4.4 Parallelism and where it will hurt

Planning for parallel issues is cheap in Sandcastle; making them not collide is the work. Concrete MyVGC hazards: [inference]

- **Drizzle migrations.** `apps/api/drizzle/` has files numbered `0000` to `0006` plus `meta/_journal.json` and snapshots. Two parallel issues that both run `pnpm --filter @myvgc/api db:generate` will both write `0007_…` and both edit the journal. The planner prompt considers "overlapping files" a dependency, but it can only guess. Safer: tell the planner in the prompt that any issue touching the schema is serial, or add `Touches: schema` to the issue format.
- **`CONTEXT.md` and ADRs.** Any issue that adds a term or an ADR edits shared files.
- **Shared route and navigation files** (tournaments issue 01 existed purely to prevent this kind of conflict).
- The merge agent resolves textual conflicts, but a migration journal that merges cleanly can still be wrong. The merge prompt runs typecheck and tests, and PGlite runs the migrations, so a broken journal would likely fail the API tests. [inference]

### 4.5 What stays in GitHub Actions

The smoke test builds the image and runs Compose with Postgres. Running that inside a sandbox would need Docker-in-Docker or a mounted host socket (`docker()` has a `groups` option for a mounted socket, documented only as an example). That hands the agent control of the host's Docker, so don't. Let CI run smoke on the pushed branch or PR, exactly as it does now (`ci.yml` runs on every push). [inference]

### 4.6 A sketch of the loop [inference]

```typescript
// .sandcastle/main.mts (sketch, not run)
import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

const hooks = { sandbox: { onSandboxReady: [
  { command: "corepack enable && pnpm install --frozen-lockfile", timeoutMs: 600_000 },
]}};
// 1. planner: sandcastle.run({ ..., output: Output.object({ tag: "plan", schema }) })
// 2. per issue: createSandbox({ branch: `sandcastle/issue-${id}`, ... }) -> implementer -> reviewer
// 3. then, in the host script (not the agent): git push origin <branch> && gh pr create ...
```

Pushing and opening PRs from the host script, with the owner's own `gh` login, would keep the sandbox's `GH_TOKEN` out of the push path. Sandcastle documents `GH_TOKEN` as a way to let the agent use `gh`, so a token is only needed if the agent itself comments on or closes issues. [inference]

## 5. Risks, costs and limitations

| Risk | Detail | Status |
|---|---|---|
| **Maturity** | `0.14.0`, about 7 months old, 46 `0.x` releases, a breaking change in `0.1.0`, a `1.0.0-v1-next.*` prerelease line published during this research. Pin the exact version. | verified |
| **Open issues** | About 105 open at research time. Ones that matter here: #1537 Docker/Podman sandboxes survive a SIGKILL of the host Node process; #1536 worktree reuse swallows a failed `fetch` and may reuse a stale base; #1362 `RunResult.commits` can include host commits if the branch moves during a `merge-to-head` run; #1467 template install hook rewrites host `node_modules`. | secondary (WebFetch of the issues page) |
| **Token spend** | Unmeasured. The template allows 100 implementer iterations per issue and 10 outer cycles, with an Opus planner. Lower `maxIterations`, set a cap on issues per cycle, and run with a subscription token or a budgeted API key. I have no figures for MyVGC. | inference |
| **Credentials** | One agent login (`CLAUDE_CODE_OAUTH_TOKEN` or API key) and optionally a `GH_TOKEN`. Use a fine-grained token limited to this repo (issues and PRs only). Keep `.sandcastle/.env` out of git (the generated `.sandcastle/.gitignore` ignores `.env`, `logs/`, `worktrees/`). | verified for the ignore list |
| **Network** | Docker's network is open by default; the docs list `network` as the only isolation option and say native sandboxes can reach the host's localhost. Prompt injection from issue text is the main concern. Sandcastle's native sandboxes are described as protecting against "accidents and prompt-injection attacks", but not kernel escapes. An egress allow-list is **not** documented. | verified (`docs/guide/sandbox-providers.md` "Containment"); egress filtering unverified |
| **Agent permissions** | AFK Claude runs with `--dangerously-skip-permissions` unless you set `permissionMode`. The sandbox is then the only barrier. | verified |
| **Merge conflicts** | See 4.4. | inference |
| **AGPL and ADRs** | Sandcastle is MIT and is a dev tool, not shipped in the MyVGC image, so AGPL (ADR 1) is unaffected. The real constraint is that agents must follow the ADRs; `CLAUDE.md` already says so. A new ADR is the agent's required way to deviate, so reviewers should look for unexpected ADR files. | inference |
| **Domain correctness** | The Champions rules in `docs/research/pokemon-champions-data.md` include claims marked unverified. An agent will treat anything in `CONTEXT.md` as truth. Keep unverified items (the official teamsheet format) out of `ready-for-agent`. | inference |
| **Sandbox on this machine** | `bwrap()` needs `bubblewrap` and, on Ubuntu 24.04+, an AppArmor profile (`docs/guide/sandbox-providers.md`). Docker needs a daemon. Which one the owner has is unknown. | unverified |

## 6. Prerequisites in MyVGC before a first run

1. **A ready backlog.** Pick the next feature (roadmap step 4, Team builder, is not blocked by the unverified teamsheet format) and run the usual spec-to-issues step so there are open issues. [inference]
2. **One issue format.** Use the `tournaments` layout everywhere (bold `Blocked by` and `Status`). Optional additions that help a planner: `Touches:` (schema, shared files) and a `Labels:` line copied from the spec.
3. **A one-line check command.** Add a root script, for example `"check": "pnpm typecheck && pnpm lint && pnpm format:check && pnpm test"`, so the prompts name one thing and always match CI. `CLAUDE.md` currently lists four separate commands. [inference]
4. **`CLAUDE.md` additions for AFK work:** the commit message convention, "one issue per run", "do not edit `.scratch/` other than your issue's Status", "do not generate a migration unless the issue says so", "do not add ADRs without asking". It is the one place both Claude Code and Sandcastle's agent will read. [inference]
5. **`.sandcastle/` files:** `Dockerfile`, `main.mts`, the prompt files (adapted for pnpm and the `CONTEXT.md` terms), `.env` (untracked). Add `.sandcastle/` to `.prettierignore` and ESLint's ignores if they would otherwise fail `pnpm format:check` and `pnpm lint`, which CI runs on the whole repo. The root `.prettierignore` already ignores `.scratch/` and `docs/`. [inference]
6. **CI trigger.** CI already runs on every push, so pushed `sandcastle/issue-*` branches get typecheck, lint, format, test and smoke with no workflow change. [verified in `ci.yml`]

## 7. Alternatives and when each is worth it

| Option | Good for | Weak for |
|---|---|---|
| **Claude Code sessions run by hand** (local or cloud, one per issue, in git worktrees) | Zero setup; MyVGC already works this way; a human is present to catch domain mistakes | Throughput: one issue at a time per attention span; no planning step |
| **Claude Code cloud sessions in parallel** (a session per issue on a branch) | Parallelism without owning any infrastructure | You launch and watch each one yourself; no typed plan, no automatic merge |
| **GitHub Actions** (label an issue, a workflow runs an agent and opens a PR) | Runs without your machine; visible in GitHub | Needs an agent action and secrets in Actions; each run installs from scratch; limited orchestration |
| **Sandcastle** | A scripted loop you own: planner, parallel implementers, reviewer, merge; any agent or sandbox; runs on your machine or a cloud sandbox | A new tool to keep working (pre-1.0), a Dockerfile to maintain, and the cost and conflict risks above |

**When it is worth it [inference]:** when there are regularly three or more independent, well-specified issues at once, and the owner would rather review PRs than drive sessions. MyVGC's own history is a mild argument for: `tournaments` had nine issues with a clear `Blocked by` graph (02 unblocks 03, 04, 05; 05 unblocks 06, 07). **When it is not:** one or two issues at a time, schema-heavy work, or anything that depends on unverified Champions rules.

## Suggested first steps

Prioritised; stop after any step where the result isn't convincing.

1. **Decide the sandbox.** Check whether Docker or Bubblewrap is available on the machine that will run it, and which agent login will be used. (10 minutes.)
2. **Make the backlog real.** Write the next spec and split it into `.scratch` issues in the `tournaments` format. Mark only unblocked, non-schema issues `ready-for-agent`.
3. **Add the `check` script and the `CLAUDE.md` AFK rules** from section 6. These help ordinary Claude Code sessions too, so they pay off even if Sandcastle is dropped.
4. **Trial run, one issue.** `npm install --save-dev @ai-hero/sandcastle@0.14.0` (exact version), `npx @ai-hero/sandcastle init --template simple-loop` (or `blank`) with Docker, then edit the Dockerfile (Node 24, corepack) and prompt (pnpm commands, glossary). Run it on a single small issue with `maxIterations` around 5 and read the log in `.sandcastle/logs/`. Record time, tokens and whether the branch passes CI untouched.
5. **Only then, parallel.** Move to the `parallel-planner-with-review` shape, with schema-touching issues forced serial, a cap on issues per cycle, and a host-side push and PR step.
6. **Revisit when `1.0.0` ships.** Check the changelog for breaking changes before upgrading the pin.

## Open questions

- **For the owner:** is the goal a factory that runs unattended overnight, or a faster way to work through a batch while present? The first needs the egress, budget and merge safeguards above; the second may be satisfied by parallel Claude Code sessions.
- **For the owner:** should issues live in `.scratch/` (versioned, local) or GitHub Issues (visible, `gh`-driven)? Section 4.2.
- Does a pnpm-workspace install work reliably inside the sandbox with a mounted store, and how long does it take? Untested.
- What does the `v1-next` prerelease change? I saw only its version and peer dependencies, not its source or changelog.
- Does a sandbox have a way to restrict outbound network to the model API, GitHub and the npm registry? Not documented in what I read.
- Whether Sandcastle's issue list was complete: only the first 25 of about 105 open issues came back, via a summarising fetch.

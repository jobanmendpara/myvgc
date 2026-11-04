# Sandcastle as a software factory for MyVGC

Researched 2026-11-04 for MyVGC. **Second version.** The first version looked only at `.scratch/` (15 issues, all done) and concluded there was no backlog. The real backlog is in Linear; this version is built around it.

## How this was researched (read first)

- **Sandcastle** (`mattpocock/sandcastle`) was read from a clone of `main` at commit `8c2c5689` (2026-11-03, "fix: install maintained Pi package (#1519)"), 22 commits after tag `v0.14.0`. A `git fetch` on 2026-11-04 showed `main` had not moved. Paths are relative to that repo, for example `docs/guide/hooks.md` is `https://github.com/mattpocock/sandcastle/blob/8c2c5689/docs/guide/hooks.md`.
- **Sandcastle releases, issues and versions** were re-checked this time: the npm registry JSON (`https://registry.npmjs.org/@ai-hero/sandcastle`, read directly), and `github.com/mattpocock/sandcastle/releases` and `/issues` through WebFetch. WebFetch summarises through a small model, so those two are **[verified, summarised fetch]**: the page is primary, the wording is not exact. `gh api` against that repo is still blocked in this session ("GitHub access to this repository is not enabled"); `raw.githubusercontent.com` and `git fetch` worked.
- **Linear** was read through the Linear MCP connector (read-only): the project, its 13 open issues with relations, attachments and comments, the 16 project documents, statuses and labels. Linear's product docs were read from `linear.app/docs/*` and `linear.app/developers/*` by WebFetch (same summarising caveat). Linear's MCP page and API pages were fetched; the GitHub page is `https://linear.app/docs/github` (the `/docs/github-integration` URL returns only a heading).
- **MyVGC** was read from `/home/user/myvgc` (branch `research/sandcastle-software-factory`, based on `main` `2cd28bd`; the clone is shallow, so only two commits are visible). GitHub's REST API for `jobanmendpara/myvgc` works from here and was used for issues and pull requests.
- **Nothing was run.** Sandcastle was not installed, no image was built, no tests were run, and nothing in Linear or GitHub was changed.
- Tags: **[verified]** read directly in the cited source. **[secondary]** read through a summarising fetch. **[inference]** my reasoning. **[unverified]** could not be checked.

## Summary

- **What Sandcastle is.** A TypeScript library (`@ai-hero/sandcastle`, MIT, `0.14.0`) that runs a coding agent, Claude Code included, in an isolated sandbox on a git branch. The loop is an ordinary script you own. It has no issue tracker built in. [verified]
- **MyVGC does have a backlog, and it is in Linear.** Team DEV, project MyVGC, 13 open issues (DEV-30 to DEV-42). Linear is the source of truth and GitHub Issues #5 to #17 are two-way mirrors of it. [verified]
- **The backlog is thin for an unattended agent.** Each issue is one to three sentences with no acceptance criteria. Of 13, none is ready to hand over as written; two are human-only decisions, three need a real-world artifact or outside accounts, and **DEV-32 is already built** (PR #4, merged 2026-11-04) apart from "Opponent Teams on Rounds". About three issues (DEV-36, DEV-33, DEV-35) could be ready after a short grooming pass. [verified/inference]
- **Linear fits Sandcastle through the host, not the sandbox.** Sandcastle's templates read a tracker with shell commands that run inside the sandbox (the default is `gh issue list --label Sandcastle`). Linear has no such CLI, and Linear relations (the "blocked by" links) do not sync to the GitHub mirror. Better: a small host-side script reads Linear, passes each issue to the agent as a prompt argument, and, afterwards, the host pushes a branch named with the Linear identifier and opens a pull request. Linear's own GitHub integration then moves the issue (In Progress when the pull request opens, Done on merge, by default). The sandbox never holds a Linear or GitHub credential. [verified for the parts, inference for the design]
- **Recommendation.** Do not build the full planner-and-merge factory. Spend an hour grooming three Linear issues, then run **one** trial on **DEV-36 (Merge duplicate Opponents)**: API and core only, no migration, testable through `app.request()`. Compare it against Linear's own delegate-to-agent "coding sessions" and against a plain Claude Code cloud session, which is what MyVGC does today. Go further only if the trial pull request passes CI untouched. See [Suggested first steps](#suggested-first-steps).

---

## 1. Sandcastle recap

| Fact | Source | Status |
|---|---|---|
| `@ai-hero/sandcastle` `0.14.0`, MIT, bin `sandcastle` (`dist/main.js`). npm `latest` is `0.14.0` (published 2026-11-02); `v1-next` is `1.0.0-v1-next.20261104182154`, one of 9 prereleases published 2026-11-04. 46 `0.x` versions since the first publish on 2026-03-26. | npm registry JSON | verified |
| Releases: `v0.14.0` (2 Nov) adds E2B, Modal and Sprites providers; `v0.13.0` (2 Nov) adds native `bwrap()` and `seatbelt()`; `v0.12.0` (29 Jun) made `claude-opus-4-8` the Claude Code default; `v0.8.0` added `permissionMode`; `v0.7.0` made `init` fully non-interactive. | github.com/mattpocock/sandcastle/releases | secondary |
| 105 open issues. Relevant: #1537 Docker/Podman sandboxes survive a SIGKILL of the host process; #1536 worktree reuse swallows a failed `fetch` (stale-base risk); #1516 prompt arguments are not quoted inside `` !`…` `` expressions; #1467 the parallel-planner templates' install hook rewrites the host's `node_modules`; #1362 `RunResult.commits` can include host commits during a `merge-to-head` run. None mentions Linear or pnpm. | github.com/mattpocock/sandcastle/issues (first 25) | secondary |
| `run()` sandboxes an agent, with a branch strategy; Docker, Podman, Bubblewrap, Seatbelt and cloud providers (Daytona, E2B, Fly.io Sprites, Modal, Vercel). Native sandboxes need no daemon. | `docs/guide/getting-started.md` | verified |
| Claude Code is a first-class agent provider: `claudeCode(model, { effort, env, permissionMode })`. AFK runs pass `--dangerously-skip-permissions` unless `permissionMode` is set. | `docs/guide/agent-providers.md` | verified |
| Branch strategies: `merge-to-head` (safe for "CI or unattended runs"; aborts the merge on conflict), `branch` ("when you want commits on a specific branch (e.g. for a PR)"), and `createSandbox({ branch, baseBranch })` for an implementer then a reviewer in one sandbox. | `docs/guide/branch-strategies.md`, `src/createSandbox.ts` | verified |
| Prompts: `{{KEY}}` from `promptArgs`; `` !`cmd` `` runs **inside the sandbox** and is replaced by stdout; `` !`…` `` inside an argument value is not executed, so issue text is safe to pass as an argument. | `docs/guide/prompts.md` | verified |
| Structured output: `Output.object({ tag, schema })`, needs `maxIterations: 1`. Completion: the agent prints `<promise>COMPLETE</promise>`. | `docs/guide/structured-output.md`, `docs/guide/iterations.md` | verified |
| Templates: `blank`, `simple-loop`, `sequential-reviewer`, `parallel-planner`, `parallel-planner-with-review` (plan with Opus, implement and review per issue concurrently, one agent merges locally). They hard-code `npm install`, `npm run typecheck`, `npm run test` and `RALPH:` commit prefixes, and contain **no** `git push` or `gh pr create` (grep over `src/templates`). Everything stays on local branches. | `src/templates/**` | verified |
| The tool's own repo runs a planner and implementers over its own GitHub issues (`.sandcastle/run.ts`, `MAX_PARALLEL = 4`). | `.sandcastle/run.ts` | verified |

## 2. MyVGC today

### 2.1 Repository and tooling

| Area | What is there | Source |
|---|---|---|
| Stack | pnpm 10.28 monorepo: `apps/api` (Hono, Drizzle), `apps/web` (Nuxt SPA), `packages/core`, `e2e`. Node 24 in `.nvmrc`; `engines.node >=22.12`. | `package.json`, `CLAUDE.md` |
| Checks | CI runs `pnpm install --frozen-lockfile`, `typecheck`, `lint`, `format:check`, `test`, then a separate Docker Compose smoke job, on **every push**. | `.github/workflows/ci.yml` |
| Tests | Core unit tests and API tests through `app.request()` against PGlite (ADR 13). **`apps/web` has no `test` script**, so a front-end change is checked only by typecheck, lint, format and the one smoke test; phone layout was checked by hand (PR #4, "checked at 375 px wide"). | `apps/*/package.json`, PR #4 |
| Migrations | `apps/api/drizzle/0000` to `0006` plus `meta/_journal.json`. | directory listing |
| How work was done | Spec and numbered tickets in `.scratch/<feature>/`, each ticket built on its own stacked branch (`feat/01-skeleton` … `feat/06-…`), one pull request per feature, a Claude Code cloud session link in each pull request body. | PRs #3 and #4 |
| Agent rules | `CLAUDE.md` (glossary, Hono-only API, core has no I/O, ADRs, test through public interfaces). Pull request #18 (open, branch `claude/intelligent-newton-rxr6mj`, not on this branch) adds a **Tracking** section: issues live in Linear (team DEV, project MyVGC); GitHub Issues are mirrors, "create and edit issues in Linear, never in GitHub"; put the Linear identifier (such as `DEV-31`) in the branch name or pull request title; ADRs are mirrored as Linear documents. | PR #18 patch |
| No agent config | No `.claude/`, no `AGENTS.md`; `.scratch/` is ignored by Prettier and ESLint; `.gitignore` already ignores any file named `.env`, so `.sandcastle/.env` is covered. | repo listing, `.gitignore` |

### 2.2 The Linear backlog

Linear project "MyVGC" (`P-DEV-3`) has no milestones, no project updates in comments, and 17 resources: 16 ADR documents (`Source: docs/adr/…`, "the repo is the source of truth") and the repo link. Statuses: Backlog, Todo, In Progress, In Review, Done, Canceled, Duplicate. Labels: Feature, Chore, Decision, Refactor, Improvement, Bug. There is **no** label that marks an issue as agent-ready, and no estimates, assignees or delegates. Every issue's only comment is the GitHub sync banner, and its only attachment is its GitHub mirror (DEV-30 is #5, … DEV-42 is #17). [verified, Linear MCP]

The one relation type in use is "blocks": DEV-30 blocks DEV-31; DEV-32 blocks DEV-34, DEV-35, DEV-36; DEV-37 blocks DEV-38; DEV-41 blocks DEV-40.

| Issue | Type, priority, status | AFK-ready? | Blockers | Parallel-safe with |
|---|---|---|---|---|
| **DEV-30** Verify official Champions Teamsheet format | Chore, High, Todo | **No.** Needs the real PDF from pokemon.com or play.pokemon.com, which the earlier research could not reach (`docs/risks.md`). A person downloads it; an agent could then write up the fields. | none; blocks DEV-31 | everything (docs only) |
| **DEV-31** Teamsheet export from a Team | Feature, High, Todo | **No.** Blocked by DEV-30; the PDF library and layout depend on the answer. No migration expected (Teamsheets are not stored, ADR 6). | DEV-30 | DEV-36, DEV-35; overlaps DEV-33 on the Team page |
| **DEV-32** Tournaments, Rounds and Opponents | Feature, Medium, Todo | **Mostly already built, see 2.3.** The remainder (Opponent Teams on Rounds) needs re-scoping first. | none | not DEV-34 or DEV-35 (same Round and Opponent files; likely a migration) |
| **DEV-33** Form-based Team builder | Feature, Medium, Todo | **After grooming.** Three sentences, no acceptance criteria. Teams have no edit route today (`apps/api/src/routes/teams.ts` has GET, POST, DELETE), so this needs a new route, option lists served by the API (the web app must not import `@myvgc/core`), and a lot of UI with no automated UI test. | none | DEV-36, DEV-35, DEV-39; overlaps DEV-31, DEV-38 on Team pages |
| **DEV-34** Record individual Games in a Round | Feature, none, Backlog | **No.** Needs a design pass (four brought, leads, per-game results). Likely needs the Round's Opponent Team, so the DEV-32 remainder is a real blocker. New table, so a migration. | DEV-32 (remainder) | nothing that touches Rounds or migrations |
| **DEV-35** Dated note entries on Opponents | Feature, none, Backlog | **After grooming.** Linear lists DEV-32 as the blocker, but the Opponent pages it needs exist. Replaces or sits beside the single `notes` field; new table, so a migration. | none in practice | DEV-33, DEV-31; **not DEV-36** (same Opponent route and page) |
| **DEV-36** Merge duplicate Opponents | Feature, none, Backlog | **Best candidate after a short grooming pass.** Pure API and core: move Rounds and Aliases to the kept Opponent, combine notes, delete the other. The schema already allows it (`round.opponent_id` is a plain foreign key with `restrict`; aliases have no unique constraint), so **no migration**. Open choices: which display name wins, how notes combine, what happens to a duplicate Alias. | none in practice | DEV-33, DEV-31, DEV-39; **not DEV-35** |
| **DEV-37** Store uploaded Teamsheet PDFs | Feature, none, Backlog | **No.** A storage interface (disk volume now, S3 later), upload handling, size and type limits, and a Compose/Docker volume change that only the smoke job exercises. Needs a mini-spec. | none | needs a migration; serial |
| **DEV-38** Read PDFs and screenshots into Teams | Feature, none, Backlog | **No.** OCR or vision-model choice, API keys and cost, and real sample images to judge accuracy. | DEV-37 | n/a |
| **DEV-39** Export and import a User's data as JSON | Feature, none, Backlog | **After a spec.** Pure API and core and testable, but the format, versioning, ID remapping and conflict rules are undecided. It touches every table, so run it **last**, after the schema settles. | none | serial after all migration work |
| **DEV-40** Hosted service: billing and operations | Feature, none, Backlog | **No.** Says it needs its own design interview; external accounts and money. | DEV-41 | n/a |
| **DEV-41** Revisit Nintendo and Pokémon Company IP | Decision, none, Backlog | **No.** Human, legal judgement. | none; blocks DEV-40 | n/a |
| **DEV-42** Decide whether to check Team legality against a Regulation | Decision, none, Backlog | **No.** The decision is the owner's; an agent could only draft options. Its output is an ADR. | none | n/a |

Priorities, relations and status were all read from Linear on 2026-11-04. The "AFK-ready" and "parallel-safe" columns are my judgement from the issue text and the code **[inference]**.

### 2.3 DEV-32 is mostly built

- PR #4, "Add the Tournament tracker", was merged into `main` on 2026-11-04 15:55 UTC. Its description lists Tournaments, Team snapshots, Swiss and Top cut Rounds, Game scores, Opponents with Aliases, an Opponents list and pages, and a dashboard, "roadmap step 3, minus Opponent Teams on Rounds", and reports 118 core and 123 API tests passing. [verified, GitHub REST]
- The code is here: `apps/api/src/routes/{tournaments,rounds,opponents,dashboard}.ts`, `apps/web/app/pages/{tournaments,opponents,dashboard}`, migrations `0003` to `0006`, and all nine `.scratch/tournaments/issues/*.md` marked done. [verified]
- The spec's Out of Scope says "Opponent Teams on Rounds, entered by choosing species (the next slice)", and a search of `packages/core/src` and `apps/api/src` finds no Opponent Team on a Round. [verified]
- So DEV-32 is not open work as titled; only its last clause is. The Linear and GitHub issues (#7) were created at 18:39 UTC, after the pull request merged, and were not updated. Suggested fix (the owner's call, not done): mark DEV-32 Done and open a narrower issue, "Opponent Teams on Rounds", that blocks DEV-34 only. As it stands, Linear shows DEV-35 and DEV-36 as blocked by something that is built, which would make a script that respects relations skip them. [inference]

### 2.4 Conflicts when issues run in parallel [inference]

- **Migration numbering.** Every issue that adds a table (DEV-34, DEV-35, DEV-37, the DEV-32 remainder) will generate `0007_…` and edit `meta/_journal.json`. Run these one at a time, or give each a different order by hand. DEV-36, DEV-33, DEV-31 and DEV-39 need none.
- **Shared files.** `apps/api/src/app.ts` (route registration), `routes/opponents.ts` and the Opponent page (DEV-35 and DEV-36), `routes/rounds.ts` and the Round form (DEV-32 remainder and DEV-34), Team pages (DEV-31, DEV-33, DEV-38), `CONTEXT.md` and `docs/adr/` (any issue that adds a term or decision).
- **Safe pair today:** DEV-36 with DEV-33. Nothing else is both ready and independent.

## 3. Linear and Sandcastle

### 3.1 What Sandcastle assumes about the tracker [verified]

- `sandcastle init` writes three commands into the prompts: list, view and close (`src/InitService.ts`, `ISSUE_TRACKER_REGISTRY`). The built-in choices are GitHub Issues (`gh issue list --state open --label Sandcastle --limit 100 --json number,title,body,labels,comments`; `gh issue view <ID>`; `gh issue close <ID> --comment "Completed by Sandcastle"`), Beads, and **Custom**, which scaffolds a deliberately broken prompt and a `SETUP_ISSUE_TRACKER.md` for an agent to fill in; its example question names Linear.
- The list command is a `` !`…` `` expression, so it runs **in the sandbox**. The token goes in `.sandcastle/.env` (`GH_TOKEN`, Issues read and write).
- `docs/agents/adding-an-issue-tracker.md` sets the bar for a built-in tracker: an official CLI that authenticates from an env var, with non-interactive list, view and close commands. It says "MCP server only" is "not sufficient". Linear's docs index lists an MCP server, a GraphQL API, an SDK and a CLI **importer**, but no issue CLI [secondary, `linear.app/llms.txt`], so a Linear loop is Custom territory: `curl` or a small script against GraphQL.
- The implementer prompt tells the agent to comment on the issue and says "do not close the issue"; the merge prompt closes it. The branch name is `sandcastle/issue-{id}`, which carries no Linear identifier.

### 3.2 What Linear offers [secondary unless noted]

- **Branch name.** Every issue has a `gitBranchName`, for example `jobanmendpara/dev-33-form-based-team-builder`. [verified, Linear MCP]
- **Linking.** A pull request is linked to an issue by the identifier in the branch name or the pull request title; a magic word plus identifier in the description also links it. Closing words (`close`, `fix`, `resolve`, `complete`, `implement` and their forms) move the issue to the "on merge" status when merged; `ref`, `part of`, `contributes to` link without closing; `skip` or `ignore` prevents a link. Magic words in pull request comments do not link. `https://linear.app/docs/github`
- **Status automation.** Per team, under Team settings, Workflows & automations. Defaults: In Progress when a pull request opens, Done on merge; draft, review-requested and ready-for-merge can map too. Whether it is switched on for team DEV is **[unverified]**: I could not read workspace settings.
- **GitHub Issues sync.** One-way or two-way per repo (one two-way repo per team). Synced: title, description, status, assignee, labels, sub-issues, comments and priority. **Not listed as synced: relations such as "blocked by".** Only issues created after the sync was enabled are synced. `https://linear.app/docs/github`
- **API.** GraphQL at `https://api.linear.app/graphql`. A personal API key is sent as `Authorization: <KEY>` (no prefix); OAuth tokens as `Bearer`. Keys can be limited to Read, Write, Admin, Create issues, Create comments, and to specific teams; members can create keys only if an admin enables Member API keys. `https://linear.app/developers/graphql`, `https://linear.app/docs/api-and-webhooks`
- **MCP.** `https://mcp.linear.app/mcp` (Streamable HTTP; OAuth 2.1 interactively, or `Authorization: Bearer <token>` non-interactively), a read-only endpoint `https://mcp.linear.app/mcp/readonly`, and `claude mcp add --transport http linear-server https://mcp.linear.app/mcp`. `https://linear.app/docs/mcp`
- **Linear's own agents.** Delegate an issue to Linear Agent and a **coding session** runs Claude Code or Codex in Linear's cloud, then returns a draft pull request. It needs AI credits (Free, Basic, Business and Enterprise plans), an environment per repository (runtimes including Node and PostgreSQL, env vars, a prepare script, guidance), and an admin who is also a GitHub organization owner. "Secret" variables exist only during preparation. Loops can start sessions on triggers such as an issue entering Triage. `https://linear.app/docs/coding-sessions`, `https://linear.app/docs/loops`. Which plan this workspace is on, and whether credits exist, is **[unverified]**.

### 3.3 The four options (plus one)

**(a) Planner prompt that pulls Linear inside the sandbox.** Install a client, put `LINEAR_API_KEY` in `.sandcastle/.env`, and replace the list command with a `curl` to GraphQL (or give the agent the Linear MCP server with a Bearer header). Smallest change to the templates. Cons: the key sits in the sandbox, which has open network by default, so a prompt-injected issue or dependency script could send it out (`docs/guide/sandbox-providers.md`, "Containment"); the agent gets write access to Linear unless the key is read-only; and the relations Linear holds are only visible if the query asks for them. [inference]

**(b) Host-side script reads Linear, passes text as `promptArgs`.** A Node script on the host calls GraphQL, picks issues, then calls `createSandbox({ branch: issue.gitBranchName, baseBranch: "main" })` and `sandbox.run({ promptFile, promptArgs: { ISSUE_ID, TITLE, BODY } })`. The sandbox never sees Linear. Issue text is safe as an argument (not expanded as a shell expression), but do not place `{{BODY}}` inside a `` !`…` `` command (open issue #1516). The script can read `blockedBy` relations, so it needs no Opus planner for a 13-issue backlog: it filters by label and status, drops anything with an unfinished blocker, and serialises anything marked schema-touching. Updating Linear afterwards can be left to (d). [inference on design]

**(c) Sync Linear into `.scratch/` markdown.** Matches the old convention, but there are now three copies of each issue (Linear, GitHub mirror, `.scratch`), PR #18 says issues are created and edited in Linear, and the `.scratch` files all say done. Not recommended. [inference]

**(d) Linear's GitHub integration with pull requests.** Needs the host script to push and open a pull request, because the templates never do. Branch `jobanmendpara/dev-36-merge-duplicate-opponents` plus a pull request titled `DEV-36: Merge duplicate Opponents` links itself; with a closing word in the description, merging moves the issue to Done. No Linear write code and no Linear status logic in the script. Also satisfies the rule in PR #18 (identifier in the branch name or title). [verified for the linking rules, inference for the combination]

**(e) Not Sandcastle: Linear coding sessions.** Delegate DEV-36 to Linear Agent and get a draft pull request, no code to maintain. Cons: AI credits, a cloud environment to configure (Node 24, pnpm, no Docker-in-Docker for smoke), less control of prompts, review step and model. Worth running once on the pilot issue as the baseline. [secondary]

### 3.4 Recommendation: (b) plus (d), host-side

1. A script in `.sandcastle/main.mts` (about 100 to 150 lines, **[inference]**) queries Linear for issues that are Todo, labelled `ready-for-agent`, and not blocked by an open issue.
2. For each, `createSandbox` on the issue's `gitBranchName`, an implementer run (Claude Code, Sonnet), then a reviewer run in the same sandbox. `maxIterations` low (5 to 10) at first.
3. If the branch has commits, the host (not the agent) runs `git push origin <branch>` and `gh pr create --title "DEV-36: …" --body "Closes DEV-36 …"` with the owner's own `gh` login. CI runs on the push as it does today; Linear moves the issue.
4. The owner reviews and merges the pull request. There is no merge agent, no local merge, and no `gh issue close`. This replaces the template's phases 1 and 3 and keeps its phase 2.

Why not the full template: its planner, local merge agent and `gh issue close` solve problems that a Linear relation, a pull request and Linear's integration already solve. Why not (a): it puts a credential where the agent is told to trust untrusted text.

### 3.5 Secrets

| Secret | Put it | Reason |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` (or `ANTHROPIC_API_KEY`) | `.sandcastle/.env`, which forwards it into the sandbox. Unavoidable. | The agent has to call the model. The token is from `claude setup-token`: a one-year token tied to the subscription that "can only make model requests". `https://code.claude.com/docs/en/authentication` |
| `LINEAR_API_KEY` | Host shell or password manager only. **Do not** list it in `.sandcastle/.env`. A read-only key limited to team DEV is enough for (b). | Only keys **declared in `.sandcastle/.env`** are forwarded (`src/EnvResolver.ts`); other host variables are not. |
| GitHub push credential | The owner's `gh` login on the host. | The sandbox needs none: nothing in it pushes. Native sandboxes hide `~/.config/gh`. (`docs/guide/sandbox-providers.md`) |
| `GH_TOKEN` | Leave unset. | Only needed if the agent itself talks to GitHub, which the design avoids. |

Residual risk: the model token is in the sandbox, and Docker's network is open (an allow-list is not documented). Use a token you can revoke, and keep untrusted text (issue bodies) to the owner's own Linear issues. [verified for the mechanism, inference for the advice]

### 3.6 Can the existing Linear connector be used?

- The `mcp__Linear__*` tools in Claude Code are a **claude.ai connector**. They are available to an interactive Claude Code session, not to a TypeScript script. A script cannot call them. [inference]
- Anthropic's docs say a `claude setup-token` token "can't ... fetch claude.ai connectors", though "MCP servers you configure locally still work". So inside a sandbox using the subscription token the connector would not load; a locally configured Linear MCP server with its own Bearer key would. `https://code.claude.com/docs/en/authentication` [secondary]
- Practical uses of the connector: (1) the owner's interactive session grooms issues in Linear (it can edit descriptions and add the label), and (2) the same session can write the list of issues for the script to run, as a by-hand planner. The unattended orchestrator should use the GraphQL API with a read-only key, or the MCP server with a Bearer header, not the connector. [inference]

### 3.7 Claude Code, credentials, and where it runs

- Claude Code is supported; the subscription token path is documented for Sandcastle (`docs/guide/getting-started.md`: run `claude setup-token`, set `CLAUDE_CODE_OAUTH_TOKEN`; or set `ANTHROPIC_API_KEY`). [verified] Claude Code gives the API key precedence over the OAuth token when both are present (`https://code.claude.com/docs/en/authentication`), so set only one. [secondary]
- Whether unattended parallel agents on a subscription token count against plan limits in a way that matters is **[unverified]**; for heavy runs, a budgeted API key is easier to reason about.
- **Local or CI.** Sandcastle needs Git, Node and one sandbox provider; nothing in its docs requires a particular host. Local is simplest (Docker or Bubblewrap, and the owner's `gh` login). A CI runner would need Docker, the model token as a secret, and a way to push; a pull request opened with the default Actions token may not start other workflows (GitHub's documented behaviour, **[unverified]** here), which would hide the smoke job. Cloud providers (E2B, Daytona and so on) move the sandbox, not the orchestrator.

## 4. Risks and costs

| Risk | Detail | Status |
|---|---|---|
| **Issues too thin** | One-line descriptions, no acceptance criteria. Linear's own guidance for delegated coding work stresses outcome, scope and constraints (`https://linear.app/docs/coding-sessions`). The detail that made earlier tickets agent-ready lived in `.scratch/` and the ADRs. | verified/inference |
| **Stale or wrong relations** | DEV-32 (built) blocks DEV-34, 35, 36. A script that obeys relations will skip them. | verified |
| **No UI feedback loop** | `apps/web` has no tests. An agent can pass typecheck, lint and format and still ship a broken phone layout. Prefer API and core issues first. | verified |
| **Mirrors** | Editing a GitHub mirror contradicts PR #18; relations do not sync; sync covers only newly created issues. | secondary |
| **Maturity** | `0.14.0`, 46 `0.x` releases in 7 months, a `1.0.0-v1-next` prerelease line updated daily, and 105 open issues. Pin the exact version. | verified |
| **Token spend** | Unmeasured. Templates allow 100 implementer iterations; the pilot should cap at 5 to 10. | inference |
| **Agent permissions and network** | `--dangerously-skip-permissions` by default; open network on Docker; the sandbox is the only barrier. | verified |
| **Domain correctness** | The Champions rules in `docs/research/pokemon-champions-data.md` include unverified claims (the Teamsheet format). Keep DEV-30, 31 and anything touching legality out of the loop. | inference |
| **Sandbox availability** | Docker daemon or `bubblewrap` on the owner's machine is unknown. | unverified |
| **Linear settings** | Whether pull request status automation is enabled for team DEV, and the workspace plan, are unknown. | unverified |

## 5. Prerequisites before a first run

1. **Groom the pilot issue in Linear**: acceptance criteria as checkboxes, "Touches: API/core only, no migration", glossary terms. Using the repo's existing spec-to-issues step is fine; its output now belongs in Linear rather than `.scratch/`. [inference]
2. **Fix the relations**: DEV-32 Done (or split), so DEV-35 and DEV-36 are no longer shown as blocked.
3. **Add one label** for the agent-ready signal, for example `ready-for-agent` (the old specs already use that word), separate from the type labels in PR #18's list. It needs a Linear workspace admin; nothing was created in this research.
4. **A read-only Linear API key** for team DEV (member API keys may need enabling by an admin).
5. **Merge or restate PR #18**, so `CLAUDE.md` tells the agent how to name branches and pull requests.
6. **A one-line check script**, for example `"check": "pnpm typecheck && pnpm lint && pnpm format:check && pnpm test"`, so prompts name one command that matches CI. [inference]
7. **`.sandcastle/` files**: Dockerfile on Node 24 Debian with `corepack enable` (the repo pins `packageManager: pnpm@10.28.0`), a `pnpm install --frozen-lockfile` hook with a longer `timeoutMs`, prompts rewritten for pnpm and the glossary, no Postgres and no browsers (PGlite covers API tests). Do not copy `node_modules` into the worktree as the templates do (#1467). Add `.sandcastle/` to Prettier's and ESLint's ignores, because `pnpm lint` and `pnpm format:check` cover the whole repo. [inference]
8. **`CLAUDE.md` rules for AFK work**: one issue per run; do not add a migration, ADR or glossary term unless the issue says so; do not edit `.scratch/`.

## 6. Alternatives

| Option | Good for | Weak for |
|---|---|---|
| **Claude Code cloud sessions by hand**, one per issue, using the Linear connector and `gitBranchName` (what MyVGC does now) | No setup; connector already works; a person is present to catch domain mistakes | Attention: you launch and watch each one |
| **Linear coding sessions** (delegate to Linear Agent) | No code; status, branch and pull request all native; Loops can trigger it | AI credits, a cloud environment to maintain, less control, plan unknown |
| **GitHub Actions on a label** | Runs without your machine | Needs an agent action and secrets; each run installs from scratch |
| **Sandcastle, host-side script (this note)** | A loop you own: model, prompts, reviewer, sandbox and branch rules; runs locally | A pre-1.0 tool, a Dockerfile and script to maintain, and little to run until issues are groomed |

**When Sandcastle is worth it [inference]:** when three or more groomed, independent API-and-core issues are waiting at once and you would rather review pull requests than drive sessions. Today the open backlog has about one such issue.

## Suggested first steps

Stop after any step whose result is not convincing.

1. **Fix Linear** (owner, 10 minutes): mark DEV-32 Done or split off "Opponent Teams on Rounds"; create the `ready-for-agent` label.
2. **Groom DEV-36** (30 minutes, a normal Claude Code session with the Linear connector): decide which display name wins, how notes combine, how duplicate Aliases are handled, and write acceptance criteria. Groom DEV-35 and DEV-33 only if step 4 works.
3. **Merge PR #18** and add the `check` script.
4. **Trial run on DEV-36, one issue.** Pin `@ai-hero/sandcastle@0.14.0`; `sandcastle init --template blank` with Docker or Bubblewrap; edit the Dockerfile and prompt; a ~60-line host script fetching DEV-36 by identifier, then `createSandbox` on its `gitBranchName`, implementer, reviewer, with `maxIterations` 5 to 10. Push and open the pull request by hand the first time. Record minutes, tokens, and whether CI passes untouched. **Why DEV-36 first:** API and core only, so ADR 13's tests give the agent a real feedback loop; no migration, so no journal conflicts; touches only the Opponent route, core and one page; unblocked in practice; and a bad result is cheap to discard.
5. **Baseline.** Run DEV-36 once as a Claude Code cloud session or a Linear coding session on a throwaway copy of the issue and compare effort and quality.
6. **Then automate the push and pull request step** in the script (step 3 of the design above), and let Linear's integration move the issue.
7. **Only then widen**: DEV-33 (needs a UI feedback story first), DEV-35 (migration; run alone), DEV-39 last. Keep DEV-30 to DEV-31 and the Decision and hosted issues out of the loop.
8. **Revisit when `1.0.0` ships**; check the changelog before changing the pin.

## Open questions

- Is the goal an unattended overnight factory, or a faster way to clear a batch while present? The first needs egress, budget and review safeguards; the second may be met by cloud sessions or Linear coding sessions.
- Is Linear's pull request status automation on for team DEV, and what plan and AI credits does the workspace have? (Decides whether (d) and (e) work as described.)
- Should "ready for an agent" be a label, or a Linear status such as a new "Ready" state? A label is the smaller change.
- Does closing or merging propagate from the Linear integration to the GitHub mirror cleanly, so the mirror's open count does not drift? Not tested.
- Does a pnpm-workspace install work reliably inside the sandbox with a cached store, and how long does it take? Untested.
- What does the `v1-next` line change? I read its version only (`1.0.0-v1-next.20261104182154`), not its source or changelog.
- Can a sandbox restrict outbound network to the model API and npm only? Not documented in what I read.
- Sandcastle's issue list was read for the first 25 of 105 open issues only.

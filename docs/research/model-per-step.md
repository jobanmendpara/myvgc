# Which model suits each factory step

Checked 2026-11-26 for the map "Map: a software factory from idea to merged PR" (DEV-247), resolving the research ticket "Which model suits each factory step" (DEV-249). The question is which current Claude model, at which effort, gives the best balance of result quality, cost and claude.ai subscription usage for each Factory step: grilling, spec writing, ticket writing, implementing, reviewing, fix rounds and the retro.

Sources are Anthropic's own documentation and help-center pages, plus Sandcastle's docs, read on the date above. No model calls were made. Every dollar figure for a ticket is an estimate built from published prices and an assumed token profile, not a measurement.

## Summary

- **Planning steps (grilling, spec, tickets): Opus 5.5.** Use `high` effort for grilling and spec writing, and `medium` for ticket writing. These steps are HITL, use few tokens, and are where a wrong decision costs the most.
- **Implementer: Sonnet 5.5 at `medium`, with Opus 5.5 at `medium` as the trial's comparison arm.** Factory tickets are well specified and carry acceptance criteria, which is the case Anthropic's effort guide gives `medium` for on Sonnet 5.5. Per token it costs half of Opus 5.5.
- **Reviewer: Opus 5.5 at `high`.** The Reviewer proves that each acceptance criterion's test can fail. That is judgment work and the Factory's trust rests on it, so it is the wrong place to save money.
- **Fix rounds: the Implementer's model, one effort level up** (Sonnet 5.5 at `high`). If round 2 still fails, the run parks with `needs-human` as already decided.
- **Retro: Sonnet 5.5 at `medium`.** It mostly reads run logs and writes wiki text.
- **Exploration and other helper subagents: Haiku 5.5 at `low` or `medium`.** Built-in Explore runs on Opus on subscriptions unless you override it.
- **Fable 5.2 is not worth it for any step yet.** It costs twice as much as Opus 5.5, is never the default, and on Max and Ultra it has its own separate weekly limit. Anthropic says to move to it only "when your evals on Claude Opus 5.5 at higher effort still fall short".
- **Anthropic publishes no ratio for how fast each model uses up subscription limits.** Limits are shared between Claude and Claude Code, they reset on a 5-hour window and a weekly window, and Fable has its own weekly limit on Max and Ultra. The trial has to measure each model's share of the limit itself.

## 1. The current models

From the [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview):

| | Fable 5.2 | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 |
| :-- | :-- | :-- | :-- | :-- |
| ID | `claude-fable-5-2` | `claude-opus-5-5` | `claude-sonnet-5-5` | `claude-haiku-5-5` |
| Described as | "For demanding reasoning and long-horizon agentic work" | "For long-running agentic coding and knowledge work" | "The best combination of speed and intelligence" | "For high-volume, latency-sensitive tasks such as classification, extraction, and routing" |
| Latency | Moderate | Moderate | Fast | Fastest |
| Thinking | Adaptive, always on | Adaptive, always on | Adaptive | Adaptive |
| API default effort | `high` | `medium` | `high` | `medium` |
| Context / max output | 1M / 128K | 1M / 128K | 1M / 128K | 1M / 128K |

The overview's own advice: "If you're unsure which model to use, start with Claude Opus 5.5 for most workloads. Use Claude Fable 5.2 for demanding reasoning and long-horizon agentic work, or when your evals on Claude Opus 5.5 at higher effort still fall short."

## 2. API prices

From [Pricing](https://platform.claude.com/docs/en/about-claude/pricing), per million tokens:

| Model | Input | 5m cache write | 1h cache write | Cache read | Output |
| :-- | --: | --: | --: | --: | --: |
| Fable 5.2 | $8 | $10 | $16 | $0.20 | $40 |
| Opus 5.5 | $4 | $5 | $8 | $0.20 | $20 |
| Sonnet 5.5 | $2 | $2.50 | $4 | $0.10 | $10 |
| Haiku 5.5 (prompt up to 100K) | $0.10 | $0.125 | $0.20 | $0.01 | $0.50 |
| Haiku 5.5 (prompt over 100K) | $0.50 | $0.625 | $1 | $0.05 | $2.50 |

Points that matter for the Factory:

- **Cache reads are cheap on Opus 5.5 and Sonnet 5.5**, at 0.05× input rather than the usual 0.1×. Fable 5.2 gets 0.025×. A long Claude Code session is mostly cache reads, so per token Opus 5.5 is only about twice Sonnet 5.5.
- **Haiku 5.5 charges more once a prompt is over 100K tokens.** "A request's prompt length counts all of its input tokens, including cache reads and cache writes." A coding session soon passes 100K, so a Haiku implementer would pay the higher rate. Haiku is cheapest for short subagent tasks.
- Thinking tokens are billed as output ([Manage costs](https://code.claude.com/docs/en/costs)).

### Estimated cost of one ticket on the API

These are assumptions, not measurements. One Implementer run at about 4M cache-read tokens, 200K cache-write tokens (5-minute TTL), 30K uncached input and 80K output:

| Model | Estimate |
| :-- | --: |
| Fable 5.2 | about $6.20 |
| Opus 5.5 | about $3.50 |
| Sonnet 5.5 | about $1.80 |
| Haiku 5.5 (over-100K rates) | about $0.55 |

With a Reviewer run on Opus 5.5 at about half that size, one fix round, and the pilot's 2–3 tickets, a whole spec lands in the tens of dollars. For scale, Anthropic reports that across enterprise deployments Claude Code averages "around $13 per developer per active day and $150-250 per developer per month" ([Manage costs](https://code.claude.com/docs/en/costs)). The trial should replace these guesses with the token counts from the run logs.

## 3. Subscription usage limits

What the help center says:

- "Pro and Max plans have a five-hour session limit and a weekly limit." The limits "are shared across Claude and Claude Code" ([Using Claude Code with your Pro or Max plan](https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan)).
- "Max and Ultra plans also have a separate weekly limit for Fable." Past it, usage credits can pay for more Fable ([Extra usage for paid Claude plans](https://support.claude.com/en/articles/12429409-extra-usage-for-paid-claude-plans)). On some plans and seat tiers, Fable bills to usage credits instead of the plan's included limits, and the `/model` picker then shows "Requires usage credits" ([Model configuration](https://code.claude.com/docs/en/model-config)).
- "Usage credits are billed at standard API rates" ([Extra usage](https://support.claude.com/en/articles/12429409-extra-usage-for-paid-claude-plans)).
- Model choice is listed as one of the "additional factors that affect your usage limits", but **no page gives a ratio between models** ([Usage limit best practices](https://support.claude.com/en/articles/9797557-usage-limit-best-practices)). The extra-usage article says Haiku and the latest Sonnet "provide excellent performance at lower token costs than Opus models".
- Claude Code has model-specific limit messages, "You've hit your Opus limit" and "You've hit your Sonnet limit". After one of those, switching to another family with `/model` lets you keep working. The general "session limit" and "weekly limit" are "shared across all models", so switching does not help there ([Manage costs](https://code.claude.com/docs/en/costs)).
- Subagents "count toward the same usage limits as your main conversation" ([Subagents](https://code.claude.com/docs/en/sub-agents)).
- "Advertised usage limits for Pro, Max, and Ultra plans assume ordinary, individual usage of Claude Code and the Agent SDK" ([Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)). The same page lets an end user sign in "to the unmodified Claude Code binary with their own Claude subscription". That covers Sandcastle running the maintainer's own Claude Code with his own `CLAUDE_CODE_OAUTH_TOKEN`. Long AFK runs are still the kind of use those advertised limits weren't sized for.

A likely reading, not documented anywhere: usage weighs each model roughly by its token cost, so an Opus 5.5 run uses about twice the limit of the same run on Sonnet 5.5. The trial should check this.

## 4. Effort

From [Effort](https://platform.claude.com/docs/en/build-with-claude/effort):

- Effort "affects all tokens in the response", including tool calls and thinking. "Lower effort also means fewer and terser tool calls."
- Levels: `low` ("Simpler tasks ... such as subagents"), `medium` ("Agentic tasks that require a balance of speed, cost, and performance"), `high` ("Complex reasoning, difficult coding problems, agentic tasks"), `xhigh` ("Long-running agentic and coding tasks (over 30 minutes) with token budgets in the millions"), and `max`.
- **Opus 5.5** defaults to `medium`, one level below Opus 5. Thinking can't be turned off, so effort is the main control. Anthropic gives no starting level and says to run an effort sweep.
- **Sonnet 5.5**: "For agentic coding and multistep tool use, start with `medium` for well-specified tasks and move to `high` for harder or longer ones." Its levels are calibrated differently from Sonnet 5's.
- **Haiku 5.5**: "Start with `medium` for most work, including agentic coding." The guide also warns: "In long agent prompts, the model is more likely to skip a search, stop early, or skip a check at `low`."
- **Fable 5.2**: start at `high`, and use `xhigh` only where you have measured a gain.

**Claude Code's defaults differ from the API's.** In Claude Code, Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5 all default to `medium` ([Model configuration](https://code.claude.com/docs/en/model-config)). On the API, Sonnet 5.5 defaults to `high`. So the Factory should set effort explicitly on every step.

## 5. How to set a model and effort for each step

### Claude Code ([Model configuration](https://code.claude.com/docs/en/model-config))

- Model, highest priority first: `/model` in a session, then `claude --model <alias|name>`, then `ANTHROPIC_MODEL`, then the `model` field in settings, then `ANTHROPIC_DEFAULT_MODEL`. Aliases: `opus` (Opus 5.5), `sonnet` (Sonnet 5.5), `haiku` (Haiku 5.5), `fable` (Fable 5.2), `opusplan` (Opus in plan mode, Sonnet otherwise), and `best` (same as `opus`). The default on Pro, Max, Ultra, Team, Enterprise and the API is Opus 5.5. "No Fable model is the default on any plan or provider."
- Effort, highest priority first: `CLAUDE_CODE_EFFORT_LEVEL`, then a level picked in the session (`/effort`), then `--effort`, then saved settings (`modelSettings` or `effortLevel`; `effortLevel` doesn't accept `max`), then the model's default.
- `--fallback-model` and `fallbackModel` switch models when one is overloaded or unavailable, up to three models. "Rate-limit errors never trigger a switch", so a fallback chain is no answer to hitting usage limits.

### Subagent frontmatter ([Subagents](https://code.claude.com/docs/en/sub-agents))

- `model`: `sonnet`, `opus`, `haiku`, `fable`, a full ID, or `inherit`. Order of precedence: the per-invocation `model` parameter, then the definition's `model`, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the parent's model.
- `effort` overrides the session's effort but not `CLAUDE_CODE_EFFORT_LEVEL`.
- Built-in Explore runs on Opus on subscriptions. A project subagent named `Explore` with `model: haiku` replaces it. `CLAUDE_CODE_SUBAGENT_MODEL` alone doesn't change Explore or Plan. `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` makes it apply to every subagent.

### Skill frontmatter ([Skills](https://code.claude.com/docs/en/skills))

- A skill's `model` applies "for the turn when you run this skill with `/name`". **When Claude invokes the skill itself, the session keeps its model.** So a planning skill's `model` field only takes effect when the maintainer types the slash command. With `context: fork`, the value becomes the forked subagent's model.
- `effort` lasts "for the rest of the current turn". It also doesn't override `CLAUDE_CODE_EFFORT_LEVEL`.

### Sandcastle ([agent-providers.md](https://github.com/mattpocock/sandcastle/blob/main/docs/guide/agent-providers.md))

- `claudeCode("<model>", { effort })` takes a model string and an optional `effort` (`low` to `max`). Each `run()` or `sandbox.run()` picks its own agent, so the Implementer, Reviewer and fix-round runs can each use a different model and effort.
- Auth goes in `.sandcastle/.env` (`CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`), because the sandbox hides `~/.claude` ([sandbox-providers.md](https://github.com/mattpocock/sandcastle/blob/main/docs/guide/sandbox-providers.md)). A provider's `env` option can set `ANTHROPIC_API_KEY` for one agent only, so switching a single step to the API is a one-line change.
- `effort` overrides the session effort in Claude Code but not `CLAUDE_CODE_EFFORT_LEVEL`. Don't set that variable in `.sandcastle/.env`, or every step runs at the same level.

## 6. Recommendation for each step

| Step | Where it runs | Model | Effort | Why |
| :-- | :-- | :-- | :-- | :-- |
| Grilling | HITL, interactive | Opus 5.5 | `high` | Judgment-heavy and few tokens. The maintainer's time costs more than the tokens. Opus is the documented default for knowledge work. |
| Spec writing | HITL | Opus 5.5 | `high` | Mistakes here spread to every ticket. Spec sign-off is a human Gate, so quality matters more than speed. |
| Ticket writing | HITL | Opus 5.5 | `medium` | Structured splitting of a signed-off spec. `medium` is Opus 5.5's default. |
| Implementer | Sandcastle, AFK | Sonnet 5.5 (Opus 5.5 as the trial's comparison) | `medium` | Tickets are well specified with acceptance criteria, Anthropic's case for Sonnet 5.5 at `medium`. Half Opus's price per token, and faster. The Reviewer and tests catch what it misses. |
| Reviewer | Sandcastle, AFK | Opus 5.5 | `high` | Proving each test can fail is where trust comes from. Mostly reading, so less output than implementing. |
| Fix rounds (up to 2) | Sandcastle, AFK | Implementer's model | One level up (`high`) | "Move to `high` for harder or longer ones". A failed first attempt marks the ticket as harder. |
| Retro | After each spec | Sonnet 5.5 | `medium` | Mostly reading run logs and summarising into `docs/wiki/`. Low risk, since the wiki is reviewed. |
| Helper subagents (Explore, doc lookups) | Any | Haiku 5.5 | `low`/`medium` | Short, read-heavy tasks. Use `medium` where skipping a check would matter. |

If the trial shows Sonnet 5.5 needing more fix rounds than Opus 5.5, so that cost per completed ticket comes out the same or worse, switch the Implementer to Opus 5.5 at `medium`. Anthropic's cost guidance says to judge "cost per completed task, not per request".

## 7. What the trial should measure

Run the pilot's 2–3 tickets with the Implementer on Sonnet 5.5 at `medium`. Run at least one of them a second time on Opus 5.5 at `medium`. Record for each Run:

1. **First-review pass rate and fix rounds used**, and whether the Run parked with `needs-human`.
2. **Reviewer findings**: defects the Reviewer caught that the Implementer's own tests missed, and whether each acceptance criterion's test was shown to fail.
3. **Tokens by model and type** (input, cache write, cache read, output) from the captured session JSONL. Turn them into API dollars with section 2's prices.
4. **Share of subscription limits used**: the 5-hour and weekly bars in `/usage` before and after each Run. Dividing by the token counts tests whether Opus 5.5 really uses about 2× Sonnet 5.5.
5. **Wall-clock time** for each step, and how often the 2-agent cap left work waiting.
6. **Limit hits**: any session-limit, weekly-limit or "Opus limit" message, and which step hit it.

## 8. When to switch to an API key

The map already says to fall back to an API key "if limits keep being hit". From the sources, the triggers are:

- Session or weekly limits are hit during a spec's runs more than once, or they stop the maintainer's own interactive work. The limits are shared with claude.ai and interactive Claude Code.
- The Factory moves to scheduled or unattended runs. The advertised limits "assume ordinary, individual usage", and the legal page points developers "building products or services", Agent SDK users included, to API keys.
- A spec costs less on the API than the usage credits it would otherwise need. Usage credits are billed at API rates anyway, so past the included limits the API key costs the same and keeps the subscription free for planning.

A hybrid is easy to set up: keep the planning steps on the subscription, and give only the Sandcastle Implementer and Reviewer agents `env: { ANTHROPIC_API_KEY }`. At the estimates in section 2, an API-billed ticket is a few dollars.

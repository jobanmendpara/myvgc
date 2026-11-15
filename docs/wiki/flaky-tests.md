# Flaky tests

Tests that have failed and then passed on a rerun with no change. Record each sighting here, so a test that keeps flaking can be filed and fixed.

- On 2026-11-11 the DEV-95 agent saw `packages/core/test/teamsheet-writer.test.ts` "reads back as the same Team" fail once, then pass on reruns. The cause is unknown and nothing was filed. (Superseded 2026-11-11: filed as DEV-101 that day, and the cause found; see below.)
- On 2026-11-11 the DEV-101 agent reproduced it. Alone the file never failed: 301 in-process repeats (`--repeats 300`) and 200 fresh runs, 8 at a time, all passed. Running the whole core suite 60 times while two API suites ran alongside, as when agents run `pnpm test` side by side, gave 9 failures, every one "Test timed out in 5000ms"; the round trip took 4.3 s at the median and up to 6.1 s, against about 0.35 s idle. Other `writeTeamsheet` tests timed out too. No run gave a wrong result, so export and reading are deterministic and the tests share no state.
  - Cause: Vitest's default 5 s limit against CPU-bound PDF work (each export embeds and deflates the full DejaVu Sans, ADR 28; the first test also loads the Champions data) on a shared CPU.
  - Fix (jobanmendpara/myvgc@2b03b45): the `writeTeamsheet` and `readTeamsheet` describes allow 30 s, with the reason beside them, like the API's 30 s for PGlite. Under the same load the next 60 core runs all passed, the slowest round trip taking about 7 s.
- On 2026-11-15 the DEV-113 agent's first local `pnpm test` had 4 API test failures: team-library "lists only the User's Teams", two in teamsheet-export, and tournament-team "starts with no Team". They passed on a rerun with no change. Four other implementers were running tests at the time (see the [2026-11-15 Refactor round](refactor-round-2026-11-15.md)).
  - The cause is unknown: the agent piped the output through `grep`, so the failure messages were lost. The chief-of-staff's retro on DEV-113 (subagent report, 2026-11-15) found that every implementer that round filtered its test output the same way. It likely matches the DEV-101 shared-CPU timeout pattern above (teamsheet-export does CPU-bound PDF work), but that is unconfirmed. Nothing was filed for the tests themselves; DEV-144 asks agents to keep the full output in a scratchpad log before filtering it.

Related: [parallel agents](parallel-agents.md).

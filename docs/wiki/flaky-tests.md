# Flaky tests

Tests that have failed and then passed on a rerun with no change. Record each sighting here, so a test that keeps flaking can be filed and fixed.

- On 2026-11-11 the DEV-95 agent saw `packages/core/test/teamsheet-writer.test.ts` "reads back as the same Team" fail once, then pass on reruns. The cause is unknown and nothing was filed.

Related: [parallel agents](parallel-agents.md).

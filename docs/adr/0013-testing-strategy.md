# 13. Testing strategy

Date: 2026-11-03
Status: Accepted

## Decision
- Vitest everywhere.
- Unit tests for domain logic in `packages/core`.
- API tests through Hono's `app.request()`, against PGlite (Postgres running in-process).
- One Playwright smoke test against the built Docker image, run in CI.

## Consequences
Tests are fast enough to work test-first, and problems that only show up in Docker are caught in CI.

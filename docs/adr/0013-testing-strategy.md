# 13. Testing strategy

Date: 2026-11-03 (amended 2026-11-11 for the smoke suite, DEV-98, and for web unit tests, DEV-100)
Status: Accepted

## Decision
- Vitest everywhere.
- Unit tests for domain logic in `packages/core`.
- Unit tests in `apps/web` for the web app's own logic: fetching, forms and display. They are plain Vitest, without a Nuxt environment, and stub Nuxt globals such as `$fetch`. Domain logic stays in `packages/core` and is tested there; it doesn't move into the web app to be tested.
- API tests through Hono's `app.request()`, against PGlite (Postgres running in-process).
- A Playwright smoke suite against the built Docker image, run in CI. It covers the main flows end to end; the unit and API tests carry the detail.

## Consequences
Tests are fast enough to work test-first, and problems that only show up in Docker are caught in CI.

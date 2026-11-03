# 8. pnpm monorepo built into a single Docker image

Date: 2026-11-03
Status: Accepted

## Decision
A pnpm workspace with:
- `apps/web`: the Nuxt front end
- `apps/api`: the Hono API
- `packages/core`: Pokémon data, Showdown paste reading and writing, domain types, and shared Zod schemas

A multi-stage Dockerfile builds one image. `compose.yaml` runs that image plus Postgres.

## Consequences
Domain logic in `packages/core` can be tested without HTTP, a browser or a database. Most test-first work happens there.

How the web app is served in production is decided separately (see the open front-end/server question).

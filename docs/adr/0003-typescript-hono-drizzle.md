# 3. TypeScript, Hono and Drizzle

Date: 2026-11-03
Status: Accepted

## Context
The developer is solo and wants fast progress in familiar tools.

## Decision
- TypeScript everywhere (required).
- Hono for the HTTP API.
- Drizzle for the ORM.
- TanStack Query for server state on the front end.
- shadcn-style UI components.

Front-end preference, most familiar first: Vue (Nuxt), Svelte (SvelteKit), React. The front-end framework and the database (Postgres or SQLite) are still open.

## Consequences
The front end should use the shadcn port for the chosen framework (for example shadcn-vue for Vue).

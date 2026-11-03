# 4. Postgres as the only database

Date: 2026-11-03
Status: Accepted

## Context
Drizzle supports Postgres and SQLite, but supporting both means every migration and test is done twice. The hosted service will hold many users in one database.

## Decision
Use Postgres everywhere. Self-hosters run two containers (the app plus Postgres) with Docker Compose.

## Consequences
- One SQL dialect, one set of migrations.
- Self-hosting is not a single container.
- Local development and tests can use PGlite (Postgres running in-process) to stay fast.

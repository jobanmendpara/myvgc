# up:local shares the dev DB

Recorded first on 2026-11-09 in the Claude auto-memory (`up-local-shares-dev-db.md`) and copied here on 2026-11-11.

- `pnpm up:local` starts `myvgc-app-1` against the same Postgres (`myvgc-db-1`, localhost:5432) that `pnpm dev` uses. It also binds `*:3000`, while `nuxt dev` binds only `[::1]:3000`.
- On 2026-11-09, during DEV-74, a container built from a branch that hadn't merged yet applied that branch's migration numbering to the dev DB. After the merge renumbered the migrations, the API under `pnpm dev` crashed with "column already exists". The browser also reached the old container, so a fix looked as if it hadn't worked.
- When dev migrations fail, or a fix seems to have no effect, run `docker ps` and look for a running `myvgc-app-1`. To repair the DB, add rather than drop: run the missing SQL and insert the `drizzle.__drizzle_migrations` rows.

Related: [parallel agents](parallel-agents.md).

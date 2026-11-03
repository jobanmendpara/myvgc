# Spec: Teams slice (first vertical slice)

Source: interview decisions in `docs/adr/` (especially ADRs 8, 10, 11, 12, 14), terms in `CONTEXT.md`.

## Problem
A player has no single place to keep their Pokémon Champions teams. Teams live in Showdown pastes scattered across notes apps and Discord. The rest of MyVGC (Tournaments, Teamsheets, Rounds) builds on Teams, so Teams come first.

## Solution
A self-hostable app, run with `docker compose up`, where a User signs up, pastes a Champions-format Showdown team, and gets a saved Team they can list, view, copy back out as a paste, and delete.

## User stories
1. As a self-hoster, I run `docker compose up` with a `.env` file and get a working app with its database migrated.
2. As the first person to sign up on an install, I become its admin.
3. As an admin, I can turn off public sign-ups with an environment variable.
4. As a User, I sign up with email and password, log in and log out.
5. As a User, I paste a Champions Showdown team, give it a name and Regulation, and save it as a Team.
6. As a User, when my paste is malformed I see which line is wrong and why, and nothing is saved.
7. As a User, I see a list of my Teams, showing each one's name, Regulation and six species.
8. As a User, I open a Team and see every Pokémon build: species, item, ability, nature, moves and Stat Points.
9. As a User, I copy a Team back out as a Champions Showdown paste.
10. As a User, I delete a Team.
11. As a User, I never see another User's Teams.
12. As a User at an event, every screen works on my phone.

## Implementation decisions

### Repository (ADR 8)
pnpm workspace: `apps/api` (Hono), `apps/web` (Nuxt as a single-page app), `packages/core` (domain logic, no I/O). TypeScript strict mode everywhere. Node 24 LTS.

### Pokémon build model (`packages/core`)
A Pokémon build has:
- `species` (Showdown ID, required; includes the form, for example `rotomwash`)
- `nickname` (optional), `gender` (optional: `M` or `F`)
- `item`, `ability`, `nature` (Showdown IDs, optional)
- `moves` (0 to 4 Showdown IDs)
- `statPoints` (`hp`, `atk`, `def`, `spa`, `spd`, `spe`, each 0 to 32, total at most 66; missing stats are 0)

A Team has 1 to 6 builds. Builds are defined once as a Zod schema in `packages/core`, which the API and the web app share.

### Champions paste format
The same as Showdown's export format, with these differences:
- The `EVs:` line holds Stat Points (0 to 32 per stat).
- `Level:`, `IVs:`, `Tera Type:`, `Shiny:` and `Happiness:` lines don't apply in Champions. The reader ignores them and returns a warning for each one, without rejecting the paste.

The reader rejects a paste, with errors that give the line number and a message, when it finds:
- No Pokémon, or more than 6
- More than 4 moves on one Pokémon
- A stat above 32 Stat Points, or a total above 66
- A species, item, ability, move or nature that the pinned Champions data doesn't recognize
- A line it can't read

It does **not** check legality in a Regulation (ADR 10).

The writer turns a Team back into a Champions paste. Reading the written paste back must give the same Team (round trip).

Pokémon data comes from Showdown's Champions data through `@pkmn/dex` and `@pkmn/mods`, pinned to an exact version (ADR 12). Display names come from that data; only IDs are stored (ADR 14).

### Storage
- Postgres with Drizzle. Migrations are generated with drizzle-kit, committed, and run automatically when the app starts (ADR 15).
- `team` table: `id` (UUID), `owner_id` (references the user), `name`, `regulation` (enum, currently `M-A`, `M-B`, `M-C`; default `M-C`), `notes` (Markdown text, default empty), `pokemon` (JSONB array of builds, validated by the core schema before writing), `created_at`, `updated_at`.
- Storing builds as JSONB keeps Team snapshots (ADR 9) a plain copy later.

### Accounts (ADRs 5, 7)
Better Auth with email and password and its Drizzle adapter, mounted in Hono at `/api/auth/*`. The first account created on an install gets the `admin` role. When `ALLOW_SIGNUPS=false`, sign-up is refused, except for the very first account. Email verification and password reset are out of this slice.

### API (ADR 11)
All routes are under `/api` and require a session, except `/api/health` and `/api/auth/*`.
- `GET /api/health` → `200 {"status":"ok"}` when the database answers.
- `POST /api/teams` with `{ name, regulation, paste, notes? }` → `201` with the Team, or `422` with `{ errors: [{ line, message }] }`. Warnings are returned in both cases.
- `GET /api/teams` → the User's Teams, newest first.
- `GET /api/teams/:id` → the Team, or `404` if it doesn't exist or belongs to someone else.
- `GET /api/teams/:id/paste` → the Champions paste as `text/plain`.
- `DELETE /api/teams/:id` → `204`, or `404` as above.

### Web app (ADR 11)
- Nuxt with `ssr: false`, built with `nuxi generate`.
- shadcn-vue components, and TanStack Query for Vue for server state.
- Pages: `/signup`, `/login`, `/teams`, `/teams/new`, `/teams/:id`. Logged-out visitors are sent to `/login`.
- Phone first: every page works at 375 px wide.
- Nuxt's `server/` folder is not used.

### Serving and configuration (ADRs 11, 15)
- In production, one Node process (Hono) serves `/api` plus the generated Nuxt files, falling back to `index.html`.
- In development, `pnpm dev` starts both, with Nuxt proxying `/api` to Hono.
- Environment variables, documented in `.env.example`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `APP_URL`, `ALLOW_SIGNUPS` (default `true`), `PORT` (default `3000`).
- Multi-stage Dockerfile producing one image. `compose.yaml` runs the app and Postgres, with a named volume for Postgres data.

## Testing decisions (ADR 13)
- Test behaviour through public interfaces, not internals.
- `packages/core`: Vitest unit tests for the paste reader and writer, using real Champions pastes as fixtures, including round trips and each rejection rule.
- `apps/api`: Vitest tests through Hono's `app.request()` against PGlite, with migrations applied. Cover authorization (another User's Team is `404`).
- CI: typecheck, lint and tests on every push; one Playwright smoke test against the built image in Compose (sign up, import a team, view it).
- `apps/web`: no component tests in this slice; the smoke test covers it.

## Out of scope
- Teamsheet export, Tournaments, Rounds, Opponents, the form-based team builder, editing a Team after import, legality checks, file uploads, email verification, password reset (including the admin reset screen), data export, billing.

# 04: Import a Team from a paste

Blocked by: 02, 03

## What to build
A logged-in User pastes a Champions team and saves it as a Team, end to end.

- `team` table and migration, as described in the spec's "Storage" section.
- `POST /api/teams`: reads the paste with the core reader; `201` with the Team (and warnings) on success, `422` with line errors and nothing saved on failure.
- Nuxt page `/teams/new`: name, Regulation (default `M-C`), notes and a paste box. Errors are shown next to the line they refer to; warnings are shown after saving. On success, go to `/teams/:id` (a minimal page for now; ticket 05 completes it).

## Acceptance criteria
- [x] API tests: a valid paste creates a Team owned by the User; a malformed paste returns `422` with line errors and stores nothing; no session gives `401`.
- [x] The stored `pokemon` value passes the core schema.
- [x] Importing a paste in the browser inside Docker Compose works, and a malformed paste shows its errors.
- [x] The page works at 375 px wide.

## Notes
- `team` table in migration `0002_teams`, as in the spec, with an index on `(owner_id, created_at)` for the list in ticket 05.
- `POST /api/teams` answers `201 { team, warnings }`, `422 { errors, warnings }` for paste problems, and `400 { error, fields }` for invalid fields (missing name, unknown Regulation, paste over 10,000 characters). Nothing is stored unless it answers `201`.
- `GET /api/teams/:id` was added here, owner only, because `/teams/:id` needs it. Another User's Team, a missing one and a malformed ID all answer `404`.
- `@myvgc/core` loads Showdown's data, about 900 KB gzipped. The web app imports `@myvgc/core/schema` (schemas and limits only), which ESLint enforces, and gets display names from the API: each Pokémon in a Team response carries `names`. The web app's JavaScript is 141 KB gzipped.
- Fixed the reader's messages to say "an item" and "an ability".
- Checked in a browser at 375 px in Docker Compose: a malformed paste lists each error with its line and "Show in paste" selects that line; a real paste saves and its ignored lines are shown on the Team page.

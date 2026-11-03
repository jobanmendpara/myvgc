# 04: Import a Team from a paste

Blocked by: 02, 03

## What to build
A logged-in User pastes a Champions team and saves it as a Team, end to end.

- `team` table and migration, as described in the spec's "Storage" section.
- `POST /api/teams`: reads the paste with the core reader; `201` with the Team (and warnings) on success, `422` with line errors and nothing saved on failure.
- Nuxt page `/teams/new`: name, Regulation (default `M-C`), notes and a paste box. Errors are shown next to the line they refer to; warnings are shown after saving. On success, go to `/teams/:id` (a minimal page for now; ticket 05 completes it).

## Acceptance criteria
- [ ] API tests: a valid paste creates a Team owned by the User; a malformed paste returns `422` with line errors and stores nothing; no session gives `401`.
- [ ] The stored `pokemon` value passes the core schema.
- [ ] Importing a paste in the browser inside Docker Compose works, and a malformed paste shows its errors.
- [ ] The page works at 375 px wide.

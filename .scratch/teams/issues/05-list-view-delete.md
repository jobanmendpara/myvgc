# 05: List, view, copy and delete Teams

Blocked by: 04

## What to build
The rest of the Teams screens and API.

- `GET /api/teams`, `GET /api/teams/:id`, `GET /api/teams/:id/paste`, `DELETE /api/teams/:id`, as described in the spec's "API" section. Another User's Team is always `404`.
- Nuxt `/teams`: the User's Teams, newest first, each showing name, Regulation and its species. An empty state links to `/teams/new`.
- Nuxt `/teams/:id`: every Pokémon build with display names (species, item, ability, nature, moves, Stat Points), the notes, a "Copy paste" button and a delete button with confirmation.

## Acceptance criteria
- [ ] API tests cover each route, including `404` for another User's Team on view, paste and delete.
- [ ] The paste from `GET /api/teams/:id/paste` reads back into the same Team.
- [ ] In the browser inside Docker Compose: list, open, copy and delete all work.
- [ ] The pages work at 375 px wide.

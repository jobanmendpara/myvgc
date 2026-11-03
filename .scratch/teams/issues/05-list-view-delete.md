# 05: List, view, copy and delete Teams

Blocked by: 04

## What to build
The rest of the Teams screens and API.

- `GET /api/teams`, `GET /api/teams/:id`, `GET /api/teams/:id/paste`, `DELETE /api/teams/:id`, as described in the spec's "API" section. Another User's Team is always `404`.
- Nuxt `/teams`: the User's Teams, newest first, each showing name, Regulation and its species. An empty state links to `/teams/new`.
- Nuxt `/teams/:id`: every Pokémon build with display names (species, item, ability, nature, moves, Stat Points), the notes, a "Copy paste" button and a delete button with confirmation.

## Acceptance criteria
- [x] API tests cover each route, including `404` for another User's Team on view, paste and delete.
- [x] The paste from `GET /api/teams/:id/paste` reads back into the same Team.
- [x] In the browser inside Docker Compose: list, open, copy and delete all work.
- [x] The pages work at 375 px wide.

## Notes
- Started from uncommitted work already on this branch (routes, tests, `/teams`, `PokemonBuildCard`, the delete dialog), reviewed and finished.
- `GET /api/teams` returns full Teams, newest first, so the list and Team pages share one shape. Another User's Team, a missing one and a malformed ID answer `404` on view, paste and delete.
- `/` now redirects to `/teams`, which is home.
- Copy paste: the paste is fetched when the Team page loads, so a tap copies at once (Safari only allows clipboard writes during the tap). Before it arrives, a `ClipboardItem` holding the pending fetch is used. If the browser blocks the clipboard (for example plain HTTP on a LAN address), the paste is shown selected, to copy by hand.
- Notes are shown as plain text with line breaks kept; rendering Markdown is left for later.
- Checked in a browser at 375 px in Docker Compose: empty state, two real Teams listed newest first, every build detail, the clipboard matching `GET /api/teams/:id/paste`, the blocked-clipboard fallback, "Keep it", delete, and another User seeing nothing.

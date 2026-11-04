# 07: Opponents list and pages

**What to build:** An Opponents area lists everyone the User has played, with their Head-to-head record, and can be searched by display name or Alias. An Opponent's page shows their Aliases, notes, Head-to-head record and every Round against them, with each Round's notes. The User can rename an Opponent, edit Aliases and notes, create an Opponent from the list, and delete one with no Rounds.

**Blocked by:** 05

**Status:** done

- [x] `GET /api/opponents/:id` returns the Opponent with Aliases, notes, Head-to-head record (without Byes) and Rounds; another User's Opponent is a 404.
- [x] `POST /api/opponents` creates one; `PATCH` replaces the display name, notes and Aliases.
- [x] `DELETE /api/opponents/:id` answers 409 when the Opponent has Rounds, and 204 otherwise.

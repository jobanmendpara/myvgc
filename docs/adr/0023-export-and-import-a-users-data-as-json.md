# 23. Export and import a User's data as JSON

Date: 2026-11-06
Status: Accepted (DEV-39)

## Context
A User should be able to move their data to another install, in either direction between hosted and self-hosted, and keep a copy of their own. ADR 17 makes this matter more, since data now sits on phones. The two installs may run different releases. Every id is a UUID that is unique across one install, and ADR 17 already makes creates idempotent by id.

## Decision
- **A Data export is one User's domain data as versioned JSON**: Teams; Opponents with their Aliases and Note entries; Tournaments with their Team snapshot, Rounds (Games inline) and Opponent's Teams; and Player details. It leaves out everything about the account (email, password, sessions, role, ban state) and any uploaded files. Backing up a whole install stays with `pg_dump`.
- **Grouped by record, not by table.** The file follows the API's shapes, keeps every id and every `createdAt` and `updatedAt`, and has a header: `format: "myvgc-export"`, an integer `version` and `exportedAt`. Its Zod schema lives in `packages/core`, so the format depends on core, not on Drizzle.
- **Versions upgrade forward.** An import accepts the current version and every older one, upgrading older files in core, and rejects a newer one with a message to update the install. Version 1 ships with what exists today; Opponent's Teams (DEV-32) and Player details each bump the version when they land.
- **Import adds; it never deletes or changes.** A User can import into any account. The whole file is checked with the same core schemas as a normal write, then written in one transaction: one bad record means nothing is written, and the reply names it. Species, items or a Regulation the install doesn't know are rejected. Legality isn't checked; an illegal Team imports with its warning (ADR 18).
- **The existing record wins, one record at a time.** A record whose id the User already has is skipped and counted as already there, so importing the same file twice is harmless. An Opponent's Team the User already has for that Opponent and Tournament is skipped the same way. Player details are taken from the file only when the User has none.
- **Conflicts fail the import with a 409**: an id another User on this install holds, or a Round with a new id whose Swiss round number or Top cut stage is already logged in that Tournament.
- **References must resolve, except a Team snapshot's link.** A Team snapshot whose Team is in neither the file nor the account keeps its copy and loses the link. Any other missing reference, such as a Round's Opponent, is rejected.
- **Online only.** `GET /api/export` downloads `myvgc-<date>.json`. `POST /api/import` takes up to 10 MB and replies with counts per kind of record (added, already there). The web app offers both in a "Your data" section and warns that writes still in the outbox are not in the export.

## Consequences
- Importing an old backup doesn't undo later edits, since the existing record wins.
- One file can't be imported into two accounts on the same install. If that's ever needed, ids derived from the User and the original id (such as uuidv5) can be added without changing the format.
- An Opponent merged away on this install (DEV-36) comes back as a separate Opponent if the file still has it; the User merges it again.
- Each new kind of User data must extend the format and bump its version, with an upgrade step in core.
- Tests: Vitest in core for the schema and the upgrades; API tests through `app.request()` on PGlite for a round trip (User A exports, User B on a fresh database imports, and B's export equals A's apart from `exportedAt`) and for a re-import that counts everything as already there.

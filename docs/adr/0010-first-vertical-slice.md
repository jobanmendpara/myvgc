# 10. First vertical slice: Teams from Showdown pastes

Date: 2026-11-03
Status: Accepted

## Decision
The first slice covers sign-up and login, importing a Team from a Champions-format Showdown paste, saving it, and listing and viewing Teams. It is built end to end, from Postgres through the Hono API to the Nuxt front end, running in Docker.

Out of the first slice:
- Teamsheet export (next).
- A form-based team builder (after paste import).
- Legality checks against a Regulation (not planned yet).
- File uploads of any kind. Uploaded teamsheet PDFs will first be stored as reference attachments, and later read into Teams through the same "file in, Team out" pipeline as reading screenshots of replica teams.

## Consequences
In Champions pastes, the `EVs:` line holds Stat Points (0 to 32 per stat), so the paste reader must interpret them as Stat Points.

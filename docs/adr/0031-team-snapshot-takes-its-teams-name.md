# 31. A Team snapshot takes its Team's current name

Date: 2026-11-25
Status: Accepted (DEV-219). Amends ADR 9.

## Context
ADR 9 freezes a copy of the User's Team on a Tournament, the Team snapshot, so the Tournament remembers the Team as it was brought. The copy included the Team's name. Renaming a Team therefore left the old name on every Tournament it was linked to, and "Update snapshot" only fixes that until the Tournament is over. Users expect a renamed Team to show its new name everywhere. The name is a label, not part of what was brought: it isn't printed on the Teamsheet, only used for the download's file name.

## Decision
- **The Pokémon builds stay frozen; the name follows the Team.** While a Team snapshot links back to its Team, it carries that Team's current name, also on Tournaments that are over.
- **Written on save.** Saving a Team with a new name sets `team_name` on every one of the User's Tournaments whose snapshot links to it, in the same transaction. Reads don't change, so the Tournament page, the Tournaments list, the dashboard, the Teamsheet's file name and the Data export all get the new name.
- **A deleted Team's name stays.** When the Team is deleted the link goes (ADR 9) and the snapshot keeps the last name it had.
- **Web app.** Once a Team edit is sent, the outbox asks the server again for the Tournaments, as it does for Rounds after an Opponent is renamed. A rename still waiting on the phone doesn't show on Tournaments until it is sent.

## Consequences
- Renaming a Team touches each linked Tournament's `updated_at`.
- Past Tournaments no longer keep the name a Team had on the day; only its Pokémon builds are as brought.

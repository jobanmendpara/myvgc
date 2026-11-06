# 20. Teamsheet export uses stored Player details; date of birth is never stored

Date: 2026-11-05
Status: Accepted (DEV-31)

## Context
The official team list asks for things MyVGC didn't store: Player Name, Trainer Name in Game, Switch Profile Name, Age Division, Player ID, Date of Birth, Support ID and Battle Team Number / Name (`docs/research/vg-team-list-pdf.md`, questions 1, 2, 4 and 6). They rarely change, so asking for them on every export is a chore, but Date of Birth is sensitive personal data. Support ID is the ID shown at the bottom left of the Pokémon Champions title screen (RK9's team list help).

## Decision
- **Player details live on the User** (glossary): Player Name, Trainer Name in Game, Switch Profile Name, Player ID, Support ID and Age Division, all optional. They're edited in account settings and pre-filled in the export dialog, where changes apply to that export only.
- **Date of Birth is never stored**, not even for one export. The box stays blank for the User to write in by hand. Age Division is stored as the User sets it, even though it can go stale when a new Season starts.
- **Battle Team Number / Name** defaults to the Team's name and can be changed in the export dialog. That change isn't saved either.
- **Export starts from a Team or from a Tournament's Team snapshot**, never from an Opponent's Team. It produces one two-page PDF (staff and opponents pages), `<Team name> Teamsheet.pdf`, generated on demand (ADR 6) and online-only (ADR 17).
- **Gaps stay blank.** A Team with fewer than six Pokémon builds, or builds missing fields, still exports. Stat boxes are filled (with stat values, ADR 19) only for a build that has a Stat Alignment or Stat Points.
- **Illegal Teams still export** (ADR 18, warn about illegal Teams). The export dialog shows the legality badge and its problems first.
- **Names as the Battle Team shows them:** in-game display names, and a battle-only form such as a Mega is written as its base form.
- **Font:** a bundled open-licensed font (Noto Sans, OFL) is embedded as a subset, because Calibri can't be redistributed and the standard Helvetica font can't encode "♀". Text shrinks to fit its box, down to about 6 pt, and is never clipped.
- Builds fill the boxes in Team order, left to right, then top to bottom.

## Consequences
- MyVGC now holds identifying player data (Player ID, Support ID), which the hosted service must treat as personal data.
- Uploading a Teamsheet PDF is still deferred (ADR 6).

# 19. Teamsheet stat boxes hold stat values

Date: 2026-11-05
Status: Accepted (DEV-50)

## Context
The staff page of the official team list has six stat boxes for each Pokémon (HP, Atk, Def, Sp. Atk, Sp. Def, Speed), and the sheet doesn't say what goes in them (`docs/research/vg-team-list-pdf.md`, question 3). A Pokémon build stores Stat Points and a Stat Alignment, not stat values (glossary). The current VGC Tournament Handbook could not be read to settle it: pokemon.com answers 403 from our environment.

## Decision
- **Teamsheet export writes stat values in the stat boxes**, not Stat Points. Earlier VG team lists asked for stat values, and staff check the list against the in-game summary, which shows stat values first.
- **Stat values are worked out, never stored.** `statValues()` in `packages/core` applies Showdown's Champions formula: HP is base + Stat Points + 75; every other stat is base + Stat Points + 20, then 10% up or down for the Stat Alignment, rounded down. It matched all 36 stat values on six in-game summary screens (DEV-50), which a test keeps.
- **The stored species or form decides the base stats.** A build holding a Mega Stone shows its base form's stats, as the game's summary does.
- **The web app shows stat values too**, in the Team builder and on each Pokémon build card. It works them out on the device from base stats carried in the names list (ADR 17), so it still doesn't load Showdown's data.

## Consequences
- Teamsheet export (DEV-31) needs no new data: it calls `statValues()` with base stats from `@myvgc/core`.
- If the handbook turns out to ask for Stat Points, a new ADR changes this. Writing Stat Points would need no calculation.
- Support ID, also on the staff page, is still unexplained. It stays an open question in DEV-31.

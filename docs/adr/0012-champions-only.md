# 12. Pokémon Champions only

Date: 2026-11-03
Status: Accepted

## Decision
MyVGC supports only Pokémon Champions. Every Team and Tournament is tagged with a Regulation, defaulting to the current one. Every Showdown paste is read in Champions format, where the `EVs:` line holds Stat Points. Pokémon data comes from Showdown's Champions data through `@pkmn/dex` and `@pkmn/mods` (MIT), pinned to a version.

## Consequences
The Team type and the paste reader handle only one game's mechanics. Supporting another game later would be a deliberate redesign.

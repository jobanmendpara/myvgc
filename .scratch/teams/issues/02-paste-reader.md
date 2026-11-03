# 02: Champions paste reader and writer in `packages/core`

Blocked by: 01

## What to build
Test-first, the Team and Pokémon build Zod schemas and a reader and writer for Champions-format Showdown pastes, as described in the spec's "Pokémon build model" and "Champions paste format" sections.

- First confirm which `@pkmn/mods` mod holds the Champions data (the research names Showdown's `data/mods/champions`; see `docs/research/pokemon-champions-data.md`) and pin exact versions of `@pkmn/dex` and `@pkmn/mods`.
- Reading a paste returns either a Team's builds plus warnings, or a list of `{ line, message }` errors.
- Writing a Team returns a Champions paste using display names from the data.
- Look up names case- and punctuation-insensitively, the way Showdown turns names into IDs.

## Acceptance criteria
- [x] Real Champions team pastes (at least 3 fixtures, including Megas and forms) read into the expected builds.
  - Four real Reg M-C and M-B pastes from pokepast.es and vrpastes.com (sources in `packages/core/test/fixtures.ts`). Expected builds come from Showdown's own `Teams.import`, not from MyVGC's reader.
- [x] Each rejection rule in the spec has a test that checks the line number and message.
- [x] `Level:`, `IVs:`, `Tera Type:`, `Shiny:` and `Happiness:` lines produce warnings, not errors.
- [x] Writing and then reading a Team gives back the same Team, for every fixture.
- [x] `packages/core` has no I/O and no dependency on Hono, Nuxt or Drizzle.

## Notes
- The Champions data is `@pkmn/mods/champions` (`championsregmb` only adds M-B restrictions). `@pkmn/dex` and `@pkmn/mods` are pinned to `0.10.13`.
- "Recognised" means the entry exists in the mod and Showdown doesn't mark it non-standard (`Past`, `Future`, `CAP`, ...). That is game membership, not Regulation legality.
- 24 real Reg M-C pastes linked from MetaVGC were also checked by hand: all read and round-trip. Real pastes sometimes name a Mega form as the species (`Garchomp-Mega-Z`); the reader accepts it, since rejecting it would be a legality check.
- Bundled, core is about 10 MB because `@pkmn/dex` carries every generation's data. Fine for the API; worth checking before the web app imports it.

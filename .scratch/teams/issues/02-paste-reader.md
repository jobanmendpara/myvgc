# 02: Champions paste reader and writer in `packages/core`

Blocked by: 01

## What to build
Test-first, the Team and Pokémon build Zod schemas and a reader and writer for Champions-format Showdown pastes, as described in the spec's "Pokémon build model" and "Champions paste format" sections.

- First confirm which `@pkmn/mods` mod holds the Champions data (the research names Showdown's `data/mods/champions`; see `docs/research/pokemon-champions-data.md`) and pin exact versions of `@pkmn/dex` and `@pkmn/mods`.
- Reading a paste returns either a Team's builds plus warnings, or a list of `{ line, message }` errors.
- Writing a Team returns a Champions paste using display names from the data.
- Look up names case- and punctuation-insensitively, the way Showdown turns names into IDs.

## Acceptance criteria
- [ ] Real Champions team pastes (at least 3 fixtures, including Megas and forms) read into the expected builds.
  - Three fixtures exist and pass, with Megas (Charizardite Y, Garchompite Z, Gengarite) and forms (Rotom-Wash, Floette-Eternal, Basculegion-F, Ninetales-Alola, Tauros-Paldea-Aqua, Maushold-Four, Arcanine-Hisui). They were written by hand in Showdown's export format, with every name checked against the pinned data, because paste sites were unreachable. Swap in real tournament pastes to close this.
- [x] Each rejection rule in the spec has a test that checks the line number and message.
- [x] `Level:`, `IVs:`, `Tera Type:`, `Shiny:` and `Happiness:` lines produce warnings, not errors.
- [x] Writing and then reading a Team gives back the same Team, for every fixture.
- [x] `packages/core` has no I/O and no dependency on Hono, Nuxt or Drizzle.

## Notes
- The Champions data is `@pkmn/mods/champions` (`championsregmb` only adds M-B restrictions). `@pkmn/dex` and `@pkmn/mods` are pinned to `0.10.13`.
- "Recognised" means the entry exists in the mod and Showdown doesn't mark it non-standard (`Past`, `Future`, `CAP`, ...). That is game membership, not Regulation legality.
- Bundled, core is about 10 MB because `@pkmn/dex` carries every generation's data. Fine for the API; worth checking before the web app imports it.

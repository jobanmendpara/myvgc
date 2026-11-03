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
- [ ] Each rejection rule in the spec has a test that checks the line number and message.
- [ ] `Level:`, `IVs:`, `Tera Type:`, `Shiny:` and `Happiness:` lines produce warnings, not errors.
- [ ] Writing and then reading a Team gives back the same Team, for every fixture.
- [ ] `packages/core` has no I/O and no dependency on Hono, Nuxt or Drizzle.

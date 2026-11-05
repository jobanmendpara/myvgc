# 14. Store Showdown IDs; reject malformed pastes

Date: 2026-11-03 (amended 2026-11-05 for the form-based Team builder, DEV-33, and for legality warnings, DEV-42)
Status: Accepted

## Decision
- Species, forms, moves, items, abilities and natures are stored as Showdown IDs (such as `incineroar`, `fakeout`, `sitrusberry`). Display names are looked up from the pinned data package.
- The paste reader rejects malformed pastes with clear, line-by-line errors: more than 6 Pokémon, more than 4 moves, Stat Points above 32 for a stat or above 66 in total, or a name the Champions data doesn't recognize.
- Pokémon builds sent directly (by the form-based Team builder) pass the same checks as a paste, with errors by field instead of by line: a name the Champions data doesn't recognize, Stat Points out of range, more than 4 moves, or more than 6 Pokémon.
- Both ways in also reject the same move twice in one build. That is malformed data, not legality; two builds with the same species or item are legality (species and item clauses), which ADR 18 warns about.
- Both ways in also limit a nickname to one line of at most 100 characters, so it can't break a line of an exported paste.
- The 25 Stat Alignments are the one exception to looking names up: their IDs, names and effects are hard-coded in `@myvgc/core/schema` so the web app needn't load the data package. A test keeps them matching it.
- Whether a Team is legal in a Regulation is a warning, never a rejection (ADR 18). A name is rejected only when it isn't in any Champions Regulation.

## Consequences
- Stored data stays clean, and teamsheet export can rely on it.
- Display names can be translated later without changing stored data.

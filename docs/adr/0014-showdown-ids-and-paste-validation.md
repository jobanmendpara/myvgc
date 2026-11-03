# 14. Store Showdown IDs; reject malformed pastes

Date: 2026-11-03
Status: Accepted

## Decision
- Species, forms, moves, items, abilities and natures are stored as Showdown IDs (such as `incineroar`, `fakeout`, `sitrusberry`). Display names are looked up from the pinned data package.
- The paste reader rejects malformed pastes with clear, line-by-line errors: more than 6 Pokémon, more than 4 moves, Stat Points above 32 for a stat or above 66 in total, or a name the Champions data doesn't recognize.
- Whether a Team is legal in a Regulation is still not checked (ADR 10).

## Consequences
- Stored data stays clean, and teamsheet export can rely on it.
- Display names can be translated later without changing stored data.

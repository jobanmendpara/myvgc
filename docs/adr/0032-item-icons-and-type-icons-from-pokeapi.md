# 32. Item icons and Type icons come from PokeAPI

Date: 2026-11-25
Status: Accepted (DEV-216, DEV-221). Extends ADR 29.

## Context
v0.3.0 shows an Item icon beside each held item and a Type icon for a Pokémon build's types and each move's type (map DEV-214). ADR 29 allowed Sprites as the only official art. The research in `docs/research/item-and-type-icon-sources.md` (on the branch `research/item-and-type-icon-sources`, DEV-215) compared the sources. Every one of them is The Pokémon Company's art.
- **Items.** No source has every one of the 166 held items Champions allows (81 of them Mega Stones) in one style that matches the Sprites.
  - PokeAPI's `sprites/items/` covers all 166 under the terms ADR 29 accepted. It mixes two styles: 125 files are 30 px pixel art (the 42 older Mega Stones share one plain marble) and 41 are 160 px detailed art (the Mega Stones new in Legends Z-A, and Fairy Feather).
  - Showdown's item sheet is consistent, but some cells are community art whose authors ask to be contacted first. That is the reason ADR 29 turned down Showdown for Sprites.
  - WikiDex, Bulbapedia and Serebii have detailed art, but their terms don't allow redistribution.
- **Types.** PokeAPI has two Champions sets. `types/generation-ix/champions/` is a 150 × 36 label with the name, too wide to sit inline. `types/generation-ix/champions/small/` holds 60 × 60 rounded squares, each a white symbol on the type's colour. They are the same files as Scarlet-Violet's.

## Decision
- **Source.** PokeAPI's `sprites` repository at the commit ADR 29 pins: `sprites/items/` for Item icons and `sprites/types/generation-ix/champions/small/` for Type icons. The same Type icon is used for a build's types and before each move.
- **Mixed styles are accepted for Item icons for now.** The item's name always shows, so an Item icon is decoration, like a Sprite. The mix goes away when a later pin brings a Champions item folder.
- **The tables.** `packages/core/src/icons.ts` holds two tables:
  - `ITEM_ICON_FILES`, from each Champions held item's Showdown ID to its PokeAPI file. It has 166 rows, generated from item names (lower-cased, `'` and `.` dropped, other runs of characters turned into `-`), plus one row written by hand: Leek is `stick.png`.
  - `TYPE_ICON_NUMBERS`, from each of the 18 type IDs to PokeAPI's type number (Normal 1 to Fairy 18).
- **Committed files.** `pnpm sprites:update` also writes `apps/web/public/item-icons/<showdown-item-id>.webp` and `apps/web/public/type-icons/<type-id>.webp`, all 48 × 48: twice the largest display size the prototype (DEV-218) picks.
  - Pixel art is scaled nearest-neighbour and stored as lossless WebP, so it keeps its hard edges.
  - Larger art is scaled down smoothly and stored at quality 80, like Sprites.
  - Each folder has a NOTICE saying the images belong to The Pokémon Company and are not covered by the AGPL (ADR 1).
- **Served from MyVGC's own origin**, like Sprites. A missing file gets a 404, never `index.html`, from both Hono and the service worker, so the `<img>` fails and the name shows as usual. The web app builds an icon's URL from the ID it already has and needs no table.
- **Offline.** The service worker precaches both folders with the app shell (ADR 17).
- **Upkeep.** A Vitest test in `packages/core` fails when a Champions held item has no row or no file. A `@pkmn/mods` bump that adds an item therefore needs a new row and a rerun of the script; until then, the item shows a gap the icon's size beside its name. Type icons are tested against a fixed list of 18, not every type in the data, so Stellar needs no icon: it exists only for Terastallization, which Champions doesn't have.
- **Disclaimer.** The Settings footer reads "Sprites and icons from PokeAPI", and the README says the same.

## Consequences
- `docs/risks.md` allows Sprites, Item icons and Type icons as the only official art. Formal legal review is still due before taking payments.
- Item icons look uneven side by side: a 30 px pixel-art Leftovers next to a detailed Garchompite Z. This is accepted until PokeAPI has a Champions item folder.
- The repository and the image grow by 184 files: 166 Item icons (79,742 bytes) and 18 Type icons (9,170 bytes), 88,912 bytes (86.8 KiB) in all, measured when the script first wrote them (DEV-221).
- The service worker's precache grows by those 184 entries and 86.8 KiB, from 2335.0 KiB to 2421.8 KiB. This is under the 0.3 MB DEV-216 estimated, so no size sign-off is needed.
- The item table is MyVGC's to maintain, like ADR 29's Sprite table, and the failing test makes sure someone notices a new item.

# Item icon and Type icon sources for Pokémon Champions: coverage, terms, size and style

Checked 2026-11-25 for MyVGC (DEV-215, part of the map DEV-214). This note compares places MyVGC could get a small icon for (a) every held item Pokémon Champions allows, Mega Stones included, and (b) the 18 types, to serve from its own origin as committed files (ADR 29). It does not choose one; that is DEV-216.

Notes on method:
- **The Champions item list.** Every item that `@pkmn/mods` 0.10.13's `champions` or `championsregmb` mod has with `exists` and no `isNonstandard` mark, the rule `inChampions` in `packages/core/src/champions.ts` uses. It gives **166** items: **81 Mega Stones** and 85 others (57 held items and 28 Berries). `championsregmb` adds none that `champions` lacks. **[verified]** (script over `@pkmn/mods` 0.10.13). Serebii's Champions item page lists the same split: 57 "Hold Items", 81 "Mega Stones", 28 "Berries". **[verified]** ([serebii.net/pokemonchampions/items.shtml](https://serebii.net/pokemonchampions/items.shtml))
- **Types.** The `champions` mod has 19 types without a non-standard mark: the 18 plus Stellar. Stellar exists only for Terastallization, which Champions doesn't have, so 18 are needed. **[verified]** for the data; that Champions has no Tera is **[inferred]** from Champions' rules.
- **PokeAPI** was read through the GitHub API at the commit ADR 29 pins (`c0542f7c51215d9672439012838c99f520596cbd`, from `packages/core/src/sprites.ts`): the trees of `sprites/items` and `sprites/types`, plus the files themselves from `raw.githubusercontent.com`.
- **Showdown** files were fetched from `play.pokemonshowdown.com/sprites`. Sheet positions come from `spritenum` in `smogon/pokemon-showdown` `data/items.ts` (last changed 2026-10-18, `49875bcd`). Each of the 166 cells was decoded and checked for pixels.
- Claims are labelled **[verified]** (checked against the owning source or measured here), **[inferred]** or **[unverified]**.

## Summary

### Item icons

| | PokeAPI `sprites/items/` | Showdown `itemicons-sheet.png` | WikiDex "Champions" files | Serebii `itemdex/sprites/` |
|---|---|---|---|---|
| Coverage of the 166 | **166** (Leek is `stick.png`) | **166** | **82**: 81 Mega Stones and Leek; none of the 84 others | 166 [inferred: listed on its Champions page; 5 fetched] |
| Keyed by | PokeAPI slug (`choice-scarf`, `absolite-z`) | `spritenum` (cell index), not in `@pkmn/dex` | Spanish names (`Garchompita Z Champions.png`) | Showdown-style ID (`garchompitez`, `focussash`) |
| Size and format | PNG; 125 at 30 × 30, 41 at 160 × 160 | one 384 × 1152 PNG of 24 × 24 cells | PNG, 128 × 128 (Leek 55 × 55) | PNG, 40 × 40 |
| Total for Champions | 327 KB | 89 KB for the whole sheet (768 cells) | 921 KB for the 81 stones | ≈2–3 KB each [5 measured] |
| Style | **Mixed**: Gen 5-era pixel art (Veekun) for 125, HD Legends Z-A / Scarlet-Violet art for 41 | One consistent pixel-art style (Gen 5-like) | Champions' own in-game art | Consistent HD art, downscaled |
| Terms | CC0 wrapper; "All image contents within are Copyright The Pokémon Company" | Smogon: property of Nintendo / Game Freak / TPC; community sprites "talk to us first" | Text CC BY-SA; images "no pueden redistribuirse libremente" | "All Content is © Copyright of Serebii.net" |

**No source has Champions' own art for every held item.** Only WikiDex has files labelled as Champions art, and only for the Mega Stones and Leek. The two sources that cover all 166 are PokeAPI (two clashing styles) and Showdown (one pixel-art style that doesn't match the Champions species icons).

### Type icons

| | PokeAPI `types/generation-ix/champions/` | PokeAPI `…/champions/small/` | Showdown `types/` | partywhale/pokemon-type-icons |
|---|---|---|---|---|
| Coverage | 18 | 18 | 18 (+ Stellar, `???`) | 18 |
| Shape | **Label**: dark pill, coloured square with symbol, type name in capitals | **Symbol**: white symbol on a rounded coloured square | **Label**: pixel-art coloured box with the name | **Round symbol**: white symbol on a coloured circle |
| Size and format | PNG 150 × 36; 33 KB for 18 | PNG 60 × 60; 24 KB for 18 | PNG 32 × 14; 3.5 KB for 19 | SVG, 256 viewBox; 22 KB for 18 |
| Keyed by | PokeAPI type ID (`10.png` = Fire) | same | Type name (`Fire.png`) | Type ID (`fire.svg`) |
| Champions' own art | Yes, as contributed (#286) [unverified source] | **No**: byte-identical to the Scarlet-Violet and BDSP `small` sets | No | No: a vector recreation of the BDSP / Legends: Arceus / Scarlet-Violet symbols |
| Terms | as PokeAPI above | as PokeAPI above | as Showdown above | MIT (© 2022 James Watkins) for the vectors; the designs are TPC's |

## 1. PokeAPI `sprites` (pinned commit)

### Items

- `sprites/items/` holds 2,258 PNGs at its root, plus subfolders `berries/` (64), `dream-world/` (336), `gen3/` (5), `gen5/` (583), `gen8/` (8), `gen9/` (56) and `underground/` (85). **There is no Champions item folder**, and no `champions` folder anywhere outside `sprites/pokemon/` and `sprites/types/`. **[verified]**
- **Coverage.** 165 of the 166 match a root file by slug: the English name lower-cased, apostrophes and full stops dropped, other runs of characters turned into `-` (`King's Rock` → `kings-rock.png`, `Charizardite X` → `charizardite-x.png`, `Absolite Z` → `absolite-z.png`). The 166th is Leek, which is still under its old name `stick.png` (238 bytes). `large-leek.png` is a different item. **[verified]**
  - So a table from Showdown ID to file can be generated from item names, with one hand-written row. **[verified]**
- **Two styles.**
  - **125 files are 30 × 30 palette PNGs** (about 200–360 bytes each), from the 2017 commits "sprites from Veekun" and "sun and moon sprites, from Veekun". They are Gen 5-era bag pixel art. All 42 older Mega Stones (Venusaurite and so on) use one 30 px Gen 6-style marble. **[verified]** (file headers; viewed `venusaurite.png`, `leftovers.png`)
  - **41 files are 160 × 160 RGBA PNGs** (6.5–10 KB each): the 39 Mega Stones new in Legends Z-A and its DLC (Clefablite, Absolite Z, Garchompite Z, Raichunite X/Y and the rest), plus Fairy Feather. Their bytes are identical to `gen9/`, which PRs #195 ("I obtained them from Bulbapedia", 2026-02-13) and #197 ("Add Z-A megastones … obtained from Bulbapedia", 2026-02-18) added. PR #296 (2026-10-17, 1,360 files, "icon sprites from my previous works with the switch games") copied them to the root. **[verified]**
  - Placed side by side, a 30 px pixel marble and a 160 px HD marble look like two different games' art, because they are. **[verified]** (viewed)
- **No HD version of the 125 older items** exists anywhere in the repo at this commit (for example, there is no 160 px Leftovers). **[verified]** (tree listing)
- **Size.** The 166 files total 327,021 bytes (125 × ~0.25 KB + 41 × ~7 KB). **[verified]**

### Types

- `sprites/types/` has a folder per game. Generation IX has `scarlet-violet/` (19, Stellar included), `scarlet-violet/small/`, `scarlet-violet/Tera/`, and **`champions/` (18) and `champions/small/` (18)**, added by PR #286 "Add Champions Type Badge and Icons" (2026-10-01, no description). **[verified]**
- Files are named by **PokeAPI's type ID**: `1.png` Normal, 2 Fighting, 3 Flying, 4 Poison, 5 Ground, 6 Rock, 7 Bug, 8 Ghost, 9 Steel, 10 Fire, 11 Water, 12 Grass, 13 Electric, 14 Psychic, 15 Ice, 16 Dragon, 17 Dark, 18 Fairy. That is an 18-row table, or a fixed list in code. **[verified]** (viewed `10.png` = Fire, `18.png` = Fairy)
- **`champions/` is a label (a "badge")**: 150 × 36 RGBA PNG, a dark grey rounded pill with the type's colour as a rounded square at the left holding a white symbol, and the type's name in white capitals. 1.2–2.3 KB each, 33,366 bytes for 18. Its bytes differ from every other game's set. **[verified]** (viewed; blob SHAs)
- **`champions/small/` is a symbol**: 60 × 60 RGBA PNG, a white symbol on a rounded square in the type's colour. 24,304 bytes for 18. **All 18 are byte-identical to `scarlet-violet/small/` and `brilliant-diamond-shining-pearl/small/`**. So the "Champions" small icons are the Scarlet-Violet icons under a Champions path. Whether Champions itself reuses them is **[unverified]**. **[verified]** for the identity (same blob SHAs).
- None of PokeAPI's type icons is a circle. **[verified]**

### Terms

- `LICENCE.txt` at the pinned commit: "All image contents within are Copyright The Pokémon Company. This repository is distributed under CC0 1.0 Universal". The same terms ADR 29 accepted for the species Sprites. **[verified]**
- Neither PR #195/#197 (from Bulbapedia) nor #286 nor #296 states a licence for the art beyond that. **[verified]**

## 2. Showdown

### Item sheet

- `play.pokemonshowdown.com/sprites/itemicons-sheet.png`: 384 × 1152 PNG (8-bit RGB with a tRNS transparent colour), a grid of 16 × 48 cells of 24 × 24, 89,034 bytes, `Last-Modified` 2026-06-21. **[verified]**
- The client reads it with `spritenum`: `top = floor(n / 16) * 24`, `left = (n % 16) * 24` (`getItemIcon`, `pokemon-showdown-client` `play.pokemonshowdown.com/src/battle-dex.ts`). **[verified]**
- **Coverage.** All 166 Champions items have a `spritenum` in `smogon/pokemon-showdown` `data/items.ts`, and every one of those cells has pixels, the three Z Mega Stones included. No two Champions items share a cell. **[verified]** (decoded the sheet)
- **Mapping.** `@pkmn/dex` 0.10.13 drops `spritenum`: it is undefined for every item. MyVGC would need a 166-row ID → `spritenum` table, taken from Showdown's server data (MIT), or would crop the sheet once at build time into `<showdown-id>.png` files. **[verified]** for the missing field.
- **Style.** One consistent 24 px pixel-art style in the look of the Gen 5 bag icons, Mega Stones as small marbles. It isn't Champions art and doesn't match the 128 px HD Champions species icons MyVGC uses. **[verified]** (viewed all 166 cells)
- **Individual files.** `sprites/itemicons/<name>.png` (24 × 24) exists for only 77 of the 166: no Mega Stone, and not the Terrain Seeds, Fairy Feather, Roseli Berry or Terrain Extender. Names mix IDs and slugs. **[verified]** (HEAD requests)

### Type images

- `play.pokemonshowdown.com/sprites/types/<Name>.png`: 32 × 14 PNG, pixel-art coloured boxes with the name in capitals (DS-era style), 19 files (18 plus Stellar) totalling 3,495 bytes. The client shows them at `height="14" width="32"` (`getTypeIcon`). **[verified]**
- These are labels, not symbols. Showdown has no round type symbols. **[verified]** for the URLs tried.

### Terms

- [`smogon/sprites` README](https://github.com/smogon/sprites#license): the sprites are "property of Nintendo / Game Freak / The Pokémon Company", and community-made sprites carry a "please talk to us first" request. Which item cells, if any, are community-made isn't recorded. **[verified]** for the README; **[unverified]** per cell.
- `smogon/sprites` has a `src/champions/` folder of Champions species art (`sgarchomp-omega_z.png` and the like, last added 2026-09-11) but nothing for items or types. **[verified]**
- The client repo (AGPL-3.0) leaves `/sprites/` out; the sheet and type images are published only on the CDN. **[verified]**

## 3. WikiDex (Champions' own Mega Stone art)

- The category [Sprites de objetos de Pokémon Champions](https://www.wikidex.net/wiki/Categor%C3%ADa:Sprites_de_objetos_de_Pok%C3%A9mon_Champions) has 122 files: **all 81 Mega Stones** at 128 × 128 PNG (921,437 bytes in all, about 11 KB each), Leek ("Puerro", 55 × 55), and 40 non-held items (tickets, passes). Uploaded 2026-04-16 to 2026-09-13, 59 by a bot ("PoryBot"). **[verified]** (MediaWiki API)
- **No Champions file exists for the other 84 held items**: no Leftovers, Focus Sash, Choice Scarf and so on. WikiDex's other Leftovers files are `Restos EP.png` (Scarlet-Violet, 160 px) and `Restos LPZA.png` (Legends Z-A, 160 px). **[verified]** That Champions reuses the Scarlet-Violet / Z-A icons for those items is **[inferred]**; it would explain the gap.
- **Style.** The Champions Mega Stone art (`Garchompita Z Champions.png`) has the same design as PokeAPI's 160 px Z-A stone (`garchompite-z.png`), at 128 px. So for Mega Stones, Champions' art = Z-A art. **[verified]** by viewing; that the pixels match after resizing is **[unverified]**.
- **Names** are Spanish ("Venusaurita", "Lucarita Z"), so MyVGC would need an 82-row hand-made table. **[verified]**
- **Terms.** WikiDex text is CC BY-SA 3.0, but [WikiDex:Copyrights](https://www.wikidex.net/wiki/WikiDex:Copyrights) says images have their own licence, are mostly used as fair use, and that Pokémon images "no pueden redistribuirse libremente", used "sin ánimo de lucro". Each Champions file page carries the template `{{Pokémon sprite}}`. **[verified]**
- Bulbagarden Archives likely holds the same game files (PokeAPI's Z-A stones came "from Bulbapedia"), but its API sits behind a Cloudflare challenge and couldn't be checked. **[unverified]**

## 4. Serebii

- The Champions item page uses `/itemdex/sprites/<id>.png`, where `<id>` is the Showdown-style ID (`garchompitez.png`, `focussash.png`, `leek.png`). The 5 fetched were 40 × 40 RGBA PNG, 2.0–3.1 KB, consistent downscaled HD art (Scarlet-Violet era for Leftovers, `Last-Modified` 2022-11-18; Z-A era for the stones, 2025). **[verified]** for those 5; full coverage **[inferred]** from the page listing all 166.
- **Terms.** Footer: "All Content is © Copyright of Serebii.net 1999-2026." and "Pokémon and All Respective Names are Trademark & © of Nintendo". No reuse is offered. **[verified]**
- It is the one source that is both complete and in one HD style, but copying it means taking another site's work without permission. **[inferred]**

## 5. Open-licensed type symbol sets

- **[partywhale/pokemon-type-icons](https://github.com/partywhale/pokemon-type-icons)** (MIT, "Copyright (c) 2022 James Watkins"): 18 SVGs, `icons/<type>.svg`, 22,017 bytes in all. Each is a **round** coloured circle with a white symbol (`<circle … r="128"/>` plus one path; Fire is `#e4613e`). The README calls it "a recreation of the type icons found in Brilliant Diamond, Shining Pearl, Legends: Arceus, Scarlet, and Violet", the same symbols as PokeAPI's `champions/small`. Last commit 2022-11-24. **[verified]**
  - The MIT licence covers the redrawn vectors; the symbol designs themselves are TPC's, like every other option. **[inferred]**
- **[duiker101/pokemon-type-svg-icons](https://github.com/duiker101/pokemon-type-svg-icons)** (no licence file; README: "for any use"): 18 white-only symbol SVGs, based on a Dribbble concept, not the games' designs. Last commit 2020. **[verified]**

## 6. Facts that bear on DEV-216

- **No single source gives every Champions held item in one style that matches the species icons.** PokeAPI covers all 166 but mixes 30 px pixel art (125) with 160 px HD art (41). Showdown covers all 166 in one pixel style that clashes with the HD species icons. WikiDex has Champions' own art only for the 81 Mega Stones and Leek. Serebii is complete and consistent, but its terms don't allow copying. **[verified]**
- **ADR 29's "one consistent style" can't be met for items from PokeAPI alone.** The options are: accept the mix; use Showdown's pixel set for every item; or combine HD sources (PokeAPI's 41 + WikiDex/Bulbapedia's Champions or Z-A art for the rest), which means taking files from wikis whose terms are stricter than PokeAPI's CC0 wrapper. **[inferred]**
- **Mega Stones are the easy part.** The 39 new ones are HD in PokeAPI already, and Champions' own art exists for all 81 on WikiDex. The 42 older ones are only 30 px in PokeAPI. **[verified]**
- **Item mapping is cheap.** PokeAPI file names follow from item names with one exception (Leek → `stick.png`). Showdown needs `spritenum`, which `@pkmn/dex` doesn't expose. **[verified]**
- **Type icons from PokeAPI do fit ADR 29**: same repo, same pinned commit, same terms. Its `champions/` set is a 150 × 36 label with the name, too wide to sit inline at 48 px or less, and its `champions/small/` is a 60 × 60 rounded-square symbol, which is really the Scarlet-Violet set. There is no round symbol at PokeAPI. A round symbol means partywhale's MIT SVGs (the same designs, redrawn) or masking the small squares. **[verified]**
- **Size is small for any choice**: under 0.35 MB for all 166 PokeAPI items before re-encoding, under 35 KB for any type set. ADR 29's precache grows little. **[verified]**
- **Stellar** is in the `champions` mod without a non-standard mark. A test that walks every type in the data would ask for a 19th icon, which PokeAPI's Champions folders don't have. **[verified]**

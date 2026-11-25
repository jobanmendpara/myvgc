# Sprite sources for Pokémon Champions: coverage, terms, size and upkeep

Checked 2026-11-23 for MyVGC (DEV-169, part of the map DEV-168). This note compares the places MyVGC could get a small **Sprite** (the small picture of a species or form, see `CONTEXT.md`) and serve it from its own origin. It does not choose one; that is DEV-170.

Notes on method:
- **The Champions list.** Every species and form that `@pkmn/mods` 0.10.13's `champions` or `championsregmb` mod has with `exists` and no `isNonstandard` mark. That is the rule `packages/core/src/champions.ts` (`inChampions`) uses. It gives **392** entries. `championsregmb` adds no species that `champions` lacks.
- **Showdown coverage.** Every entry's URL was resolved with `@pkmn/img` 0.3.5 and sent a HEAD request on `play.pokemonshowdown.com/sprites/{gen5,dex,home-centered,ani}/` (1,568 requests). File sizes come from `Content-Length`, and dates from `Last-Modified`.
- **PokeAPI coverage.** The trees of `sprites/pokemon/versions/generation-ix/champions` and `sprites/pokemon/other/home` were read through the GitHub API at `master` on 2026-11-23. Showdown names were mapped to PokeAPI IDs with `https://pokeapi.co/api/v2/pokemon?limit=3000`.
- Claims are labelled **[verified]** (checked against the owning source or measured here), **[inferred]** (follows from verified facts) or **[unverified]**.

## Summary

| | Showdown `gen5` (96 px) | Showdown `dex` (120 px) | Showdown `home-centered` (192 px) | PokeAPI Champions `icons` (128 px) | PokeAPI `other/home` (512 px) |
|---|---|---|---|---|---|
| Champions coverage (of 382 real entries) | 371; 11 Megas have no file | 358; 24 missing | 342; 40 Megas missing | 382 (cosmetic forms by suffix) | 382 except 2 cosmetic forms |
| Keyed by | Showdown sprite ID (`raichu-megax`); `@pkmn/img` maps names | same | same | PokeAPI numeric ID (`10309`) plus slug suffixes | same |
| Own table needed for ADR 14 IDs | No: derivable from the Dex, or use `@pkmn/img` | No | No | Yes, about 392 rows | Yes |
| Size, whole Champions set | ≈0.6 MB, avg 1.6 KB | ≈2.0 MB, avg 5.7 KB | ≈8.1 MB, avg 23 KB | ≈6.0 MB, avg 13.6 KB | ≈45 MB, avg 128 KB |
| Where the art comes from | Gens 1–5: ripped from Black/White. Later: community Gen 5-style (Smogon Sprite Project). Some new Megas: scaled-down 3D renders | Game renders | Pokémon HOME renders | Game assets from Champions [inferred] | HOME-style renders |
| Terms on the files | "Property of Nintendo / Game Freak / TPC"; community sprites: "please talk to us first before using them" | Property of Nintendo / Game Freak / TPC | Property of Nintendo / Game Freak / TPC | Repo is CC0 but states "All image contents within are Copyright The Pokémon Company" | same |
| Published as | CDN only; sources in `smogon/sprites` git repo (no licence file) | same | same | git repo (`npm install github:PokeAPI/sprites`) | same |
| New Champions forms appeared | Same day to weeks; 11 Megas still missing (≥ 2 months) | slower; 24 missing | slowest; 40 missing | M-C Megas 1 day after M-C started | Champions Megas present since 2026-04-24 |

**Every option is art owned by Nintendo / Creatures / GAME FREAK / The Pokémon Company.** No source found gives a licence that clears that IP. The CC0, MIT or BSD notices cover only a project's own work: code, compilation, and in PokeAPI's case the repo wrapper. The one openly licensed fan-made source (PMD SpriteCollab) is CC BY-NC, which doesn't fit paid hosting (ADR 1). It also draws the same characters. See §5.

**What the facts favour (not a decision).** Showdown's `gen5` set is the smallest. It is keyed the way MyVGC already stores species (ADR 14), and it matches the map's style preference. But 11 Champions Megas have no static Sprite in any Showdown set, and the Gen 5-style art for later Pokémon carries a "talk to us first" request. PokeAPI's Champions `icons` are the only set that covers every real Champions entry, and each icon is drawn for Champions. The cost is a ~392-row ID table and ~6 MB of files, which can be resized. A mixed approach (Showdown first, PokeAPI icons for the gaps) is possible, but would mix styles.

## 1. The Champions list

- 392 entries pass the `inChampions` rule. 162 are formes and 82 are Megas, including the M-C "Z" Megas (Absol-Mega-Z, Garchomp-Mega-Z, Lucario-Mega-Z). **[verified]** (script over `@pkmn/mods` 0.10.13 in `packages/core`)
- **10 of the 392 aren't really in Champions.** Their base species is marked `Past` in the `champions` mod, but these battle-only formes carry no `isNonstandard` mark, so the rule lets them through: Meloetta-Pirouette, Minior-Meteor, Cramorant-Gulping, Cramorant-Gorging, Eiscue-Noice, Ogerpon-Teal-Tera, Ogerpon-Wellspring-Tera, Ogerpon-Hearthflame-Tera, Ogerpon-Cornerstone-Tera and Terapagos-Terastal. **[verified]** (`Dex.mod('champions').species.get('Meloetta').isNonstandard === 'Past'`, while `Meloetta-Pirouette` has `battleOnly: 'Meloetta'` and no mark). Coverage below is counted against the **382 real entries**, and the 10 are noted separately.
  - Side finding: `champions.species()` and the names table in `packages/core` accept these 10 IDs the same way. A Pokémon build could store `terapagosterastal`. **[inferred]** from the shared rule. This is not a Sprite question, but a Sprite table built from that list would carry them.
- The list includes 22 cosmetic formes (19 Vivillon patterns, 7 Alcremie creams, Polteageist-Antique and Sinistcha-Masterpiece, among others). Showdown gives them their own species entries; PokeAPI treats them as form suffixes. **[verified]**

## 2. Showdown's sprites (`play.pokemonshowdown.com/sprites`, `@pkmn/img`, Smogon Sprite Project)

### Coverage

HEAD requests on 2026-11-23, against the URL `@pkmn/img` gives for each name. For all 392 entries, the file name `@pkmn/img` uses matched `toID(baseSpecies)` + `-` + `toID(forme)`. **[verified]**

| Set | Pixels | Files found (of 392) | Real Champions entries with no file |
|---|---|---|---|
| `gen5/` (static PNG) | 96 × 96 | 381 | **11**: `raichu-megax`, `raichu-megay`, `staraptor-mega`, `scolipede-mega`, `scrafty-mega`, `eelektross-mega`, `pyroar-mega`, `malamar-mega`, `barbaracle-mega`, `dragalge-mega`, `falinks-mega` |
| `dex/` (static PNG) | 120 × 120 (128 × 128 for some new Megas) | 365 | 24: the 11 above, plus `absol-megaz`, `garchomp-megaz`, `lucario-megaz`, `baxcalibur-mega`, `golisopod-mega`, `falinks`, `grapploct`, `grimmsnarl`, `overqwil`, `perrserker`, `pincurchin`, `polteageist-antique`, `sirfetchd` |
| `home-centered/` (static PNG) | 192 × 192 | 352 | 40, all of them Megas new in Champions (Clefable, Victreebel, Starmie, Dragonite, Meganium, Feraligatr, Skarmory, Chimecho, Froslass, Emboar, Excadrill, Chandelure, Golurk, Chesnaught, Delphox, Greninja, Floette, Meowstic ×2, Hawlucha, Crabominable, Drampa, Scovillain, Glimmora, the three Z Megas, Baxcalibur, Golisopod and the 11 above) |
| `ani/` (animated GIF) | varies | 382 | 5: `absol-megaz`, `garchomp-megaz`, `lucario-megaz`, `baxcalibur-mega`, `golisopod-mega` |
| icon sheet `pokemonicons-sheet.png` | 40 × 30 cells | all 392 have a non-zero offset | none |

- **The 11 Megas in the first row have no static Sprite in any Showdown set.** Only animated GIFs exist for them. **[verified]**
- `@pkmn/img` doesn't know about those gaps. `Sprites.getPokemon('Raichu-Mega-X', {gen: 'gen5'})` returns `…/gen5/raichu-megax.png`, which is a 404. For 134 entries without "dex" data, `getDexPokemon` falls back to the `gen5` URL. **[verified]** (`@pkmn/img` 0.3.5 `build/chunk-*.js`, and the HEAD results)
- The 10 phantom formes: `gen5` has all of them, `ani` lacks 5 (the four Ogerpon Tera formes and Terapagos-Terastal), and `dex` lacks the Cramorant formes and Terapagos-Terastal. **[verified]**
- Some `gen5` files for new Megas aren't Gen 5-style pixel art. `gen5/garchomp-megaz.png` is a 96 × 96 RGBA scaled-down 3D render. Most of the original `gen5` set is 8-bit palette PNGs. **[verified]** (viewed the file; `file` output). Whether this is a stand-in until community art arrives is **[unverified]**.

### Mapping from Showdown IDs (ADR 14)

- Showdown keys its files by **sprite ID**: the base species ID, a hyphen, then the forme ID (`raichu-megax`, `tauros-paldeacombat`, `meowstic-fmega`, `vivillon-icysnow`). MyVGC stores the species ID (`raichumegax`). The sprite ID can be derived from the Dex as `toID(species.baseSpecies) + (species.forme ? '-' + toID(species.forme) : '')`, which matched `@pkmn/img` for all 392 entries. **[verified]**
- `@pkmn/dex` 0.10.13 species don't expose `spriteid` (it came back `undefined` for every entry). **[verified]**
- `@pkmn/img` 0.3.5 maps names to files with its own bundled table, which its README puts at "~34.4KB after compression". It has no dependencies, and it takes a `domain` option "to facilitate easily hosting your own sprites". **[verified]** ([README](https://github.com/pkmn/ps/tree/main/img))

### Licence and terms

- **The files.** [`smogon/sprites` README, "License"](https://github.com/smogon/sprites#license): "The sprites themselves are property of Nintendo / Game Freak / The Pokémon Company, though Black & White sprites for Pokémon from later generations were created by artists in the community. The license for these community-created sprites is still being determined and may change in the future, but in the meantime please talk to use first before using them." **[verified]**
  - So Gens 1–5 in `gen5/` are ripped from Black/White, later Pokémon in `gen5/` are fan-made by the Smogon Sprite Project, and `dex/` and `home-centered/` are game and HOME renders. The `gen5` set gained the "Smogon Sprite Project's Gen 5-style sprites" in commit `6591abd4` (2026-08-23). **[verified]**
  - No written permission to copy or redistribute the files was found. No terms specific to hotlinking versus copying were found either. **[unverified]**: there may be a policy on pokemonshowdown.com that wasn't found.
- **The code.** `smogon/sprites` code: MIT (README; GitHub reports no licence file). `@pkmn/img`: MIT (README and `package.json`; the npm tarball ships no LICENSE file). The Showdown **client** is AGPLv3, and its README says the client repo leaves out `/sprites/` "for size reasons". **[verified]**
- **Copying.** The `@pkmn/img` README (pkmn, not Smogon) says: "you are strongly encouraged to [host your own sprites] to avoid driving up Pokémon Showdown's bandwidth costs … copy the sprites from Pokémon Showdown via the `--mirror` option of `wget`". It also says "you should at minimum host the icon sheets", because the offsets can change. **[verified]** This is a third party's encouragement, not Smogon's grant.
- **Attribution.** Nothing requires attribution for the ripped files. For the community sprites, the request is to ask first. **[verified]** (README)

### Size

Measured over the Champions files that exist (`Content-Length`):

| Set | Files | Total | Average | Largest |
|---|---|---|---|---|
| `gen5` | 381 | 612 KB | 1.6 KB | 15.6 KB |
| `dex` | 365 | 2.0 MB | 5.7 KB | 17.7 KB |
| `home-centered` | 352 | 8.1 MB | 23 KB | 40 KB |
| `ani` (out of scope) | 382 | 37 MB | 98 KB | 421 KB |
| `pokemonicons-sheet.png` (every species, every gen) | 1 | 393 KB | n/a | 480 × 4110 |

PNG only for these sets. No WebP was offered for them. **[verified for the URLs tried; other formats unverified]**

### Upkeep and publishing

- **Publishing.** Sprites are served from `play.pokemonshowdown.com/sprites` (Cloudflare, `cache-control: max-age=691200`). The sources are in the git repo [`smogon/sprites`](https://github.com/smogon/sprites), which is built by `*.build.ts` modules. There is no npm package of the images; `@pkmn/img` ships logic only. **[verified]** How the Showdown tree is deployed from that repo was not traced (the root holds `smogon.build.ts` for smogon.com). **[unverified]**
- **Speed.** `Last-Modified` dates: `ani/chimecho-mega.gif` 2026-06-22, `gen5/` and `dex/chimecho-mega.png` 2026-07-14 (M-B started 2026-06-17), and `gen5/garchomp-megaz.png` 2026-09-09, the day M-C started. As of 2026-11-23 the three M-C Z Megas still have no `dex`, `home-centered` or `ani` file, and the 11 Megas listed above have no static file at all. The icon sheet was last modified 2026-10-09. **[verified]**

## 3. PokeAPI's `sprites` repository

### Coverage

- `sprites/pokemon/versions/generation-ix/champions/` has 452 front files. Each has `back/`, `shiny/` and `female/` variants and `icons/` (452 PNG) plus `icons/shiny/`. The README describes them as "champions (WebPs with back, female, shiny, back-female, back-shiny, shiny-female variants and PNG icons with shiny variants)". **[verified]**
- Mapped from the 392 Showdown entries: 360 map to a PokeAPI Pokémon ID by number or slug, with about 25 hand-written exceptions (`meowstic-male-mega`, `tauros-paldea-combat-breed`, `maushold-family-of-four`, `squawkabilly-blue-plumage`, `minior-red-meteor` and others). Of those 360, **the only ones missing from the Champions folder and its icons are 6 of the phantom battle-only formes** (Meloetta-Pirouette, Minior-Meteor, Cramorant ×2, Eiscue-Noice, Terapagos-Terastal). **[verified]**
- The 32 that don't map to a Pokémon ID are cosmetic forms and the Ogerpon Tera formes. The cosmetic forms are present as suffixed files: `666-icy-snow`, `666-poke-ball`, `855-antique`, `1013-masterpiece`, and `869-<cream>-<sweet>` for Alcremie. Showdown has no sweet, so MyVGC would have to pick one. The Ogerpon Tera formes (phantoms) have no file. **[verified]**
- So every one of the 382 real Champions entries has a Champions front sprite and an icon. **[verified]**
- `sprites/pokemon/other/home/` (static PNG) has all 360 mapped IDs, including the new Champions Megas (e.g. `10309.png`, Garchomp-Mega-Z, a 512 × 512 render). Of the cosmetic forms, `855-antique` and `1013-masterpiece` aren't there, but the Vivillon and Alcremie suffixes are. **[verified]**

### Mapping from Showdown IDs

PokeAPI keys files by **numeric Pokémon ID** (`445`, `10309`), plus slug suffixes for cosmetic forms. MyVGC would need its own Showdown ID → PokeAPI file table of about 392 rows. It can mostly be generated from the PokeAPI name list, with about 25 manual rows and a choice of Alcremie sweet. **[verified]** (built here as a test)

### Licence and terms

- [`LICENCE.txt`](https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt) begins: "All image contents within are Copyright The Pokémon Company. This repository is distributed under CC0 1.0 Universal". CC0 §4(c) says the affirmer "disclaims responsibility for clearing rights of other persons". **[verified]**
  - So the CC0 covers PokeAPI's own contribution. The art itself stays TPC's, and PokeAPI says so. **[inferred]**
- `package.json` says `"license": "ISC"`, which is inconsistent with `LICENCE.txt`. GitHub reports `NOASSERTION`. **[verified]**
- The Champions folder came from contributor PRs whose descriptions give no source ("Add Pokemon Champions sprites", #244, merged 2026-07-25). That they are assets extracted from the game is **[inferred]**: each front file is a 512 × 512 animated WebP of up to 125 frames.
- The README invites copying: "If you want to use all the sprites in your application, you can just download the entire contents directly." **[verified]** No attribution is required (CC0). **[verified]**

### Size

| Folder | Files | Total | Typical file |
|---|---|---|---|
| `champions/` front (animated WebP, 512 × 512) | 452 | 778 MB | median 1.55 MB, up to 18 MB |
| `champions/icons/` (PNG, 128 × 128) | 452 | 6.0 MB | avg 13.6 KB |
| `other/home/` (PNG, 512 × 512) for the 360 mapped IDs | 360 | 45 MB | avg 128 KB |

The whole repo is about 27 GB (GitHub `size` 27,575,485 KB). Only the files needed would be copied. **[verified]** A small Sprite would mean resizing the icons or HOME renders at build time. Re-encoding as WebP is possible; the resulting size wasn't measured. **[unverified]**

### Upkeep and publishing

- Published as a git repo (`git clone`, `npm install github:PokeAPI/sprites`, Bower), and served from `raw.githubusercontent.com`. There is no versioned npm release. **[verified]**
- Champions folder history: #244 normal sprites 2026-07-25, #267 shiny 2026-09-06, **#277 "Add Regulation M-C Champions Sprites" 2026-09-10, one day after M-C started**, and #294 "Champions … final one :) till gen 10" 2026-10-15 (which added the icons). `other/home/10309.png` (Garchomp-Mega-Z) has been there since 2026-04-24 (#217). **[verified]**

## 4. HOME-style renders

- **Showdown `home-centered/`**: 192 × 192 PNG, 342 of 382. It is missing all 40 Megas new to Champions. That fits HOME not storing Megas **[inferred; unverified that this is the reason]**.
- **PokeAPI `other/home/`**: 512 × 512 PNG, which covers the new Megas (§3). It is labelled "home" but includes Megas that Pokémon HOME doesn't show, so some of these renders come from elsewhere. **[inferred]** Their source isn't stated. **[unverified]**
- **Pokémon HOME itself**: no download or licence. [pokemon.com Terms of Use](https://www.pokemon.com/us/legal/terms-of-use) allow site content "for personal, noncommercial home use only", forbid derivative works and "Download quantities of content to a database for any reason", and say "our policy is to decline use of our trademarks and copyrights". **[verified]**

## 5. Other sources with an open licence

- **PMD SpriteCollab** ([PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab)): fan-made Mystery Dungeon-style sprites and portraits, under **CC BY-NC 4.0** with a contributor credit list. Its tracker has entries for the new Champions Megas (Garchomp `Mega_Z`, Chimecho `Mega`, Baxcalibur `Mega`), mostly as portraits marked incomplete, and rarely as sprites. **[verified]** (`tracker.json`). Non-commercial conflicts with the paid hosted service (ADR 1), and it draws TPC's characters anyway. **[inferred]**
- No source was found that licenses Pokémon character art for commercial reuse. **[verified for the sources above; a wider search is unverified]**

## 6. Facts that bear on DEV-170

- **Same IP, different wrappers.** Showdown, PokeAPI and HOME renders are all TPC art. PokeAPI states it outright, and Smogon says so for everything but the community Gen 5-style sprites. Those community sprites add a second rights-holder who asks to be contacted first. The map's legal stance (fan-use tolerance plus a disclaimer, `docs/risks.md` amended) applies equally to all of them. **[inferred]**
- **Coverage.** Only PokeAPI's Champions icons and HOME folder cover every real Champions entry. Showdown's best static set (`gen5`) lacks 11 Megas, and `@pkmn/img` would hand out 404 URLs for them. **[verified]**
- **IDs.** Showdown's file names follow from the Showdown IDs MyVGC already stores (ADR 14), with no table. PokeAPI needs a ~392-row table that MyVGC maintains as new forms arrive. **[verified]**
- **Size.** Showdown `gen5` for all of Champions is about 0.6 MB, small enough to precache offline (DEV-46). PokeAPI icons are about 6 MB at 128 px before resizing. **[verified]**
- **Upkeep.** PokeAPI added M-C's Champions sprites a day after M-C started, and has had the Megas' renders since April. Showdown added `gen5` Z Megas on M-C's first day, but has left 11 Megas without a static Sprite for months. **[verified]**
- **The phantom formes.** Whichever source is chosen, a Sprite table built from `packages/core`'s species list will include 10 battle-only formes that aren't in Champions (§1). **[verified]**

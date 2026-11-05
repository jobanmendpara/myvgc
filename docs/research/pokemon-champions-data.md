# Pokémon Champions: game status, team model, teamsheets and data sources

Researched 2026-11-03 for MyVGC.

## How this was researched (read first)

This session's network policy blocked direct fetches of `pokemon.com`, `play.pokemon.com`, `pokeapi.co`, `smogon.com`, `pokemonshowdown.com` and Bulbapedia. The only primary sources read in full were:

- **Pokémon Showdown server source**, `smogon/pokemon-showdown` at commit `035c1a1f` (2026-11-02), cloned from GitHub.
- **Pokémon Showdown client source**, `smogon/pokemon-showdown-client` at commit `02c67685` (2026-10-29).
- **PokeAPI's CSV data and license**, read from `raw.githubusercontent.com/PokeAPI/pokeapi/master`.
- **npm registry metadata** for `pokemon-showdown`, `@pkmn/*` and `@smogon/calc`.

Claims about official Play! Pokémon documents come **only from web-search snippets** of those documents, or from secondary coverage. They are marked **[snippet]** or **[secondary]**. Anything that could not be checked at all is marked **[unverified]**. Before building on any official-document claim, someone should open the handbook PDF and read it.

## Summary

- **Game status.** Pokémon Champions came out on Nintendo Switch and Switch 2 on 2026-04-08, and on iOS and Android on 2026-06-17. It replaced Scarlet/Violet as the VGC game for the 2026 season. The regulations so far are M-A (Apr–Jun), M-B (Jun–Sep, used at Worlds 2026) and M-C (2026-09-09 to 2026-12-02, current today). [secondary/snippet]
- **Team building.** Champions does **not** use EVs or IVs. It uses **Stat Points (SP)**: 66 in total, at most 32 per stat. IVs are effectively fixed at 31. Natures still exist, and the community calls them "Stat Alignment". **There is no Terastallization.** Mega Evolution is in, including new "Z" Megas from M-C on. Levels are fixed at 50. Showdown's code confirms all of the mechanics in this list.
- **Teamsheets.** The 2026 VGC Handbook says the season uses **open team lists**. Opponents see everything except stats; a handbook update reportedly added nature (Stat Alignment) to the open list. Lists can be submitted through RK9 Labs' Team List Creator, or as in-game Replica Team IDs. [snippet] The official fillable team list PDF was checked on 2026-11-05: see `vg-team-list-pdf.md`.
- **Showdown.** Showdown fully supports Champions. It has `champions` and `championsregmb` mods, and the formats `[Gen 9 Champions] VGC 2026 Reg M-C` (Bo1 and Bo3) and Reg M-B, among others. The paste format is unchanged: the `EVs:` line holds **SP values (0–32)**, and the `Tera Type:` line is dropped. A paste therefore can't be read correctly without knowing its format.
- **Data sources.** Showdown's data files cover Champions species, moves, items, abilities, learnsets and legality (MIT). The same data comes repackaged in `@pkmn/dex` plus `@pkmn/mods` (MIT). PokeAPI has a `champions` version group, a Pokédex and learnsets (BSD-3-Clause, plus a fair-use policy). All Pokémon names and data are Nintendo/Creatures/GAME FREAK/TPC IP.

---

## 1. Game status

| Claim | Source | Status |
|---|---|---|
| Released on Nintendo Switch on 2026-04-08; also playable on Switch 2 | [Nintendo UK listing](https://nintendo.com/en-gb/Games/Nintendo-Switch-download-software/Pokemon-Champions-2762534.html), [RPG Site](https://www.rpgsite.net/news/19954-pokemon-champions-releases-on-april-8-for-nintendo-switch-and-switch-2), [Game Informer](https://gameinformer.com/2026/03/24/pokemon-champions-launches-on-switch-switch-2-next-month-starter-bundle-revealed) | secondary/snippet |
| Released on iOS/Android on 2026-06-17, free-to-play, with cross-save via Nintendo Account and Pokémon HOME support | [Shacknews](https://www.shacknews.com/article/149689/pokemon-champions-launches-on-mobile), [Gematsu](https://gematsu.com/2026/06/pokemon-champions-for-ios-android-launches-june-17), [pocketmonsters.net](https://pocketmonsters.net/news/9306) | secondary |
| Champions became the official VGC game for the 2026 season, replacing Scarlet/Violet; the VGC Tournament Handbook was revised in late March 2026 for the change | [VGC Tournament Handbook PDF](https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-vgc-tournament-handbook-en.pdf) (search snippet: "During the 2026 Pokémon Championship Series season, the official competitive title for VGC will…"), [Bulbagarden](https://bulbagarden.net/threads/pokemon-champions-axes-local-communication-options-new-information-released-in-vgc-handbook.310263/) | snippet/secondary |
| Regulation sets now last 1–3 months; a new format may be announced as little as 30 days before its first legal event | [Bulbagarden on the handbook update](https://bulbagarden.net/threads/pokemon-champions-axes-local-communication-options-new-information-released-in-vgc-handbook.310263/) | secondary |
| Regulation M-A: 2026-04-08 to about 2026-06-17, Megas allowed. Sources disagree on whether it ended on 16 or 17 June | [Bulbagarden](https://bulbagarden.net/threads/pokemon-champions-launches-new-ruleset-for-competitive-vgc-regulation-set-m-a-runs-until-june-17th-2026.310333/), [Victory Road](https://victoryroad.pro/champions-regulations/) | secondary |
| Regulation M-B: 2026-06-17 to 2026-09-02 (or until M-C began). It was the format of the 2026 World Championships, held 28–30 August, which Takuma Yamazaki won | [pokemon.com Worlds 2026 VGC Masters](https://www.pokemon.com/us/play-pokemon/worlds/2026/vgc-masters) (snippet), [Bulbagarden Worlds results](https://bulbagarden.net/threads/2026-pokemon-vgc-world-championships-results-and-teams-takuma-yamazaki-is-your-2026-world-champion.311448/) | snippet/secondary |
| Regulation M-C: 2026-09-09 02:00 UTC to 2026-12-02 01:59 UTC. Adds Rillaboom and Baxcalibur, plus Mega Absol Z, Mega Lucario Z and Mega Garchomp Z. Reports of how many Pokémon it adds conflict (24 or 26) | [TPC Asia press release, 2026-08-30](https://asia-press.portal-pokemon.com/press-release/pokemon-champions_20260830/) (snippet), [Rotom Labs](https://rotomlabs.net/article/baxcalibur-golisopod-salamence-megas-champions-m-c) | snippet/secondary |
| Battle format: doubles, bring 6 and pick 4, level 50, Species Clause, Item Clause; Mythical and Restricted Legendary Pokémon banned | Showdown `flatrules` in [`data/mods/champions/rulesets.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/mods/champions/rulesets.ts); [Victory Road](https://victoryroad.pro/champions-regulations/) | verified (Showdown) / secondary |
| Local wireless play was removed as an option at events | [Bulbagarden](https://bulbagarden.net/threads/pokemon-champions-axes-local-communication-options-new-information-released-in-vgc-handbook.310263/) | secondary |

**Unverified:** the format or schedule after M-C (after 2026-12-02), and the Worlds 2027 format.

**Implication for MyVGC.** Regulations change every 1–3 months, so each tournament and team should record the regulation it belongs to (`M-A`, `M-B`, `M-C`, …) rather than just "VGC 2026".

## 2. How Pokémon are built in Champions

All of the following is verified in Showdown's source unless marked otherwise. Showdown models what the game does; it is not an official spec.

- **Stat Points replace EVs.**
  - A Pokémon has 66 SP in total (`this.evLimit = 66` for any `champions*` mod in [`sim/dex-formats.ts`](https://github.com/smogon/pokemon-showdown/blob/master/sim/dex-formats.ts)).
  - Each stat takes at most 32 SP (`"has more than 32 Stat Points"` in [`sim/team-validator.ts`](https://github.com/smogon/pokemon-showdown/blob/master/sim/team-validator.ts) `validateStats`).
  - Showdown stores SP in the same `evs` field as EVs. [`sim/teams.ts`](https://github.com/smogon/pokemon-showdown/blob/master/sim/teams.ts) says the field is "Also used to store AVs for Let's Go and Stat Points for Champions".
  - Secondary sources agree on 66 and 32: [Bulbapedia "Stat point"](https://bulbapedia.bulbagarden.net/wiki/Stat_point) [snippet], [champdex](https://champdex.com/guides/stat-points).
- **Stat formula at level 50.** From [`data/mods/champions/scripts.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/mods/champions/scripts.ts) `statModify`:
  - HP = base + SP + 75
  - Every other stat = (base + SP + 20) × nature modifier (1.1 or 0.9, with 16-bit truncation)
  - In the mainline formula this equals 31 IVs, 1 SP ≈ 8 EVs, and the first point ≈ 4 EVs. The client computes `ev *= 8` ([`battle-team-editor.tsx`](https://github.com/smogon/pokemon-showdown-client/blob/master/play.pokemonshowdown.com/src/battle-team-editor.tsx)).
- **IVs are gone.** The validator rejects any IV other than 31: "this format requires all IVs to be 31". The client hides the IV column and the IV-spread picker.
- **Natures stay, under a new name.** Nature still applies. The game and community call it **Stat Alignment** ([Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Stat_point) [snippet], [Victory Road on X](https://x.com/VGCVictoryRoad/status/2057501550038183953) [snippet]). The level-up and transfer rules (EV-to-SP conversion when moving from HOME) are described only by secondary sources and were not checked.
- **No Terastallization.**
  - `canTerastallize` returns `null` in the Champions mod.
  - The validator deletes `teraType` for Champions (`sim/team-validator.ts`, the `!dex.currentMod.startsWith('champions')` check).
  - The exporter leaves out `Tera Type:` when `useStatPoints` is set.
- **Mega Evolution is in**, including the "Z" Megas added in M-C. Mega Stones such as `abomasite`, `absolitez` and `aerodactylite` are marked legal in [`data/mods/champions/items.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/mods/champions/items.ts).
- **Other mechanics.**
  - Levels are fixed at 50 (`Adjust Level = 50`). The client greys out the level field.
  - Abilities and held items work as in the mainline games, apart from item and ability changes inside the mod's `items.ts` and `abilities.ts`.
  - Most moves are capped at 20 PP; the mod caps PP at 20 when it loads.
  - The battle shows HP to the opponent as a whole-number percentage.
- **Size of the legal pool.** The `champions` mod's `formats-data.ts` lists 349 species and forms that are not marked Past/Future/Illegal, Megas included. That count was computed from the source here and is approximate. It is the M-C pool; `championsregmb` holds M-B's.

**What this means for how MyVGC stores a team (inference):**

- Store per Pokémon: species/form, ability, held item, 1–4 moves, nature (Stat Alignment), and six SP values (0–32 each, at most 66 in total).
- Don't store IVs, Tera type, EVs or level; level is always 50.
- Gender and shiny are cosmetic.
- Tag every team with its game and regulation. A Scarlet/Violet VGC team uses EVs, IVs and Tera, so the stat fields mean different things for the two games.

## 3. Official teamsheet format

- **Open team lists are used.** The VGC Tournament Handbook says: "The 2026 Pokémon VGC season will utilize an open team list format". Competitors must give "a legible and accurate list of the Pokémon that comprise their team before the deadline communicated by the Tournament Organizer". The list is the "source of truth", and a mismatch with the in-game team can bring penalties. [snippet] [Handbook PDF](https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-vgc-tournament-handbook-en.pdf) (also at [mcdn.pokemon.com](https://mcdn.pokemon.com/pokemon-prod/raw/upload/v1/live/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-vgc-tournament-handbook-en.pdf)).
- **What the opponent sees.** The opponent sees the team list "except for the Pokémon's stats" [snippet, same PDF]. A later handbook update, according to Victory Road, made **nature (Stat Alignment) standard on open team lists** in TPCi events ([Victory Road on X](https://x.com/VGCVictoryRoad/status/2057501550038183953)) [snippet]. An earlier Bulbagarden write-up said nature was hidden ([Bulbagarden](https://bulbagarden.net/threads/pokemon-champions-axes-local-communication-options-new-information-released-in-vgc-handbook.310263/)).
  - The likely current rule: the opponent sees species, ability, item, moves and Stat Alignment. Stat Point spreads stay with staff only, which amounts to a "closed" list ([Breloom Club](https://breloom.club/vgc-what-to-expect/) [secondary]).
  - Showdown's Open Team Sheets for Champions agree with this. They show species, item, ability, moves, **nature** and gender, but no EVs/SP or IVs (`showOpenTeamSheets` in [`sim/battle.ts`](https://github.com/smogon/pokemon-showdown/blob/master/sim/battle.ts)).
- **How lists are submitted.** Organizers may use **RK9 Labs' Team List Creator**. Judges may ask players to share Battle Teams through Champions' **Replica Teams** feature and give the **Team ID** [snippet, Handbook PDF]. MyVGC should therefore store an optional Replica **Team ID** for each team.
- **Fields on the sheet.**
  - Per Pokémon, from the snippets: species (with form or regional variant), ability, held item, moves, and Stat Alignment ([Victory Road](https://victoryroad.pro/champions-regulations/) [secondary]). Tera type would no longer apply.
  - Player header fields: confirmed for Champions on 2026-11-05. See `vg-team-list-pdf.md`.
  - Level: not needed, since everything is auto-leveled to 50 [snippet].
- **Official fillable PDF: verified 2026-11-05.** The [Play! Pokémon documents page (VGC filter)](https://play.pokemon.com/en-us/resources/documents/?filter=vgc) links "Pokémon Video Game Team List" to `play-pokemon-vg-team-list-2023.pdf`, which has been updated for Champions. It is a fillable AcroForm that pdf-lib can fill, but its fields are named `f0` to `f150`, so MyVGC keeps its own field map. Details, the field map and the open questions for export are in `vg-team-list-pdf.md`.
  - Because RK9 appears to be the main channel, MyVGC may still want an RK9-friendly export alongside the filled PDF.

Also worth reading once access is available: the [Play! Pokémon VG Rules, Formats & Penalty Guidelines PDF](https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-vg-rules-formats-and-penalty-guidelines-en.pdf) [not read].

## 4. Showdown support

- **Formats.** Showdown supports Champions natively. Its formats, from [`config/formats.ts`](https://github.com/smogon/pokemon-showdown/blob/master/config/formats.ts) in the "Champions" section:
  - VGC formats:
    - `[Gen 9 Champions] VGC 2026 Reg M-C`: Flat Rules, VGC Timer, Open Team Sheets
    - `[Gen 9 Champions] VGC 2026 Reg M-C (Bo3)`: Force Open Team Sheets, Best of 3
    - `… Reg M-B` and `… Reg M-B (Bo3)`, which use the `championsregmb` mod and are hidden from search
  - Other formats: BSS Reg M-C and M-B, OU, UU, Doubles, Random Battle, Random Doubles, Draft, 4v4 Doubles Draft, NatDex Draft, Mega Evolution Battle, Custom Game, and 4v4 Doubles UU.
  - Format IDs follow the usual pattern, for example `gen9championsvgc2026regmc`. Pikalytics uses the same IDs, for example [`gen9championsvgc2026regma`](https://www.pikalytics.com/pokedex/gen9championsvgc2026regma).
- **The paste format is unchanged, but its stat fields mean something else.**
  - Both exporters ([server `sim/teams.ts` `exportSet`](https://github.com/smogon/pokemon-showdown/blob/master/sim/teams.ts), [client `battle-teams.ts`](https://github.com/smogon/pokemon-showdown-client/blob/master/play.pokemonshowdown.com/src/battle-teams.ts)) still write the spread on a line labelled **`EVs:`**. In Champions formats the numbers are **Stat Points** (0–32, total of at most 66), for example `EVs: 32 HP / 2 Atk / 32 Spe`.
  - The client teambuilder labels the column "Points", steps by 1 and caps at 32 and 66.
  - The `Tera Type:` line is omitted (`if (set.teraType && !useStatPoints)`).
  - The `IVs:` line never appears, because all IVs are 31.
  - The parser still accepts only `EVs:`; there is no `SPs:` keyword.
- **Paste parsing rule for MyVGC.** To read `EVs:` correctly, the app has to know the format.
  - A Champions paste has small values, every one 32 or less, adding up to 66 or less.
  - A Scarlet/Violet paste has values up to 252, adding up to 510.
  - Values alone are a weak signal (a Scarlet/Violet set with `EVs: 4 HP` also fits the SP rule). Store the game and format explicitly instead of guessing.
- **Community standard: [secondary].** Third-party Champions tools advertise Showdown import and export, for example [Pikalytics team builder](https://pikalytics.com/team/championstournaments), [PokeTools](https://www.poketools.com/champions-team-builder) and [crob.at teams](https://crob.at/teams/vgc). No official statement names it the standard. Champions' own in-game sharing uses Replica Team IDs instead.
- **Format reference.** The format is documented in [`sim/TEAMS.md`](https://github.com/smogon/pokemon-showdown/blob/master/sim/TEAMS.md). It describes three formats: export (human-readable), JSON, and packed.

## 5. Pokémon data sources

| Source | Champions coverage | License / terms |
|---|---|---|
| **Pokémon Showdown data files** ([repo](https://github.com/smogon/pokemon-showdown)): base `data/pokedex.ts`, `moves.ts`, `items.ts`, `abilities.ts`, `learnsets.ts`, overlaid by `data/mods/champions/*` and `data/mods/championsregmb/*` | Species and forms, Megas, legality (`isNonstandard` plus tiers in `formats-data.ts`), Champions-specific items, moves, abilities and learnsets, and format rules. Updated continuously; the last commit seen was 2026-11-02 | [MIT](https://github.com/smogon/pokemon-showdown/blob/master/LICENSE) ("Copyright (c) 2011-2026 Guangcong Luo and other contributors") |
| **npm `pokemon-showdown`** 0.11.11 | The same data plus the simulator and validator. MyVGC could use it to validate a team against `gen9championsvgc2026regmc` | MIT ([npm](https://www.npmjs.com/package/pokemon-showdown)) |
| **`@pkmn/dex` + `@pkmn/mods`** 0.10.13 ([pkmn/ps](https://github.com/pkmn/ps)) | `@pkmn/mods` ships `champions` and `championsregmb` builds (seen in the package tarball: `build/champions/index.js`), and the README describes them as "the data and logic for Pokémon Champions". Last published 2026-11-03. Also `@pkmn/data` (learnsets and legality helpers) and `@pkmn/sets` (paste parsing) | MIT |
| **`@smogon/calc`** 0.12.0 | Damage calculator. **[unverified]** whether it supports Champions SP | MIT |
| **PokeAPI** ([repo](https://github.com/PokeAPI/pokeapi)) | Has version group `32,champions` and version `49 champions` in `data/v2/csv/version_groups.csv` and `versions.csv`, Pokédex `36 champions`, and 19,810 `pokemon_moves` rows covering 319 Pokémon entries. Mega, legality and per-regulation coverage was not checked. It lags Showdown and has no notion of formats or regulations | Code and data: BSD-3-Clause ([LICENSE.md](https://github.com/PokeAPI/pokeapi/blob/master/LICENSE.md), which also notes "Pokémon and Pokémon character names are trademarks of Nintendo"). API: a fair-use policy; rate limits were removed after the move to static hosting, and users are asked to cache ([PokeAPI docs](https://pokeapi.co/docsv2/)) [snippet] |
| Community: [otterlyclueless/pokemon-champions-data](https://github.com/otterlyclueless/pokemon-champions-data) | Champions stat data [secondary] | **[unverified]**; its license could not be checked |
| Usage stats: [Pikalytics](https://www.pikalytics.com/), [Pokémon Zone](https://pokemon-zone.com/champions/regulations/), [Victory Road](https://victoryroad.pro/champions-regulations/) | Usage, top teams, regulation summaries | No open license found; treat as all rights reserved **[unverified]** |

**IP note.** Pokémon names, sprites and game data are the intellectual property of Nintendo, Creatures Inc., GAME FREAK and The Pokémon Company. The MIT and BSD licenses cover the code and how these projects compiled the data, not those underlying rights. Fan tools generally rely on fan-use tolerance. MyVGC is AGPL and has paid hosting (see `docs/adr/0001-agpl-open-source-with-paid-hosting.md`), so it should avoid bundling official artwork, and should get legal review before charging money for anything near TPC IP. **[unverified: no official TPC fan-content policy was read.]**

**Recommendation (inference).** Use Showdown's data, through `@pkmn/dex` + `@pkmn/mods` or `pokemon-showdown`, as the source of truth for Champions legality and validation. Pin the version for each regulation. Use PokeAPI only for extra data such as flavour text and localized names.

## Open items to verify once `pokemon.com` / `play.pokemon.com` are reachable

1. The current VGC Tournament Handbook, section on team lists: the exact open and closed fields, whether Stat Alignment is on the open list, and the RK9 and Replica Team rules.
2. Resolved 2026-11-05 in `vg-team-list-pdf.md`: the official team list PDF, its URL, and its fields, including the header fields.
3. PokeAPI fair-use wording on [pokeapi.co/docs/v2](https://pokeapi.co/docs/v2).
4. The format after M-C (after 2026-12-02).

# Champions-accurate Pokédex details: sources, changes and sizes

Researched 2026-11-27 for DEV-262 (part of the map DEV-261). Question: what details can MyVGC show for each species, move, item and ability, and the type chart, so that they are right for Pokémon Champions, and from which source?

## How this was researched

- **The data MyVGC already loads.** `@pkmn/dex@0.10.13` and `@pkmn/mods@0.10.13` (pinned in `packages/core/package.json`), read in `node_modules` with scratch scripts. Each mod's raw entries were read before `Dex.mod()` merged them, so we could see which fields Champions overrides. The scripts were then compared with `Dex.forGen(9)` (Scarlet/Violet).
- **Showdown's repo upstream.** `smogon/pokemon-showdown` `master`, read through `gh api` on 2026-11-27: `data/mods/champions/*`, `data/abilities.ts`, `data/conditions.ts`, `data/pokedex.ts`, `data/typechart.ts`, `sim/pokemon.ts` and `LICENSE`.
- **Serebii's Champions Attackdex.** The Protect and Iron Head pages, to check the PP formula and one changed move against the game.
- **Bulbapedia's licence.** The MediaWiki `siteinfo` API, because article pages returned 403.
- **PokeAPI's CSVs** in `PokeAPI/pokeapi` `master`, `data/v2/csv`.
- **Sizes.** Measured by building the JSON from `championsNames()` and the Dex in this repo, with Node's `zlib` (gzip level 9, plus Brotli).

Labels: **[code]** means checked in package or repo code. **[site]** means read on the site. **[inference]** means my reading of the facts, not a fact.

## Summary

- **One source still covers everything: Showdown's data through `@pkmn`, with three corrections MyVGC must make itself.**
  1. **PP.** Show Champions' PP as `(min(pp, 20) / 5 + 1) × 4`, not the stored `pp`.
  2. **Height.** `@pkmn/dex` drops height. Weight is kept, and weight is what Low Kick, Grass Knot, Heavy Slam and Heat Crash need.
  3. **Stale descriptions.** A handful of `desc`/`shortDesc` texts are stale for Champions, listed below.
- **Descriptions.** The Champions mod rewrites `desc`/`shortDesc` only where the change shows up in the text: 12 moves, 1 item, 2 abilities. Numeric changes (power, accuracy, PP, type, target, flags) live in their own fields, which the mod overrides correctly. Behaviour changes made only in code, with no new text, leave these descriptions stale: Milk Drink, Run Away, Anger Shell/Berserk (long `desc`), Curse, Disable, Encore and No Retreat.
- **Other sources.**
  - Serebii has a Champions Attackdex that matches Showdown, but it is © Serebii.net with no reuse licence.
  - Bulbapedia is CC BY-NC-SA 2.5. That licence is **non-commercial** and share-alike, so its text clashes with MyVGC's paid hosting.
  - PokeAPI (BSD-3) has Champions learnsets, but no Champions move changes or move or item text, and text for only 11 abilities.
  - The game's own text is TPC's, with no API.
- **Species.**
  - Base stats, types, abilities (slots 0/1/H) and weight come from Showdown's base Pokédex. The Champions mod has **no Pokédex override**.
  - **Learnsets are Champions-specific** in `@pkmn/mods/champions` (263 entries, every move tagged `9M`), with a one-entry M-B override (Archaludon). Every one of the 382 species and forms resolves to one through its base species.
- **Type chart.** Identical to Scarlet/Violet's (0 differences across all types). It lives in Showdown's `data/typechart.ts`, and the Champions mod has no type chart of its own. The data still includes Stellar, which Champions doesn't use because it has no Tera.
- **Size** (gzip). `/api/names` today is **29.3 KB**. Adding descriptions costs:
  - **+17.4 KB** for `shortDesc` only
  - **+33.8 KB** for `desc` only
  - **+44.2 KB** for both

  Learnsets on their own cost **+25.8 KB**. The other move fields (category, PP, priority, target, contact) cost **+3.8 KB**.

## 1. Moves, items and abilities: descriptions

### What Showdown gives, and how the Champions mod changes it

`@pkmn/dex` ships Showdown's `desc` (long) and `shortDesc` text for every entry. Every in-Champions move, item and ability has a `shortDesc` [code]. The Champions mod (`data/mods/champions/{moves,items,abilities}.ts` upstream, `@pkmn/mods/champions` here) overrides an entry with `inherit: true` plus the fields that change. It adds new text only when someone wrote it. The rest of this section groups the pinned 0.10.13 overrides of in-Champions entries [code].

**Changes the stored fields carry correctly.** The description is still right, or the number lives in its own field:

| Change | Entries (Scarlet/Violet → Champions) |
|---|---|
| Power | Apple Acid 80→90, Beak Blast 100→120, Bone Rush 25→30, Fire Lash 80→90, First Impression 90→100, Grav Apple 80→90, Infernal Parade 60→65, Meteor Assault 150→170, Mountain Gale 100→120, Night Daze 85→90, Psyshield Bash 70→90, Slash 70→80, Snipe Shot 80→85, Spirit Shackle 80→90, Trop Kick 70→85 |
| Accuracy | Clangorous Soul 100→never misses, Crabhammer 90→95, Syrup Bomb 85→90, Make It Rain 100→95 |
| Stored PP | Baneful Bunker, King's Shield, Protect, Sandstorm, Snowscape, Spiky Shield, Strength Sap, Wish 10→5; Beak Blast 15→5; Night Slash 15→20. In M-B, Strength Sap's and Wish's PP are overridden again in `championsregmb` |
| Type | Growth Normal→Grass, Snap Trap Grass→Steel |
| Flags | Crush Claw, Dire Claw, Dragon Claw, Shadow Claw gain `slicing` (Sharpness); Double Shock gains `punch` (Iron Fist); Dragon Cheer gains `sound`; Howl gains `bypasssub` |

**Changes with rewritten text** (`shortDesc` and/or `desc` overridden, so the text is accurate):

- **Moves**
  - Dire Claw: 50%→30% status chance.
  - Freeze-Dry: loses its 10% freeze.
  - Iron Head: 30%→20% flinch.
  - Moonblast: 30%→10% Sp. Atk drop.
  - Make It Rain: −1→−2 Sp. Atk.
  - Toxic Thread: −1→−2 Speed.
  - Salt Cure: 1/8→1/16, or 1/4→1/8 on Steel and Water.
  - Rage Fist.
  - Belch and Stuff Cheeks.
  - Fake Out and First Impression: "cannot be selected" after the first turn, rather than failing. Only the long `desc` is overridden.
- **Items**: Slowbronite.
- **Abilities**
  - Healer: 30%→50%.
  - Unseen Fist: now deals 1/4 damage through protection.
- **Pinned 0.10.13 only.** Covet, Knock Off, Switcheroo, Thief and Trick have `desc` overrides about Mega Stones. They are gone from upstream `master`, which added Champions National Dex on 2026-11-25.

**Stale for Champions** (code changed, text inherited from Scarlet/Violet) [code, comparing the mod's functions with upstream `data/abilities.ts`]:

| Entry | What Champions does | What the inherited text says |
|---|---|---|
| Milk Drink | Target is `adjacentAllyOrSelf`: it can heal an ally | "Heals the user by 50% of its max HP." |
| Run Away | Can't be trapped (`onTrapPokemon` clears `trapped`) | "No competitive use." |
| Anger Shell, Berserk | Triggers even when Sheer Force removed the secondary effect (the `suppressingSecondaries()` check is dropped) | The long `desc` says Sheer Force prevents it; `shortDesc` is fine |
| Curse (Ghost) | Aimed at an ally, it redirects to a random foe | Long `desc` doesn't say so |
| Disable, Encore, No Retreat | Edge-case condition changes (Disable ignores `cantusetwice` moves; No Retreat fails if already trapped) | Unchanged; `shortDesc` still broadly right |
| Last Resort | Upstream (2026-11-15, not in 0.10.13): can't be selected until usable | Unchanged |

The following changes don't affect any description [code]:

- **Disclosure or edge cases.** Regenerator and Natural Cure now announce themselves. Emergency Exit, Wimp Out and Eject Button get edge-case switching fixes.
- **Status conditions.** Paralysis stops a move 1 time in 8, against 1 in 4 in Scarlet/Violet (`conditions.ts` `randomChance(1, 4)`). Sleep's turn counter starts at 2 or 3 (`sample([2, 3, 3])`, so 3 two times in three), against 2 to 4 in Scarlet/Violet (`random(2, 5)`). Freeze thaws 1 time in 4, and always by its 3rd turn, against 1 in 5 with no limit. Move texts only say "paralyze" or "freeze", so they stay true. A glossary or help page about status conditions would need Champions' numbers.

**Entries new to Champions.** These carry `isNonstandard: "Future"` in Scarlet/Violet, and the mod lifts the mark. Their Showdown text is Champions text already:

- 7 abilities: Aura Guard, Dragonize, Eelevate, Fire Mane, Mega Sol, Piercing Drill, Spicy Spray.
- The Mega Stones, including the Z stones.
- Moves Showdown marked Past or Unobtainable in Scarlet/Violet: Burn Up, Corrosive Gas, Electrify, Light of Ruin, Octolock, Power Shift, Storm Throw, Trick-or-Treat.

**[inference]** Showdown's text is accurate for Champions on everything except the short stale list above. That list is small enough to patch in `packages/core` with a test per entry, or to report upstream. When the pin is bumped, re-run the override diff (raw mod keys against `Dex.forGen(9)`), because upstream keeps changing the mod: 15 commits between 2026-10-02 and 2026-11-25.

### Other sources and their terms

| Source | Champions coverage | Licence / terms |
|---|---|---|
| Showdown data via `@pkmn/dex` + `@pkmn/mods` | Everything above, kept current by Showdown's maintainers | MIT, "Copyright (c) 2011-2026 Guangcong Luo and other contributors" (upstream `LICENSE`); `@pkmn/*` `package.json` says MIT [code]. Keep the notice; text is Smogon/Showdown's own writing |
| Serebii [Champions Attackdex](https://www.serebii.net/attackdex-champions/protect.shtml) | Per-move Champions pages. Protect shows **8 PP**, Iron Head **16 PP** and "20% chance of making the target flinch", matching Showdown [site] | "All Content is © Copyright of Serebii.net 1999-2026" with no reuse licence [site]. Fine to check against, not to copy |
| Bulbapedia | Wiki articles; not read (403) | CC BY-NC-SA 2.5 (`siteinfo` `rightsinfo`) [site]. **NonCommercial** conflicts with MyVGC's paid hosting (ADR 1) [inference] |
| PokeAPI CSVs | Version group `32,champions`; 19,810 `pokemon_moves` rows for it; `ability_flavor_text` has 11 rows for it (the new abilities, including Japanese); **0** rows in `move_flavor_text`, `item_flavor_text` and `move_changelog` for it [code] | BSD-3-Clause (see `pokemon-champions-data.md`). Its flavour text is the games' own text |
| The game's own text | Authoritative, but no official API or dump | © Nintendo/Creatures/GAME FREAK/TPC |

## 2. Moves' other fields

- **Category, priority, target, contact.**
  - These come from base Showdown data unless the mod overrides them.
  - No Champions override changes category or priority.
  - The only target change is Milk Drink, which goes `self`→`adjacentAllyOrSelf`.
  - The only `contact` changes would be flag edits, and none of the flag edits above touch `contact`.
  - Spread or single is the `target` field: `allAdjacentFoes`/`allAdjacent` are spread moves, and `normal`/`any` are single-target. In-Champions moves use 15 distinct `target` values [code].
- **PP: the stored `pp` field is not what the game shows** [code + site].
  - The mod's `Scripts.init()` caps every move's PP at 20. `@pkmn/dex`'s `Dex.mod()` doesn't run `init`, so Tackle still reads 35 there. 34 in-Champions moves have stored PP above 20.
  - The mod's `calculatePP(move)` returns `move.noPPBoosts ? move.pp : (move.pp / 5 + 1) * 4`. `sim/pokemon.ts` uses it for `maxpp`.
  - So the game's PP is 5→8, 10→12, 15→16 and 20→20. Serebii shows Protect 8 and Iron Head 16, which confirms it.
  - MyVGC must compute this itself, in `packages/core`, from `min(pp, 20)`.
- **Power and accuracy.** These are already served in `/api/names` (`powerAndAccuracy`), from the modded Dex, so they include the changes above.

## 3. Species

- **Base stats, types, abilities.**
  - No `pokedex.ts` exists in `data/mods/champions` (upstream listing) or in `@pkmn/mods/champions`'s exports, so Champions species data is Showdown's base Gen 9 Pokédex [code].
  - `/api/names` already serves base stats, types and abilities per species and form (`champions.ts`).
  - `species.abilities` has slots `0`, `1` and `H` (hidden), for example Incineroar `{0: Blaze, H: Intimidate}`. Megas have one ability, for example Garchomp-Mega-Z `{0: Levitate}`.
  - New Champions Megas, such as Garchomp-Mega-Z with 108/130/85/141/85/151, are in base data marked `Future` and become legal through the mod's `formats-data` [code].
- **Weight and height.**
  - `@pkmn/dex` species carry `weightkg` and `weighthg` (Incineroar 83 / 830), but **no `heightm`**. `@pkmn/dex` strips it: the key is absent from the built bundle [code].
  - Showdown's `data/pokedex.ts` does have it (`heightm: 1.8, weightkg: 83` for Incineroar).
  - Low Kick, Grass Knot, Heavy Slam and Heat Crash use weight only, so height is cosmetic. Showing it would mean extracting it from `pokemon-showdown` or PokeAPI at build time [inference].
- **Learnsets: yes, Champions-specific.**
  - `@pkmn/mods/champions` exports `Learnsets` with 263 entries. Every source tag is `9M`, so Champions has no level-up, egg or tutor split, only "can learn" [code].
  - `championsregmb` overrides only Archaludon's.
  - Forms and Megas without their own entry use the base species' entry, which `modLearnsets` in `champions.ts` and `legality.ts` already does. All 382 species and forms in the names list resolve this way, to 257 distinct move lists, and every move in them is in the names list [code].
  - PokeAPI has a second, independent copy (19,810 rows, version group 32).

## 4. Type chart

- Champions' type chart is the same as Scarlet/Violet's. Comparing `damageTaken` for every type in `Dex.mod('champions')` with `Dex.forGen(9)` finds **0 differences** [code]. The Champions mod exports no `TypeChart` (its exports are Abilities, Conditions, Formats, FormatsData, Items, Learnsets, Moves, Rulesets and Scripts), so it inherits.
- Showdown keeps the chart in [`data/typechart.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/typechart.ts). In `@pkmn/dex` it is `dex.types.get(id).damageTaken`, with codes 0 normal, 1 weak, 2 resists and 3 immune.
- The list includes **Stellar**, which Champions doesn't use because it has no Tera. MyVGC's 18 `TypeId`s already leave it out.
- It is small and fixed, so it could be hard-coded in `packages/core` next to `pokemon-type.ts`, with a test against the Dex [inference].

## 5. Size added to the web app's download

Built from `championsNames()` (the `/api/names` payload) and the Champions Dex, for the 382 species and forms, 515 moves, 166 items and 317 abilities in the names list. All sizes are JSON.

| Payload | Raw | gzip -9 | Brotli |
|---|---|---|---|
| `/api/names` today | 110.7 KB | **29.3 KB** | 22.7 KB |
| `shortDesc` for moves, items and abilities | 68.9 KB | **17.4 KB** | 15.4 KB |
| `desc` only (long, falling back to short) | 170.8 KB | **33.8 KB** | 27.2 KB |
| `shortDesc` + `desc` | 229.5 KB | **44.2 KB** | 33.9 KB |
| Learnsets, move-ID arrays keyed per species and form | 265.7 KB | **25.8 KB** | 19.2 KB |
| Move fields: category, PP, priority, target, contact | 17.3 KB | **3.8 KB** | 3.5 KB |

**[inference]**

- `shortDesc` plus the move fields would take `/api/names` from about 29 KB to about 50 KB gzipped.
- Learnsets would add about 26 KB more. They would shrink if forms that share a learnset referenced their base species (257 distinct lists for 382 keys), or if they were fetched only for the species a page shows.
- The long `desc` texts are the costliest and could be loaded on demand per entry from the API rather than in the cached list.

## Sources

- `node_modules/@pkmn/dex@0.10.13`, `node_modules/@pkmn/mods@0.10.13` (`build/champions`, `build/championsregmb`), via `packages/core/src/champions.ts`.
- Showdown, `smogon/pokemon-showdown` `master` on 2026-11-27:
  - [`data/mods/champions/`](https://github.com/smogon/pokemon-showdown/tree/master/data/mods/champions): `moves.ts`, `abilities.ts`, `items.ts`, `conditions.ts`, `scripts.ts`, `learnsets.ts`; latest commit `b3131aec` (2026-11-25)
  - [`data/abilities.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/abilities.ts)
  - [`data/conditions.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/conditions.ts)
  - [`data/pokedex.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/pokedex.ts)
  - [`data/typechart.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/typechart.ts)
  - [`sim/pokemon.ts`](https://github.com/smogon/pokemon-showdown/blob/master/sim/pokemon.ts) (`calculatePP` for `maxpp`)
  - [`LICENSE`](https://github.com/smogon/pokemon-showdown/blob/master/LICENSE)
- Serebii: [Protect](https://www.serebii.net/attackdex-champions/protect.shtml), [Iron Head](https://www.serebii.net/attackdex-champions/ironhead.shtml).
- Bulbapedia `api.php?action=query&meta=siteinfo&siprop=rightsinfo`: "Attribution-NonCommercial-ShareAlike 2.5".
- PokeAPI [`data/v2/csv`](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv): `version_groups.csv`, `pokemon_moves.csv`, `move_flavor_text.csv`, `item_flavor_text.csv`, `ability_flavor_text.csv`, `move_changelog.csv`.
- Earlier notes: `docs/research/pokemon-champions-data.md` (data sources and licences).

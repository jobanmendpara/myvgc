# Pokédex details for Pokémon Champions: which source is right, and what it costs to download

Researched 2026-11-27 for MyVGC (DEV-262, part of the map DEV-261: a Pokédex tab, detail tooltips and Search by Pokémon).

## How this was researched (read first)

Primary sources read in full:

- **The installed packages**: `@pkmn/dex` 0.10.13 and `@pkmn/mods` 0.10.13 (`@pkmn/mods/champions`, `@pkmn/mods/championsregmb`), as pinned in `packages/core/package.json`. Every entry in them was walked with scripts; MyVGC's own `championsNames()` (`packages/core/src/champions.ts`) was called for the sizes.
- **Pokémon Showdown server source**, `smogon/pokemon-showdown` `master` as of 2026-11-27 (last commit under `data/mods/champions`: `b3131aec`, 2026-11-25): `data/mods/champions/{moves,abilities,items,conditions,scripts,learnsets}.ts`, `data/text/{moves,abilities,items}.ts`, `data/{moves,abilities,items,typechart,pokedex}.ts`.
- **PokeAPI's CSV data** (`PokeAPI/pokeapi` `master`, `data/v2/csv`).

Secondary sources, used only to cross-check Showdown against the game: Serebii's Champions pages ([Updated Attacks](https://www.serebii.net/pokemonchampions/updatedattacks.shtml), [New Abilities](https://www.serebii.net/pokemonchampions/newabilities.shtml), [Status Conditions](https://www.serebii.net/pokemonchampions/statusconditions.shtml)) and search snippets of Bulbapedia (Bulbapedia itself returned 403 to this session). They are marked **[secondary]**. Nothing official from The Pokémon Company lists move, item or ability data; the game's own text was not read.

Line numbers below are from the files as fetched on 2026-11-27.

## Summary

- **Descriptions.** Showdown's `desc` and `shortDesc`, through the `Dex.mod('champions', …)` MyVGC already builds, **are** Champions-aware: Showdown keeps a `champions:` override in `data/text/*.ts`, and `@pkmn/mods/champions` merges it in. 17 moves, 2 abilities and 1 item carry Champions text. But Showdown changes behaviour in another **~15 entries without changing their text**, so those descriptions are stale for Champions (Run Away, Anger Shell, Berserk, Emergency Exit, Wimp Out, Sheer Force, Eject Button, Milk Drink, Encore, Disable, No Retreat, Curse, Last Resort). No better source is reusable: Bulbapedia is CC BY-NC-SA 2.5 (non-commercial clashes with paid hosting, ADR 1), Serebii is all rights reserved, PokeAPI has no Champions move or item text, and the game's text is Nintendo/TPC copyright. **Recommendation: use Showdown's text (MIT) and keep a small MyVGC override table for the stale entries.**
- **Moves' other fields.** Category, priority, target and contact are in `@pkmn/dex` and correct for Champions, with the mod's changes applied (Milk Drink's target, five moves gaining the slicing flag, Double Shock becoming a punch, and so on). **PP is not**: the data holds the pre-Champions base PP, and the game shows `(min(pp, 20) / 5 + 1) × 4`, a rule that lives in the mod's scripts, which `@pkmn/dex` doesn't run. MyVGC must apply that formula itself (Protect: data 5, game 8).
- **Species.** Base stats, abilities (slots `0`, `1`, `H`) and weight (`weightkg`) are in `@pkmn/dex` and right for Champions, Megas included. **Height is not** (`@pkmn/dex` strips `heightm`; it is in Showdown's `data/pokedex.ts`), but no battle mechanic uses height. Champions-specific learnsets exist (`@pkmn/mods/champions` `Learnsets`, 258 species; forms and Megas use their base species'), with one learn method only (`9M`), so a Pokédex can say "learns" but never "how".
- **Type chart.** Identical to Scarlet and Violet's: the Champions mod has no `typechart.ts`, and all 19 types' `damageTaken` in `Dex.mod('champions')` equal `Dex.forGen(9)`'s. Showdown keeps it in [`data/typechart.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/typechart.ts). Freeze-Dry's special case against Water is a move effect, not part of the chart.
- **Size** (gzip level 9, the Champions set MyVGC already sends): `/api/names` today is **29.3 KB**. Adding every `shortDesc` adds **17.4 KB**; every long `desc` adds **33.8 KB**; the moves' other fields **3.8 KB**; weights **2.7 KB**. Learnsets on their own are **22.3 KB** (move IDs) or **14.4 KB** (moves as indexes into the names list). Everything together: **106.6 KB**.

---

## 1. Move, item and ability descriptions

### 1.1 Where Showdown keeps Champions text

Showdown's descriptions live in `data/text/moves.ts`, `abilities.ts` and `items.ts`. An entry can carry per-generation and per-mod overrides; Champions' are under a `champions:` key, for example [`data/text/moves.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/text/moves.ts) line 3436:

```ts
ironhead: {
  name: "Iron Head",
  desc: "Has a 30% chance to make the target flinch.",
  shortDesc: "30% chance to make the target flinch.",
  champions: {
    desc: "Has a 20% chance to make the target flinch.",
    shortDesc: "20% chance to make the target flinch.",
  },
},
```

`@pkmn/mods/champions` ships those overrides already merged into its `Moves`, `Abilities` and `Items` tables (for example `Moves.ironhead` has `desc` and `shortDesc` set beside `secondary: {chance: 20}`), so `Dex.mod('champions', championsMod).moves.get('ironhead').shortDesc` returns the 20% text. MyVGC's `modDexes.champions` (`packages/core/src/champions.ts`) is exactly that object, so the Champions text is already one property away. Every Champions move (515), item (166) and ability (317 in the names list) has a non-empty `shortDesc`, and every move a non-empty `desc` (checked by script).

The pinned 0.10.13 build has the same `champions:` text as Showdown `master` today: 17 moves, 2 abilities, 1 item (counted with `grep champions` in each text file).

### 1.2 Entries whose Champions text Showdown has

| Kind | Entry | Champions change in the text |
|---|---|---|
| Move | Iron Head | Flinch chance 30% → 20% |
| Move | Moonblast | Sp. Atk drop chance 30% → 10% |
| Move | Dire Claw | Status chance 50% → 30% |
| Move | Make It Rain | User's Sp. Atk drop 1 → 2 stages |
| Move | Toxic Thread | Speed drop 1 → 2 stages |
| Move | Salt Cure | 1/8 (1/4 Steel/Water) → 1/16 (1/8) per turn |
| Move | Rage Fist | Counter resets when the user leaves the field |
| Move | Freeze-Dry | No 10% freeze chance |
| Move | Fake Out, First Impression | "Cannot be selected" unless it is the first turn, instead of "fails" |
| Move | Belch, Stuff Cheeks | "Fails unless" instead of "cannot be selected until" |
| Move | Knock Off, Covet, Thief, Trick, Switcheroo | Exceptions now say "a Mega Stone held by the species that can Mega Evolve with it" instead of the Scarlet/Violet list of orbs, plates and masks |
| Ability | Healer | Cure chance 30% → 50% |
| Ability | Unseen Fist | Contact moves through protection deal 1/4 damage |
| Item | Slowbronite | Not usable by Galarian Slowbro |

Sources: [`data/text/moves.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/text/moves.ts) lines 440, 1187, 1412, 1960, 2108, 2346, 3440, 3527, 3876, 4342, 5150, 5549, 6543, 6723, 6957 (plus Toxic Thread and Trick); [`data/text/abilities.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/text/abilities.ts) lines 663, 2176; [`data/text/items.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/text/items.ts) line 1854. Serebii's Updated Attacks page agrees on every move change it lists [secondary].

The new Champions abilities (Piercing Drill, Dragonize, Eelevate, Mega Sol, Fire Mane, Spicy Spray, Aura Guard) have Champions-correct text because they exist only in Champions; their Showdown text matches Serebii's in-game quotes in substance [secondary].

### 1.3 Entries whose behaviour Showdown changes but whose text it doesn't

These are entries the Champions mod overrides with code (`data/mods/champions/*.ts`) without a `champions:` text override, read against the base implementation and base text. Where the change is visible to a player, the Showdown `desc` is **wrong for Champions**:

| Entry | Champions behaviour (from the mod's code) | What the base text says | Stale? |
|---|---|---|---|
| **Run Away** (ability) | `onTrapPokemon` / `onMaybeTrapPokemon` set `trapped = false`: the holder can switch out of any trapping (mod `abilities.ts`) | "No competitive use." | Yes |
| **Anger Shell**, **Berserk** | `onDamage` drops the `!this.suppressingSecondaries()` check: Sheer Force no longer stops them (base `data/abilities.ts` line 143 vs mod) | "This effect is prevented if the move had a secondary effect removed by the Sheer Force Ability." | Yes (Berserk is on a Champions species; Anger Shell isn't today) |
| **Emergency Exit**, **Wimp Out** | No longer clears every other Pokémon's `switchFlag`, so the attacker's U-turn or Volt Switch still switches it out (base line 1250 vs mod) | Mentions Sheer Force preventing it; says nothing of the U-turn case | Yes, the Sheer Force sentence (`scripts.ts`: "Sheer Force doesn't suppress AfterMoveSecondary events: Berserk, Pickpocket, Emergency Exit, Eject Button, etc.") |
| **Sheer Force** | Same script comment: it no longer prevents Anger Shell, Berserk, Emergency Exit, Pickpocket, Wimp Out, Eject Button and the rest | "…prevents the target's Anger Shell, Berserk, … Eject Button, Kee Berry, and Maranga Berry from activating" (`data/text/abilities.ts` line 1645) | Yes |
| **Eject Button** (item) | No longer cancels the attacker's own switch (`source.switchFlag = false` removed; base `data/items.ts` line 1692 vs mod) | "If holder survives a hit, it immediately switches out" | Partly (short text still true) |
| **Milk Drink** | `target: "adjacentAllyOrSelf"`: can heal an ally (Serebii: "can target an ally, ignoring Protect" [secondary]) | "Heals the user by 50% of its max HP." | Yes |
| **Encore** | The target's action this turn is changed to the encored move at once (`this.queue.changeAction`) | "For its next 3 turns, the target is forced to repeat its last move" | Partly |
| **Disable** | Doesn't stop moves with the `cantusetwice` flag | Generic | Minor |
| **No Retreat** | Fails to stack if the user is already trapped (commit `d12b9c1e`, 2026-10-16) | "Fails if the user has already been prevented from switching by this effect." | Minor |
| **Curse** (Ghost) | Aimed at an ally, it picks a random foe instead | Generic | Minor |
| **Last Resort** | Can't be selected until its condition is met (commit `41ba4797`, 2026-11-15, **after** the pinned 0.10.13) | "This move fails unless…" | Yes, and not in the pinned data yet |
| Natural Cure, Regenerator | Only how the battle log reveals them | — | No |

Changes that no move, item or ability text covers at all, but a Pokédex or Types page might want to state (from `data/mods/champions/conditions.ts`, confirmed by Serebii's Status Conditions page [secondary]):

- **Paralysis**: 1 in 8 chance to be fully paralysed (`randomChance(1, 8)`), down from 1 in 4.
- **Sleep**: lasts 2 or 3 turns (`sample([2, 3, 3])`), so it always ends by the third turn.
- **Freeze**: 25% thaw chance each turn (`randomChance(1, 4)`), and always thaws after 3 turns.

Changes to numbers (power, accuracy, PP, type, flags) don't make the text stale, because Showdown's descriptions don't repeat those fields: Growth's text doesn't name its type, Slash's doesn't give its power. They are covered under section 2.

### 1.4 Other sources for descriptions

| Source | Champions text? | Licence / terms | Usable by MyVGC? |
|---|---|---|---|
| **Showdown `data/text`**, through `@pkmn/mods` | Yes for the entries in 1.2; base text otherwise | [MIT](https://github.com/smogon/pokemon-showdown/blob/master/LICENSE), "Copyright (c) 2011-2026 Guangcong Luo and other contributors". `@pkmn/dex` and `@pkmn/mods` are MIT too (`package.json` `"license": "MIT"`). MIT asks only that the copyright notice travel with the software | Yes. MyVGC already depends on it (ADR 12) |
| **Bulbapedia** | Has Champions pages (for example [Protect](https://bulbapedia.bulbagarden.net/wiki/Protect_(move)) lists Champions' 8 PP) [secondary] | Text under **CC BY-NC-SA 2.5** since 2007-04-15; articles taken from Wikipedia are GFDL ([Bulbapedia:Copyrights](https://bulbapedia.bulbagarden.net/wiki/Bulbapedia:Copyrights), [About](https://bulbapedia.bulbagarden.net/wiki/Bulbapedia:About)) [secondary: snippets; the page returned 403] | Not for bundling: NonCommercial conflicts with MyVGC's paid hosting (ADR 1), and ShareAlike would bind the text to a CC licence. Fine to cite or link |
| **Serebii** | Yes, with in-game descriptions ([Attackdex](https://www.serebii.net/attackdex-champions/), [Updated Attacks](https://www.serebii.net/pokemonchampions/updatedattacks.shtml)) | "All Content is © Copyright of Serebii.net 1999-2026" (site footer); no reuse licence | No. Cross-checking only |
| **PokeAPI** | No: `version_groups.csv` has `32,champions`, but `move_flavor_text.csv` and `item_flavor_text.csv` have **0** rows for it, `ability_flavor_text.csv` has 7 (English), and `move_changelog.csv` has none | Code and data BSD-3-Clause ([LICENSE.md](https://github.com/PokeAPI/pokeapi/blob/master/LICENSE.md)) | No Champions text to use |
| **The game's own text** | Yes, by definition | © Nintendo / Creatures / GAME FREAK / The Pokémon Company; no public data API and no licence. Datamined text would be copying their copyrighted prose | No |

**Recommendation (inference).** Show Showdown's Champions `shortDesc` in tooltips and `desc` on Pokédex pages, credit "Descriptions from Pokémon Showdown (MIT)" on an About or credits page, and keep a short MyVGC-written override table in `packages/core` for the stale rows in 1.3 (Run Away, Anger Shell, Berserk, Emergency Exit, Wimp Out, Sheer Force, Milk Drink at least). Re-check that table whenever `@pkmn/mods` is bumped, since Showdown may add `champions:` text for them; a unit test that fails when an overridden entry gains Showdown Champions text would catch it.

## 2. Moves' other fields

All read from `Dex.mod('champions', championsMod)`, which applies the mod's data changes (`inherit: true` entries in `data/mods/champions/moves.ts`):

| Field | In `@pkmn/dex`? | Champions changes | Right for Champions? |
|---|---|---|---|
| Category (`category`) | Yes | None in the mod | Yes |
| Priority (`priority`) | Yes; 39 Champions moves have non-zero priority | None in the mod | Yes |
| Target (`target`) | Yes: `normal`, `allAdjacentFoes` (spread on foes), `allAdjacent` (spread on everyone), `adjacentAlly`, `adjacentAllyOrSelf`, `self`, `allySide`, `foeSide`, `all`, `any`, `randomNormal`, `allies`, `allyTeam`, `scripted` | Milk Drink → `adjacentAllyOrSelf` | Yes |
| Contact (`flags.contact`) and other flags | Yes | Slicing added to Crush Claw, Dragon Claw, Shadow Claw, Dire Claw (and Metal Claw, which isn't in Champions); Double Shock becomes a punch; Dragon Cheer and Howl become sound moves | Yes |
| Power, accuracy, type | Yes (MyVGC already sends power and accuracy) | 38 moves differ from `Dex.forGen(9)` on a shown field, for example Growth's type Normal → Grass, Snap Trap's Grass → Steel, Make It Rain 95% accuracy, Meteor Assault 170 power | Yes |
| **PP** (`pp`) | Yes, but **not as the game shows it** | The mod's `init()` caps every move's PP at 20, and `calculatePP()` returns `(move.pp / 5 + 1) * 4` ([`data/mods/champions/scripts.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/mods/champions/scripts.ts) lines 5 and 41). `@pkmn/dex` doesn't run scripts, so `pp` is the raw value: 34 Champions moves still show more than 20 | **No, without a formula** |

So the in-game PP is `(min(pp, 20) / 5 + 1) × 4`: 5 → 8, 10 → 12, 15 → 16, 20 or more → 20; moves with `noPPBoosts` (Revival Blessing, Struggle) keep their raw value. This matches the game: Bulbapedia gives Protect, King's Shield, Spiky Shield and Baneful Bunker 8 PP, Serebii's Protect entry says 8, and Serebii's Updated Attacks lists Iron Head 15 → 16 and Bone Rush 10 → 12 [secondary]. Wish and Strength Sap differ by Regulation: data PP 5 (game 8) in the `champions` mod (M-C) but 10 (game 12) in `championsregmb` (M-B), matching reports of patch 1.2.0 cutting them to 8 [secondary: [The Click](https://www.theclick.gg/?p=38344), [Serebii news](https://serebii.net/news/2026/09-September-2026.shtml)].

The "spread or single" question maps onto `target`: `allAdjacentFoes` and `allAdjacent` are spread moves, which the mod's `modifyDamage` reduces by 0.75 in doubles, as in Scarlet and Violet.

## 3. Species

| Detail | Source | Right for Champions? |
|---|---|---|
| Base stats | `species.baseStats` in `@pkmn/dex` (already in `/api/names` as `baseStats`) | Yes; the new Megas have their own (Garchomp-Mega-Z: 108/130/85/141/85/151) |
| Abilities, with hidden | `species.abilities` with slots `0`, `1`, `H` (Incineroar: `{"0":"Blaze","H":"Intimidate"}`); `/api/names` already sends them flattened as `abilitiesBySpecies`, which loses which slot is hidden | Yes |
| Weight | `species.weightkg` (and `weighthg`) in `@pkmn/dex` | Yes; enough for Low Kick, Grass Knot, Heavy Slam and Heat Crash, which are all in Champions |
| Height | **Not in `@pkmn/dex`** (its build has no `heightm`); in Showdown's [`data/pokedex.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/pokedex.ts) (`heightm: 0.7` for Bulbasaur) and in PokeAPI | Not needed for any battle mechanic; display only |
| Learnsets | `@pkmn/mods/champions` `Learnsets` ([`data/mods/champions/learnsets.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/mods/champions/learnsets.ts)); `championsregmb` holds only the learnsets M-B changes. MyVGC already reads them (`modLearnsets` in `champions.ts`) | Yes, Champions-specific |

About the learnsets:

- 258 of the 382 species and forms in the names list have their own learnset. The rest are Megas and other forms, which have no learnset of their own and take their base species' (they carry `changesFrom` or `baseSpecies`).
- Every one of the 15,764 learnset entries has the single source `9M`. Champions has no level-up, egg or tutor distinction in Showdown's data, so a Pokédex can show "moves it can learn", not how or at what level.
- PokeAPI's `pokemon_moves` has Champions rows too (19,810 for 319 Pokémon, per `pokemon-champions-data.md`), but lags Showdown and knows nothing of Regulations.

## 4. Type chart

- Champions' type chart is the same as Scarlet and Violet's. `data/mods/champions/` has no `typechart.ts` (the folder holds `abilities`, `conditions`, `formats-data`, `items`, `learnsets`, `moves`, `rulesets`, `scripts`), so the mod inherits gen 9's. Checked by script: for all 19 types (the 18 plus Stellar), `damageTaken` in `Dex.mod('champions')` equals `Dex.forGen(9)`'s.
- Showdown keeps it in [`data/typechart.ts`](https://github.com/smogon/pokemon-showdown/blob/master/data/typechart.ts) as each type's `damageTaken`: for every attacking type, `0` normal, `1` super effective, `2` resisted, `3` immune. `@pkmn/dex` exposes it as `dex.types.get(id).damageTaken` and `dex.getEffectiveness(source, target)`.
- Stellar is a Tera type; Champions has no Tera, so the Types page should show only the 18 MyVGC already hard-codes in `@myvgc/core/schema`.
- The chart is tiny (18 × 18 small numbers, well under 1 KB gzipped), so it can be hard-coded in `@myvgc/core/schema` beside the type names, with a unit test against `@pkmn/dex` so a future Champions change shows up.

## 5. Size

Measured on 2026-11-27 from the installed packages: JSON built from MyVGC's `championsNames()` and `modDexes.champions` for the same IDs the names list holds (382 species and forms, 515 moves, 166 items, 317 abilities), then `gzipSync(json, { level: 9 })`. KB are 1,024 bytes.

| Payload | Raw | Gzipped |
|---|---:|---:|
| **`/api/names` today** | 110.7 KB | **29.3 KB** |
| `shortDesc`, moves only | 27.9 KB | 7.8 KB |
| `shortDesc`, items only | 13.4 KB | 2.8 KB |
| `shortDesc`, abilities only | 27.7 KB | 7.6 KB |
| `shortDesc`, all three | 69.0 KB | **17.4 KB** |
| `shortDesc`, only the 216 abilities a Champions species has | — | 5.6 KB |
| `desc`, all three | 170.9 KB | **33.8 KB** |
| Names + `shortDesc` | 179.8 KB | 45.7 KB |
| Names + `desc` | 281.6 KB | 62.8 KB |
| Names + `shortDesc` + `desc` | 350.6 KB | 78.6 KB |
| Moves' category, game PP, priority, target, contact | 17.3 KB | 3.8 KB |
| Species weights | 6.4 KB | 2.7 KB |
| **Learnsets**, move IDs per species | 180.0 KB | **22.3 KB** |
| Learnsets, moves as indexes into the names list | 62.9 KB | 14.4 KB |
| Learnsets as the mod ships them (with `["9M"]` sources) | 291.1 KB | 25.8 KB |
| Everything above together | 554.3 KB | **106.6 KB** |

Notes:

- The names list measures 29.3 KB here against ADR 17's "about 31 KB"; the difference is the gzip level (9 here) and what the server's compression picks.
- The names list holds all 317 abilities, but only 216 are on a Champions species. Trimming the ability tables to those would save a little on every list, descriptions included.
- For comparison, the whole of `@myvgc/core`'s Showdown data is about 900 KB gzipped (CLAUDE.md), so even "everything" is under an eighth of it.

The measuring script, run from `apps/api` with `npx tsx` (it imports `modDexes` and `modLearnsets` from `packages/core/src/champions.ts`, which `@myvgc/core`'s index doesn't export):

```ts
import { gzipSync } from 'node:zlib'
import { championsNames } from '@myvgc/core'
import { modDexes, modLearnsets } from '../../packages/core/src/champions.ts'

const dex = modDexes.champions
const names = championsNames()
const gz = (o: unknown) => gzipSync(JSON.stringify(o), { level: 9 }).length / 1024
const pick = <T>(t: Record<string, string>, get: (id: string) => T) =>
  Object.fromEntries(Object.keys(t).map((id) => [id, get(id)]))

const shortDesc = {
  moves: pick(names.moves, (id) => dex.moves.get(id).shortDesc),
  items: pick(names.items, (id) => dex.items.get(id).shortDesc),
  abilities: pick(names.abilities, (id) => dex.abilities.get(id).shortDesc),
}
const learnsets = Object.fromEntries(
  Object.keys(names.species)
    .filter((id) => modLearnsets.champions[0][id]?.learnset)
    .map((id) => [id, Object.keys(modLearnsets.champions[0][id].learnset!)]),
)
console.log({ names: gz(names), shortDesc: gz(shortDesc), learnsets: gz(learnsets) })
```

## Open risks

1. **Stale text needs MyVGC's own words.** The rows in 1.3 have no reusable correct source; MyVGC would write them, and they can drift when Showdown or the game changes.
2. **The pinned packages lag Showdown.** `@pkmn/mods` 0.10.13 (published 2026-11-03) misses at least the Last Resort change of 2026-11-15. Text and data follow whatever version ADR 12 pins.
3. **Showdown models the game; it isn't official.** Where Showdown hasn't noticed a change, neither will MyVGC. Serebii's lists matched Showdown on every move checked here, but no official changelog exists to check against.
4. **PP is derived.** Showing `pp` straight from `@pkmn/dex` would be wrong for almost every move; the formula has to sit in `packages/core` and be tested.
5. **Bulbapedia's licence** was read only from search snippets (its pages returned 403); that doesn't change the conclusion, since no plan here bundles its text.
6. **IP.** As in `pokemon-champions-data.md`: MIT covers Showdown's compilation and wording, not The Pokémon Company's rights in names and game data.

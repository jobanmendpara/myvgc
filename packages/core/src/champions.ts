// A reference, not an import: the API and web app typecheck this file and need the declaration too.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./pkmn-mods.d.ts" />
import { Dex, type ID, type ModData } from '@pkmn/dex'
import * as championsMod from '@pkmn/mods/champions'
import * as championsRegMbMod from '@pkmn/mods/championsregmb'
import type { ChampionsMod } from './calendar'
import type { ChampionsNames, Named, NamesTable } from './names-list'

// Showdown's Champions data, pinned through exact versions of @pkmn/dex and @pkmn/mods (ADR 12).
const dex = Dex.mod('champions' as ID, championsMod as unknown as ModData)

/** The data for each mod, latest Regulation first. Legality reads a Regulation's own. */
export const modDexes: Record<ChampionsMod, typeof dex> = {
  champions: dex,
  championsregmb: Dex.mod('championsregmb' as ID, championsRegMbMod as unknown as ModData),
}
const allDexes = Object.values(modDexes)

interface DexEntry {
  id: string
  name: string
  exists: boolean
  isNonstandard?: string | null
}

// Showdown keeps data for every game in the mod and marks what isn't in Champions as
// non-standard ("Past", "Future", "CAP", ...). Only entries without that mark are in the game.
// This says nothing about legality in a Regulation, which `legality.ts` judges (ADR 18).
function inChampions(entry: DexEntry): Named | undefined {
  if (!entry.exists || entry.isNonstandard) return undefined
  return { id: entry.id, name: entry.name }
}

/** The first mod that has the entry, so a name from any Regulation counts as in Champions. */
function inAnyMod(lookUp: (modDex: typeof dex) => DexEntry): Named | undefined {
  for (const modDex of allDexes) {
    const named = inChampions(lookUp(modDex))
    if (named) return named
  }
  return undefined
}

/**
 * Look-ups by name or ID, across every Regulation (ADR 18). Like Showdown, they ignore case and
 * punctuation (`rotom wash`, `Rotom-Wash` and `rotomwash` are the same) and follow Showdown's
 * aliases.
 */
export const champions = {
  species: (name: string) => inAnyMod((modDex) => modDex.species.get(name)),
  item: (name: string) => inAnyMod((modDex) => modDex.items.get(name)),
  ability: (name: string) => inAnyMod((modDex) => modDex.abilities.get(name)),
  move: (name: string) => inAnyMod((modDex) => modDex.moves.get(name)),
  nature: (name: string): Named | undefined => {
    const nature = dex.natures.get(name)
    return nature.exists ? { id: nature.id, name: nature.name } : undefined
  },
}

export type ChampionsKind = keyof typeof champions

// Each kind with its article, for messages like "is not an item in Pokémon Champions".
const KIND_NOUNS: Record<ChampionsKind, string> = {
  species: 'a Pokémon',
  item: 'an item',
  ability: 'an ability',
  move: 'a move',
  nature: 'a Stat Alignment',
}

/** The message for a name the Champions data doesn't recognize. */
export function unknownName(kind: ChampionsKind, name: string): string {
  return `"${name}" is not ${KIND_NOUNS[kind]} in Pokémon Champions.`
}

/** The display name for a stored ID, falling back to the ID if the data doesn't have it. */
export function displayName(kind: ChampionsKind, id: string): string {
  return champions[kind](id)?.name ?? id
}

function table(entries: (modDex: typeof dex) => readonly DexEntry[]): NamesTable {
  const names: NamesTable = {}
  for (const modDex of allDexes) {
    for (const entry of entries(modDex)) {
      const named = inChampions(entry)
      if (named) names[named.id] ??= named.name
    }
  }
  return names
}

let names: ChampionsNames | undefined

function abilitiesBySpecies(): Record<string, string[]> {
  const abilities: Record<string, string[]> = {}
  for (const species of allDexes.flatMap((modDex) => modDex.species.all())) {
    if (!inChampions(species) || abilities[species.id]) continue
    const own = Object.values(species.abilities).map((ability) => champions.ability(ability)?.id)
    abilities[species.id] = [...new Set(own.filter((id) => id !== undefined))]
  }
  return abilities
}

/**
 * The names list for pickers: every species and form, move, item and ability in any Regulation,
 * keyed by Showdown ID, and each species' or form's own abilities. About 52 KB of JSON, 17 KB
 * gzipped, against about 900 KB for the full data. Built once, on first use.
 */
export function championsNames(): ChampionsNames {
  names ??= {
    species: table((modDex) => modDex.species.all()),
    moves: table((modDex) => modDex.moves.all()),
    items: table((modDex) => modDex.items.all()),
    abilities: table((modDex) => modDex.abilities.all()),
    abilitiesBySpecies: abilitiesBySpecies(),
  }
  return names
}

// A reference, not an import: the API and web app typecheck this file and need the declaration too.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./pkmn-mods.d.ts" />
import { Dex, type ID, type ModData } from '@pkmn/dex'
import * as championsMod from '@pkmn/mods/champions'
import type { ChampionsNames, Named, NamesTable } from './names-list'

// Showdown's Champions data, pinned through exact versions of @pkmn/dex and @pkmn/mods (ADR 12).
const dex = Dex.mod('champions' as ID, championsMod as unknown as ModData)

interface DexEntry {
  id: string
  name: string
  exists: boolean
  isNonstandard?: string | null
}

// Showdown keeps data for every game in the mod and marks what isn't in Champions as
// non-standard ("Past", "Future", "CAP", ...). Only entries without that mark are in the game.
// This says nothing about legality in a Regulation, which isn't checked (ADR 10).
function inChampions(entry: DexEntry): Named | undefined {
  if (!entry.exists || entry.isNonstandard) return undefined
  return { id: entry.id, name: entry.name }
}

/**
 * Look-ups by name or ID. Like Showdown, they ignore case and punctuation
 * (`rotom wash`, `Rotom-Wash` and `rotomwash` are the same) and follow Showdown's aliases.
 */
export const champions = {
  species: (name: string) => inChampions(dex.species.get(name)),
  item: (name: string) => inChampions(dex.items.get(name)),
  ability: (name: string) => inChampions(dex.abilities.get(name)),
  move: (name: string) => inChampions(dex.moves.get(name)),
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

function table(entries: readonly DexEntry[]): NamesTable {
  const names: NamesTable = {}
  for (const entry of entries) {
    const named = inChampions(entry)
    if (named) names[named.id] = named.name
  }
  return names
}

let names: ChampionsNames | undefined

/**
 * The names list for pickers: every species and form, move, item and ability in Champions,
 * keyed by Showdown ID. About 36 KB of JSON, 13 KB gzipped, against about 900 KB for the full
 * data. Built once, on first use.
 */
export function championsNames(): ChampionsNames {
  names ??= {
    species: table(dex.species.all()),
    moves: table(dex.moves.all()),
    items: table(dex.items.all()),
    abilities: table(dex.abilities.all()),
  }
  return names
}

// A reference, not an import: the API and web app typecheck this file and need the declaration too.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./pkmn-mods.d.ts" />
import { Dex, type ID, type ModData } from '@pkmn/dex'
import * as championsMod from '@pkmn/mods/champions'

// Showdown's Champions data, pinned through exact versions of @pkmn/dex and @pkmn/mods (ADR 12).
const dex = Dex.mod('champions' as ID, championsMod as unknown as ModData)

/** A name the Champions data recognises: its Showdown ID and display name. */
export interface Named {
  id: string
  name: string
}

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

/** The display name for a stored ID, falling back to the ID if the data doesn't have it. */
export function displayName(kind: ChampionsKind, id: string): string {
  return champions[kind](id)?.name ?? id
}

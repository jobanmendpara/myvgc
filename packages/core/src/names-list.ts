// The names list for pickers: display names for every Champions species, move, item and
// ability, keyed by Showdown ID (ADR 14, ADR 17). This module holds only the shape and the
// search, so the web app can use it through `@myvgc/core/schema`; the list itself is built
// from Showdown's data in `champions.ts` and served by the API.
import type { PokemonBuild } from './build'
import { STAT_ALIGNMENTS } from './stat-alignment'
import type { BaseStats } from './stat-values'
import type { NamedPokemonBuild } from './team'

/** A name the Champions data recognises: its Showdown ID and display name. */
export interface Named {
  id: string
  name: string
}

export const NAME_KINDS = ['species', 'moves', 'items', 'abilities'] as const
export type NameKind = (typeof NAME_KINDS)[number]

/** Display names keyed by Showdown ID. */
export type NamesTable = Record<string, string>

/**
 * The names list, plus each species' or form's own abilities for the ability picker and its
 * base stats for stat values. Stat Alignments are not in it: there are only 25, hard-coded in
 * `stat-alignment.ts` instead.
 */
export type ChampionsNames = Record<NameKind, NamesTable> & {
  abilitiesBySpecies: Record<string, string[]>
  baseStats: Record<string, BaseStats>
  /** PROTOTYPE (DEV-218) */
  typesBySpecies?: Record<string, string[]>
  /** PROTOTYPE (DEV-218) */
  moveTypes?: Record<string, string>
  /** PROTOTYPE (DEV-218): [power (-1 for a status move), accuracy (0 never misses)] */
  moveStats?: Record<string, [number, number]>
}

/** Folds text the way Showdown builds IDs: lower case, letters and digits only. */
function fold(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

const byName = (a: Named, b: Named) => a.name.localeCompare(b.name)

/**
 * The entries whose name or ID matches the query, ignoring case and punctuation. Names that
 * start with the query come first, then names that only contain it, each in name order. An
 * empty query lists everything in name order.
 */
export function searchNames(table: NamesTable, query: string, limit = Infinity): Named[] {
  const needle = fold(query)
  const starts: Named[] = []
  const contains: Named[] = []
  for (const [id, name] of Object.entries(table)) {
    const folded = fold(name)
    if (folded.startsWith(needle) || id.startsWith(needle)) starts.push({ id, name })
    else if (folded.includes(needle) || id.includes(needle)) contains.push({ id, name })
  }
  return [...starts.sort(byName), ...contains.sort(byName)].slice(0, limit)
}

/**
 * The ability picker's search. With no query it lists only the species' own abilities; with a
 * query those come first, then every other match, because this is a convenience: the Team
 * builder warns about an ability the species can't have (ADR 18). With no species, or none listed
 * for it, it searches every ability.
 */
export function searchAbilities(
  names: Pick<ChampionsNames, 'abilities' | 'abilitiesBySpecies'>,
  species: string | null | undefined,
  query: string,
  limit = Infinity,
): Named[] {
  const own: NamesTable = {}
  for (const id of (species && names.abilitiesBySpecies[species]) || []) {
    const name = names.abilities[id]
    if (name) own[id] = name
  }
  const ownMatches = searchNames(own, query)
  if (!fold(query) && ownMatches.length) return ownMatches.slice(0, limit)
  const others = searchNames(names.abilities, query).filter((entry) => !(entry.id in own))
  return [...ownMatches, ...others].slice(0, limit)
}

/**
 * Adds display names to a Pokémon build from the names list, as the API's `nameBuild` does from
 * the Champions data, so the web app can show a Team it built with no signal before the server
 * has it (ADR 17). A name the list doesn't have shows as its ID.
 */
export function nameBuildFrom(
  build: PokemonBuild,
  names: Pick<ChampionsNames, NameKind> | undefined,
): NamedPokemonBuild {
  const nameOf = (kind: NameKind, id: string) => names?.[kind][id] ?? id
  const nature = build.nature && STAT_ALIGNMENTS.find(({ id }) => id === build.nature)
  return {
    ...build,
    names: {
      species: nameOf('species', build.species),
      ...(build.item ? { item: nameOf('items', build.item) } : {}),
      ...(build.ability ? { ability: nameOf('abilities', build.ability) } : {}),
      ...(build.nature ? { nature: nature ? nature.name : build.nature } : {}),
      moves: build.moves.map((move) => nameOf('moves', move)),
    },
  }
}

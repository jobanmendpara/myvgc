import type { PokemonBuild } from './build'
import { type ChampionsKind, champions, unknownName } from './champions'

/** A problem with one field of the Pokémon builds sent to the API. */
export interface PokemonIssue {
  /** Such as `['pokemon', 2, 'moves', 1]`. */
  path: [string, ...(string | number)[]]
  message: string
}

/**
 * Checks Pokémon builds against the Champions data, the check a paste gets line by line (ADR 14).
 * `teamPokemonSchema` covers everything that needs no data. Only the ID itself passes, not an
 * alias of it, so what is stored stays clean. A name allowed in any Regulation passes: whether it's
 * allowed in this Team's Regulation is only a warning (ADR 18).
 */
export function checkPokemon(pokemon: PokemonBuild[]): PokemonIssue[] {
  const issues: PokemonIssue[] = []
  pokemon.forEach((build, index) => {
    const check = (kind: ChampionsKind, id: string | undefined, ...field: (string | number)[]) => {
      if (id !== undefined && champions[kind](id)?.id !== id) {
        issues.push({ path: ['pokemon', index, ...field], message: unknownName(kind, id) })
      }
    }
    check('species', build.species, 'species')
    check('item', build.item, 'item')
    check('ability', build.ability, 'ability')
    check('nature', build.nature, 'nature')
    build.moves.forEach((move, moveIndex) => check('move', move, 'moves', moveIndex))
  })
  return issues
}

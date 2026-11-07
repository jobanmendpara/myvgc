import type { PokemonBuild } from './build'
import { type ChampionsKind, champions, unknownName } from './champions'
import { GAME_SIDES, type Game } from './round'

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
 * allowed in this Team's Regulation is only a warning (ADR 18). `field` is where the builds were
 * sent, such as `opponentTeam` for an Opponent's Team.
 */
export function checkPokemon(pokemon: PokemonBuild[], field = 'pokemon'): PokemonIssue[] {
  const issues: PokemonIssue[] = []
  pokemon.forEach((build, index) => {
    const check = (kind: ChampionsKind, id: string | undefined, ...at: (string | number)[]) => {
      if (id !== undefined && champions[kind](id)?.id !== id) {
        issues.push({ path: [field, index, ...at], message: unknownName(kind, id) })
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

/**
 * Checks that every Pokémon in some Games is a Champions species, as `checkPokemon` does for
 * builds. Whether it was on that side's Team is never checked (ADR 21).
 */
export function checkGames(games: Game[]): PokemonIssue[] {
  const issues: PokemonIssue[] = []
  games.forEach((game, index) => {
    for (const side of GAME_SIDES) {
      for (const field of [side.brought, side.leads]) {
        game[field].forEach((species, position) => {
          if (champions.species(species)?.id !== species)
            issues.push({
              path: ['games', index, field, position],
              message: unknownName('species', species),
            })
        })
      }
    }
  })
  return issues
}

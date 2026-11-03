import type { PokemonBuild } from './build'
import { displayName } from './champions'
import type { NamedPokemonBuild } from './team'

/** Adds display names to a Pokémon build, for clients that don't carry the Champions data. */
export function nameBuild(build: PokemonBuild): NamedPokemonBuild {
  return {
    ...build,
    names: {
      species: displayName('species', build.species),
      ...(build.item ? { item: displayName('item', build.item) } : {}),
      ...(build.ability ? { ability: displayName('ability', build.ability) } : {}),
      ...(build.nature ? { nature: displayName('nature', build.nature) } : {}),
      moves: build.moves.map((move) => displayName('move', move)),
    },
  }
}

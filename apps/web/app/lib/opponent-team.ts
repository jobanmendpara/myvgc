import { MAX_MOVES, type OpponentTeamInput, type PokemonBuild } from '@myvgc/core/schema'

/** One Pokémon of an Opponent's Team while it's being edited: empty fields are null. */
export interface OpponentBuildDraft {
  species: string
  ability: string | null
  item: string | null
  /** Always `MAX_MOVES` slots, so each has its own picker. */
  moves: (string | null)[]
}

/** A Pokémon of an Opponent's Team with only its species known yet. */
export const newOpponentBuild = (species: string): OpponentBuildDraft => ({
  species,
  ability: null,
  item: null,
  moves: Array(MAX_MOVES).fill(null),
})

export const toOpponentBuildDraft = (build: PokemonBuild): OpponentBuildDraft => ({
  species: build.species,
  ability: build.ability ?? null,
  item: build.item ?? null,
  moves: Array.from({ length: MAX_MOVES }, (_, i) => build.moves[i] ?? null),
})

/** An Opponent's Team as the API takes it, with each build's empty move slots left out. */
export const toOpponentTeamInput = (drafts: readonly OpponentBuildDraft[]): OpponentTeamInput =>
  drafts.map((build) => ({
    species: build.species,
    ...(build.ability ? { ability: build.ability } : {}),
    ...(build.item ? { item: build.item } : {}),
    moves: build.moves.filter((move): move is string => Boolean(move)),
  }))

import {
  MAX_MOVES,
  type OpponentTeamInput,
  type PokemonBuild,
  type ReadTeamView,
  losesOpponentAgeDivision,
  losesOpponentTeam,
  opponentTeamFromRead,
} from '@myvgc/core/schema'

/** One Pokémon of an Opponent's Team while it's being edited: empty fields are null. */
export interface OpponentBuildDraft {
  species: string
  ability: string | null
  item: string | null
  /** Always `MAX_MOVES` slots, so each has its own picker. */
  moves: (string | null)[]
  /** What the reader wasn't sure of, when it was read from a file (ADR 24). Never sent. */
  readFlags: string[]
}

/** A Pokémon of an Opponent's Team with only its species known yet. */
export const newOpponentBuild = (species: string): OpponentBuildDraft => ({
  species,
  ability: null,
  item: null,
  moves: Array(MAX_MOVES).fill(null),
  readFlags: [],
})

export const toOpponentBuildDraft = (build: PokemonBuild): OpponentBuildDraft => ({
  species: build.species,
  ability: build.ability ?? null,
  item: build.item ?? null,
  moves: Array.from({ length: MAX_MOVES }, (_, i) => build.moves[i] ?? null),
  readFlags: [],
})

/**
 * A Team read from a file as a draft of an Opponent's Team, each Pokémon carrying what the reader
 * wasn't sure of, plus why any Pokémon on the file was left out.
 */
export function readToOpponentTeam(read: ReadTeamView): {
  pokemon: OpponentBuildDraft[]
  leftOut: string[]
} {
  const { pokemon, flags, leftOut } = opponentTeamFromRead(read)
  return {
    pokemon: pokemon.map((build, index) => ({
      ...toOpponentBuildDraft(build),
      readFlags: flags.filter(({ path }) => path[1] === index).map(({ message }) => message),
    })),
    leftOut,
  }
}

/** An Opponent's Team as the API takes it, with each build's empty move slots left out. */
export const toOpponentTeamInput = (drafts: readonly OpponentBuildDraft[]): OpponentTeamInput =>
  drafts.map((build) => ({
    species: build.species,
    ...(build.ability ? { ability: build.ability } : {}),
    ...(build.item ? { item: build.item } : {}),
    moves: build.moves.filter((move): move is string => Boolean(move)),
  }))

/**
 * What is recorded about an Opponent in a Tournament that goes once a Round is no longer against
 * them, deleted or given another, such as `Team and Age Division` (ADR 22, ADR 30). Nothing when
 * another Round there is against them, or nothing is recorded.
 */
export function lostWithLastRound(
  tournament: Parameters<typeof losesOpponentTeam>[0] &
    Parameters<typeof losesOpponentAgeDivision>[0],
  roundId: string | undefined,
  opponentId: string | undefined,
): string | undefined {
  const lost = [
    losesOpponentTeam(tournament, roundId, opponentId) && 'Team',
    losesOpponentAgeDivision(tournament, roundId, opponentId) && 'Age Division',
  ].filter(Boolean)
  return lost.length ? lost.join(' and ') : undefined
}

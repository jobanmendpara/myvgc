import { z } from 'zod'
import { MAX_TEAM_SIZE, type PokemonBuild, pokemonBuildSchema, statPointsSchema } from './build'
import type { Regulation } from './team'

const NO_STAT_POINTS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }

/**
 * One Pokémon of an Opponent's Team: a Pokémon build of which only the species is needed, as it is
 * usually entered from what an open teamsheet shows (ADR 22).
 */
export const opponentBuildSchema = pokemonBuildSchema.extend({
  moves: pokemonBuildSchema.shape.moves.default([]),
  statPoints: statPointsSchema.default(NO_STAT_POINTS),
})

/**
 * The Opponent's Team sent with a Round: up to six Pokémon, each species once. Two forms of one
 * species are different species. An empty list deletes it.
 */
export const opponentTeamSchema = z
  .array(opponentBuildSchema)
  .max(MAX_TEAM_SIZE, `A Team has at most ${MAX_TEAM_SIZE} Pokémon.`)
  .superRefine((pokemon, ctx) => {
    pokemon.forEach((build, index) => {
      if (pokemon.findIndex((other) => other.species === build.species) < index)
        ctx.addIssue({
          code: 'custom',
          path: [index, 'species'],
          message: 'This species is already on their Team.',
        })
    })
  })

export type OpponentTeamInput = z.input<typeof opponentTeamSchema>

/** The Team an Opponent brought to a Tournament, as the API returns it. */
export interface OpponentTeamView {
  opponentId: string
  pokemon: PokemonBuild[]
}

/**
 * Two Opponent's Teams of one Tournament made one, when their Opponents are merged: the
 * survivor's Pokémon first, then the duplicate's species the survivor lacks, up to six. For a
 * species both have, the survivor's empty ability, held item and moves are filled from the
 * duplicate's.
 */
export function mergeOpponentTeams(
  survivor: readonly PokemonBuild[],
  duplicate: readonly PokemonBuild[],
): PokemonBuild[] {
  const merged = survivor.map((build) => {
    const other = duplicate.find((d) => d.species === build.species)
    if (!other) return build
    return {
      ...build,
      ability: build.ability ?? other.ability,
      item: build.item ?? other.item,
      moves: build.moves.length ? build.moves : other.moves,
    }
  })
  for (const build of duplicate)
    if (merged.length < MAX_TEAM_SIZE && !merged.some((m) => m.species === build.species))
      merged.push(build)
  return merged
}

/** What `latestOpponentTeam` reads from a Tournament. */
interface TournamentTeams {
  id: string
  startDate: string
  regulation: Regulation
  opponentTeams: readonly OpponentTeamView[]
}

/**
 * The Opponent's Team the Round form offers to copy when an Opponent has none in a Tournament
 * yet: theirs from the latest other Tournament in the same Regulation, by start date (ADR 22).
 */
export function latestOpponentTeam<T extends TournamentTeams>(
  tournaments: readonly T[],
  {
    opponentId,
    regulation,
    tournamentId,
  }: {
    opponentId: string
    regulation: Regulation
    tournamentId: string
  },
): { tournament: T; pokemon: PokemonBuild[] } | undefined {
  let latest: { tournament: T; pokemon: PokemonBuild[] } | undefined
  for (const tournament of tournaments) {
    if (tournament.id === tournamentId || tournament.regulation !== regulation) continue
    const team = tournament.opponentTeams.find((t) => t.opponentId === opponentId)
    if (team && (!latest || tournament.startDate > latest.tournament.startDate))
      latest = { tournament, pokemon: team.pokemon }
  }
  return latest
}

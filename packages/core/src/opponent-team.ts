import { z } from 'zod'
import { MAX_TEAM_SIZE, type PokemonBuild, pokemonBuildSchema, statPointsSchema } from './build'
import type { Game } from './round'
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

/** One Opponent's Team among a Tournament's, if they have one there. */
export const opponentTeamOf = <T extends { opponentId: string }>(
  teams: readonly T[],
  opponentId: string | undefined,
): T | undefined => teams.find((team) => team.opponentId === opponentId)

/**
 * Whether a Round no longer being against an Opponent, deleted or given another, deletes their
 * Opponent's Team: when they have one in the Tournament and no other Round there is against them
 * (ADR 22).
 */
export function losesOpponentTeam(
  tournament: {
    rounds: readonly { id: string; opponent: { id: string } | null }[]
    opponentTeams: readonly { opponentId: string }[]
  },
  roundId: string | undefined,
  opponentId: string | undefined,
): boolean {
  if (!opponentId || !opponentTeamOf(tournament.opponentTeams, opponentId)) return false
  return !tournament.rounds.some((r) => r.id !== roundId && r.opponent?.id === opponentId)
}

/**
 * A Round's Games once its Opponent changed: the Opponent's side of each Game, as it was saved
 * against the old Opponent, is cleared (ADR 22). Picks sent for the new Opponent are kept.
 */
export function clearOpponentSide(games: readonly Game[], saved: readonly Game[]): Game[] {
  const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((species, i) => species === b[i])
  return games.map((game) => {
    const old = saved.find((g) => g.number === game.number)
    if (!old || !same(game.opponentBrought, old.opponentBrought)) return game
    if (!same(game.opponentLeads, old.opponentLeads)) return game
    return { ...game, opponentBrought: [], opponentLeads: [] }
  })
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
    const team = opponentTeamOf(tournament.opponentTeams, opponentId)
    if (team && (!latest || tournament.startDate > latest.tournament.startDate))
      latest = { tournament, pokemon: team.pokemon }
  }
  return latest
}

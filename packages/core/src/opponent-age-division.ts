import { type CalendarDate, seasonOf } from './calendar'
import type { AgeDivision } from './player-details'

/** The Age Division an Opponent played in at a Tournament (ADR 30), as the API returns it. */
export interface OpponentAgeDivisionView {
  opponentId: string
  ageDivision: AgeDivision
}

/** One Opponent's Age Division among a Tournament's, or null when it wasn't recorded. */
export const opponentAgeDivisionOf = (
  divisions: readonly OpponentAgeDivisionView[],
  opponentId: string | undefined,
): AgeDivision | null => divisions.find((d) => d.opponentId === opponentId)?.ageDivision ?? null

/**
 * Whether a Round no longer being against an Opponent, deleted or given another, deletes their
 * Age Division: when they have one in the Tournament and no other Round there is against them
 * (ADR 30).
 */
export function losesOpponentAgeDivision(
  tournament: {
    rounds: readonly { id: string; opponent: { id: string } | null }[]
    opponentAgeDivisions: readonly { opponentId: string }[]
  },
  roundId: string | undefined,
  opponentId: string | undefined,
): boolean {
  if (!opponentId || !tournament.opponentAgeDivisions.some((d) => d.opponentId === opponentId))
    return false
  return !tournament.rounds.some((r) => r.id !== roundId && r.opponent?.id === opponentId)
}

/** What `latestOpponentAgeDivision` reads from a Tournament. */
interface TournamentAgeDivisions {
  id: string
  startDate: CalendarDate
  opponentAgeDivisions: readonly OpponentAgeDivisionView[]
}

/**
 * The Age Division the Round form fills in when an Opponent has none in a Tournament yet: theirs
 * from the latest other Tournament in the same Season, by start date. Across Seasons it offers
 * nothing, as they may have moved up a division (ADR 30).
 */
export function latestOpponentAgeDivision<T extends TournamentAgeDivisions>(
  tournaments: readonly T[],
  {
    opponentId,
    tournamentId,
    startDate,
  }: { opponentId: string; tournamentId: string; startDate: CalendarDate },
): { tournament: T; ageDivision: AgeDivision } | undefined {
  const season = seasonOf(startDate)
  if (!season) return undefined
  let latest: { tournament: T; ageDivision: AgeDivision } | undefined
  for (const tournament of tournaments) {
    if (tournament.id === tournamentId || seasonOf(tournament.startDate)?.id !== season.id) continue
    const ageDivision = opponentAgeDivisionOf(tournament.opponentAgeDivisions, opponentId)
    if (ageDivision && (!latest || tournament.startDate > latest.tournament.startDate))
      latest = { tournament, ageDivision }
  }
  return latest
}

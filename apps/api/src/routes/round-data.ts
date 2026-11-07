import { type OpponentTeamView, type RoundView, compareRounds } from '@myvgc/core'
import { and, eq, inArray } from 'drizzle-orm'
import { opponent, opponentTeam, round } from '../db/schema'
import type { Database } from '../db/types'

export type RoundRow = typeof round.$inferSelect

export function toRoundView(
  row: RoundRow,
  against: { id: string; displayName: string } | null,
): RoundView {
  return {
    id: row.id,
    tournamentId: row.tournamentId,
    phase: row.phase,
    roundNumber: row.roundNumber,
    stage: row.stage,
    bestOf: row.bestOf,
    bye: row.bye,
    result: row.result,
    gameScore:
      row.gamesWon !== null && row.gamesLost !== null
        ? { won: row.gamesWon, lost: row.gamesLost }
        : null,
    opponent: against,
    notes: row.notes,
    games: row.games,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** The Rounds of some Tournaments, each list in the order they were played. */
export async function loadRounds(
  db: Database,
  tournamentIds: string[],
): Promise<Map<string, RoundView[]>> {
  const byTournament = new Map<string, RoundView[]>(tournamentIds.map((id) => [id, []]))
  if (tournamentIds.length === 0) return byTournament
  const rows = await db
    .select({ round, opponent: { id: opponent.id, displayName: opponent.displayName } })
    .from(round)
    .leftJoin(opponent, eq(round.opponentId, opponent.id))
    .where(inArray(round.tournamentId, tournamentIds))
  for (const row of rows)
    byTournament.get(row.round.tournamentId)!.push(toRoundView(row.round, row.opponent))
  for (const rounds of byTournament.values()) rounds.sort(compareRounds)
  return byTournament
}

/** The Opponent's Teams of some Tournaments (ADR 22), each list in the order they were added. */
export async function loadOpponentTeams(
  db: Pick<Database, 'select'>,
  tournamentIds: string[],
): Promise<Map<string, OpponentTeamView[]>> {
  const byTournament = new Map<string, OpponentTeamView[]>(tournamentIds.map((id) => [id, []]))
  if (tournamentIds.length === 0) return byTournament
  const rows = await db
    .select()
    .from(opponentTeam)
    .where(inArray(opponentTeam.tournamentId, tournamentIds))
    .orderBy(opponentTeam.createdAt, opponentTeam.id)
  for (const row of rows)
    byTournament.get(row.tournamentId)!.push({ opponentId: row.opponentId, pokemon: row.pokemon })
  return byTournament
}

/**
 * Deletes an Opponent's Team once no Round in its Tournament is against that Opponent, as it only
 * exists for an Opponent the User played there (ADR 22).
 */
export async function dropUnplayedTeam(
  tx: Pick<Database, 'select' | 'delete'>,
  tournamentId: string,
  opponentId: string,
) {
  const [played] = await tx
    .select({ id: round.id })
    .from(round)
    .where(and(eq(round.tournamentId, tournamentId), eq(round.opponentId, opponentId)))
    .limit(1)
  if (!played)
    await tx
      .delete(opponentTeam)
      .where(
        and(eq(opponentTeam.tournamentId, tournamentId), eq(opponentTeam.opponentId, opponentId)),
      )
}

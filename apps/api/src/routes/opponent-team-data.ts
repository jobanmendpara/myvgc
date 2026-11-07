import type { OpponentTeamView } from '@myvgc/core'
import { and, eq, inArray } from 'drizzle-orm'
import { opponentTeam, round } from '../db/schema'
import type { Database } from '../db/types'

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

/** Deletes one Opponent's Team in a Tournament, if there is one. */
export async function deleteOpponentTeam(
  tx: Pick<Database, 'delete'>,
  tournamentId: string,
  opponentId: string,
) {
  await tx
    .delete(opponentTeam)
    .where(
      and(eq(opponentTeam.tournamentId, tournamentId), eq(opponentTeam.opponentId, opponentId)),
    )
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
  if (!played) await deleteOpponentTeam(tx, tournamentId, opponentId)
}

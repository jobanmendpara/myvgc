import type { AgeDivision, OpponentAgeDivisionView } from '@myvgc/core'
import { and, eq, inArray } from 'drizzle-orm'
import { opponentAgeDivision } from '../db/schema'
import type { Database } from '../db/types'

/** The Opponent's Age Divisions of some Tournaments (ADR 30), each list in the order they were added. */
export async function loadOpponentAgeDivisions(
  db: Pick<Database, 'select'>,
  tournamentIds: string[],
): Promise<Map<string, OpponentAgeDivisionView[]>> {
  const byTournament = new Map<string, OpponentAgeDivisionView[]>(
    tournamentIds.map((id) => [id, []]),
  )
  if (tournamentIds.length === 0) return byTournament
  const rows = await db
    .select()
    .from(opponentAgeDivision)
    .where(inArray(opponentAgeDivision.tournamentId, tournamentIds))
    .orderBy(opponentAgeDivision.createdAt, opponentAgeDivision.id)
  for (const row of rows)
    byTournament
      .get(row.tournamentId)!
      .push({ opponentId: row.opponentId, ageDivision: row.ageDivision })
  return byTournament
}

/** Records an Opponent's Age Division in a Tournament, replacing any there was. */
export async function saveOpponentAgeDivision(
  tx: Pick<Database, 'insert'>,
  tournamentId: string,
  opponentId: string,
  ageDivision: AgeDivision,
) {
  await tx
    .insert(opponentAgeDivision)
    .values({ tournamentId, opponentId, ageDivision })
    .onConflictDoUpdate({
      target: [opponentAgeDivision.tournamentId, opponentAgeDivision.opponentId],
      set: { ageDivision, updatedAt: new Date() },
    })
}

/** Deletes one Opponent's Age Division in a Tournament, if there is one. */
export async function deleteOpponentAgeDivision(
  tx: Pick<Database, 'delete'>,
  tournamentId: string,
  opponentId: string,
) {
  await tx
    .delete(opponentAgeDivision)
    .where(
      and(
        eq(opponentAgeDivision.tournamentId, tournamentId),
        eq(opponentAgeDivision.opponentId, opponentId),
      ),
    )
}

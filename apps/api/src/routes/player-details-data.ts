import { type PlayerDetails, playerDetailsSchema } from '@myvgc/core'
import { eq } from 'drizzle-orm'
import { playerDetails } from '../db/schema'
import type { Database } from '../db/types'

export type PlayerDetailsRow = typeof playerDetails.$inferSelect

/** A User's Player details as they see them; blank when they have never saved any. */
export function toPlayerDetailsView(row?: PlayerDetailsRow): PlayerDetails {
  if (!row) return playerDetailsSchema.parse({})
  return {
    playerName: row.playerName,
    trainerName: row.trainerName,
    switchProfileName: row.switchProfileName,
    playerId: row.playerId,
    supportId: row.supportId,
    ageDivision: row.ageDivision,
    dateOfBirth: row.dateOfBirth,
  }
}

export async function loadPlayerDetails(db: Pick<Database, 'select'>, userId: string) {
  const [row] = await db.select().from(playerDetails).where(eq(playerDetails.userId, userId))
  return toPlayerDetailsView(row)
}

/** Replaces all of a User's Player details, making their row on the first save. */
export async function savePlayerDetails(
  db: Pick<Database, 'insert'>,
  userId: string,
  details: PlayerDetails,
) {
  const [row] = await db
    .insert(playerDetails)
    .values({ userId, ...details })
    .onConflictDoUpdate({ target: playerDetails.userId, set: details })
    .returning()
  return toPlayerDetailsView(row)
}

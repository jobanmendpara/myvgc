import { type PlayerDetails, playerDetailsSchema } from '@myvgc/core'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { playerDetails } from '../db/schema'
import type { Database } from '../db/types'
import { readBody } from './helpers'

/**
 * Account settings routes, mounted at /api/account behind the session middleware. They only
 * ever reach the logged-in User's own settings. Passwords are changed through Better Auth.
 */
export function accountRoutes(db: Database) {
  const toView = (row?: typeof playerDetails.$inferSelect): PlayerDetails => {
    if (!row) return playerDetailsSchema.parse({})
    return {
      playerName: row.playerName,
      trainerName: row.trainerName,
      switchProfileName: row.switchProfileName,
      playerId: row.playerId,
      supportId: row.supportId,
      ageDivision: row.ageDivision,
    }
  }

  return (
    new Hono<AppEnv>()
      .get('/player-details', async (c) => {
        const [row] = await db
          .select()
          .from(playerDetails)
          .where(eq(playerDetails.userId, c.get('user').id))
        return c.json(toView(row))
      })
      // Replaces all of the User's Player details; a field left out is blanked.
      .put('/player-details', async (c) => {
        const input = await readBody(c, playerDetailsSchema)
        if (!input.ok) return input.response
        const [row] = await db
          .insert(playerDetails)
          .values({ userId: c.get('user').id, ...input.data })
          .onConflictDoUpdate({ target: playerDetails.userId, set: input.data })
          .returning()
        return c.json(toView(row))
      })
  )
}

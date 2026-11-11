import { playerDetailsSchemaOn, today } from '@myvgc/core'
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import type { Database } from '../db/types'
import { readBody } from './helpers'
import { loadPlayerDetails, savePlayerDetails } from './player-details-data'

/**
 * Account settings routes, mounted at /api/account behind the session middleware. They only
 * ever reach the logged-in User's own settings. Passwords are changed through Better Auth.
 */
export function accountRoutes(db: Database) {
  return (
    new Hono<AppEnv>()
      .get('/player-details', async (c) => {
        return c.json(await loadPlayerDetails(db, c.get('user').id))
      })
      // Replaces all of the User's Player details; a field left out is blanked.
      .put('/player-details', async (c) => {
        const input = await readBody(c, playerDetailsSchemaOn(today()))
        if (!input.ok) return input.response
        return c.json(await savePlayerDetails(db, c.get('user').id, input.data))
      })
  )
}

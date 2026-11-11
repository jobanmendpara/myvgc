import { listStylesSchema, playerDetailsSchemaOn, today } from '@myvgc/core'
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import type { Database } from '../db/types'
import { readBody } from './helpers'
import { loadListStyles, saveListStyles } from './list-styles-data'
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
      .get('/list-styles', async (c) => {
        return c.json(await loadListStyles(db, c.get('user').id))
      })
      // Replaces all of the User's List styles; a list left out gets its default.
      .put('/list-styles', async (c) => {
        const input = await readBody(c, listStylesSchema)
        if (!input.ok) return input.response
        return c.json(await saveListStyles(db, c.get('user').id, input.data))
      })
  )
}

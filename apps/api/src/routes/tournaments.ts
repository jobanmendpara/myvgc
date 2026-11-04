import {
  type TournamentView,
  isUpcoming,
  newTournamentSchema,
  regulationOn,
  today,
} from '@myvgc/core'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { tournament } from '../db/schema'
import type { Database } from '../db/types'
import { isId, notFound, readBody } from './helpers'

type TournamentRow = typeof tournament.$inferSelect

export function toTournamentView(row: TournamentRow, on = today()): TournamentView {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    eventTier: row.eventTier,
    online: row.online,
    regulation: row.regulation,
    defaultBestOf: row.defaultBestOf,
    location: row.location,
    notes: row.notes,
    upcoming: isUpcoming(row.startDate, on),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** The only way to pick out one Tournament: by ID and owner together. */
export const ownTournament = (id: string, ownerId: string) =>
  and(eq(tournament.id, id), eq(tournament.ownerId, ownerId))

/** Tournament routes, mounted at /api/tournaments behind the session middleware. */
export function tournamentRoutes(db: Database) {
  return new Hono<AppEnv>()
    .get('/', async (c) => {
      const rows = await db
        .select()
        .from(tournament)
        .where(eq(tournament.ownerId, c.get('user').id))
        .orderBy(desc(tournament.startDate), desc(tournament.createdAt))
      const on = today()
      return c.json(rows.map((row) => toTournamentView(row, on)))
    })
    .post('/', async (c) => {
      const input = await readBody(c, newTournamentSchema)
      if (!input.ok) return input.response
      const { regulation, ...fields } = input.data
      const [row] = await db
        .insert(tournament)
        .values({
          ...fields,
          ownerId: c.get('user').id,
          regulation: regulation ?? regulationOn(fields.startDate),
        })
        .returning()
      return c.json(toTournamentView(row!), 201)
    })
    .get('/:id', async (c) => {
      const id = c.req.param('id')
      if (!isId(id)) return notFound(c)
      const [row] = await db
        .select()
        .from(tournament)
        .where(ownTournament(id, c.get('user').id))
      if (!row) return notFound(c)
      return c.json(toTournamentView(row))
    })
}

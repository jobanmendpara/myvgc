import { noteEntryChangesSchema } from '@myvgc/core'
import { and, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { opponent, opponentNoteEntry } from '../db/schema'
import type { Database } from '../db/types'
import { deleted, isId, notFound, readBody } from './helpers'
import { toNoteEntryView } from './note-entry-data'

/**
 * Note entry routes, mounted at /api/note-entries behind the session middleware. A Note entry
 * belongs to whoever owns its Opponent. They are found by ID alone, not through the Opponent, so
 * a change queued before a merge still reaches the Note entry on the survivor (ADR 17). Adding
 * one goes through its Opponent: POST /api/opponents/:id/note-entries.
 */
export function noteEntryRoutes(db: Database) {
  /** The only way to pick out one Note entry: by ID, on an Opponent the User owns. */
  const ownNoteEntry = (id: string, ownerId: string) =>
    and(
      eq(opponentNoteEntry.id, id),
      inArray(
        opponentNoteEntry.opponentId,
        db.select({ id: opponent.id }).from(opponent).where(eq(opponent.ownerId, ownerId)),
      ),
    )

  return (
    new Hono<AppEnv>()
      .patch('/:id', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        const input = await readBody(c, noteEntryChangesSchema)
        if (!input.ok) return input.response
        const where = ownNoteEntry(id, c.get('user').id)
        const [row] = Object.keys(input.data).length
          ? await db.update(opponentNoteEntry).set(input.data).where(where).returning()
          : await db.select().from(opponentNoteEntry).where(where)
        if (!row) return notFound(c)
        return c.json(toNoteEntryView(row))
      })
      // Answers as done whether or not there was anything of the User's to delete.
      .delete('/:id', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        await db.delete(opponentNoteEntry).where(ownNoteEntry(id, c.get('user').id))
        return deleted(c)
      })
  )
}

import { type TeamView, nameBuild, newTeamSchema, readPaste, teamPokemonSchema } from '@myvgc/core'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { team } from '../db/schema'
import type { Database } from '../db/types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type TeamRow = typeof team.$inferSelect

function toView(row: TeamRow): TeamView {
  return {
    id: row.id,
    name: row.name,
    regulation: row.regulation,
    notes: row.notes,
    pokemon: row.pokemon.map(nameBuild),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Team routes, mounted at /api/teams behind the session middleware. */
export function teamRoutes(db: Database) {
  return new Hono<AppEnv>()
    .post('/', async (c) => {
      const body = await c.req.json().catch(() => undefined)
      const input = newTeamSchema.safeParse(body)
      if (!input.success) {
        const fields: Record<string, string> = {}
        for (const issue of input.error.issues) {
          const field = String(issue.path[0] ?? 'body')
          fields[field] ??= issue.message
        }
        return c.json({ error: 'Invalid request', fields }, 400)
      }

      const read = readPaste(input.data.paste)
      if (!read.ok) return c.json({ errors: read.errors, warnings: read.warnings }, 422)

      const [row] = await db
        .insert(team)
        .values({
          ownerId: c.get('user').id,
          name: input.data.name,
          regulation: input.data.regulation,
          notes: input.data.notes,
          // The reader already checks every rule; parsing again guards what reaches the database.
          pokemon: teamPokemonSchema.parse(read.pokemon),
        })
        .returning()
      return c.json({ team: toView(row!), warnings: read.warnings }, 201)
    })
    .get('/:id', async (c) => {
      const id = c.req.param('id')
      if (!UUID.test(id)) return c.json({ error: 'Not found' }, 404)
      // Another User's Team answers exactly like a missing one.
      const [row] = await db
        .select()
        .from(team)
        .where(and(eq(team.id, id), eq(team.ownerId, c.get('user').id)))
      if (!row) return c.json({ error: 'Not found' }, 404)
      return c.json(toView(row))
    })
}

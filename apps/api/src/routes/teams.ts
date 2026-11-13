import {
  MAX_TEAMSHEET_BYTES,
  type ReadTeamView,
  TEAMSHEET_TOO_LARGE,
  type TeamView,
  checkPokemon,
  judgeTeam,
  legalityCheckSchema,
  nameBuild,
  newTeamSchema,
  readPaste,
  readTeamsheet,
  teamPokemonSchema,
  teamSchema,
  today,
  writePaste,
} from '@myvgc/core'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { AppEnv } from '../app'
import { team } from '../db/schema'
import type { Database } from '../db/types'
import { invalid, isId, notFound, readBody } from './helpers'
import { exportTeamsheet } from './teamsheet-export'

type TeamRow = typeof team.$inferSelect

function toView(row: TeamRow): TeamView {
  return {
    id: row.id,
    name: row.name,
    regulation: row.regulation,
    notes: row.notes,
    replicaTeamId: row.replicaTeamId,
    pokemon: row.pokemon.map(nameBuild),
    legality: judgeTeam(row.pokemon, row.regulation),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Team routes, mounted at /api/teams behind the session middleware. */
export function teamRoutes(db: Database) {
  // The only way routes look up a single Team: by ID and owner together, so another User's
  // Team answers exactly like a missing one.
  const ownTeam = (id: string, ownerId: string) => and(eq(team.id, id), eq(team.ownerId, ownerId))

  return (
    new Hono<AppEnv>()
      .get('/', async (c) => {
        const rows = await db
          .select()
          .from(team)
          .where(eq(team.ownerId, c.get('user').id))
          .orderBy(desc(team.createdAt), desc(team.id))
        return c.json(rows.map(toView))
      })
      .post('/', async (c) => {
        const input = await readBody(c, newTeamSchema)
        if (!input.ok) return input.response

        const { name, regulation, notes, replicaTeamId, paste, pokemon } = input.data
        const owned = { ownerId: c.get('user').id, name, regulation, notes, replicaTeamId }

        if (pokemon) {
          const issues = checkPokemon(pokemon)
          if (issues.length > 0) return invalid(c, issues)
          const [row] = await db
            .insert(team)
            .values({ ...owned, pokemon })
            .returning()
          return c.json({ team: toView(row!), warnings: [] }, 201)
        }

        // The schema makes sure a body without Pokémon builds has a paste.
        const read = readPaste(paste!)
        if (!read.ok) return c.json({ errors: read.errors, warnings: read.warnings }, 422)

        const [row] = await db
          .insert(team)
          .values({
            ...owned,
            // The reader already checks every rule; parsing again guards what reaches the database.
            pokemon: teamPokemonSchema.parse(read.pokemon),
          })
          .returning()
        return c.json({ team: toView(row!), warnings: read.warnings }, 201)
      })
      // Reads a Teamsheet PDF into a draft Team for the Team builder (ADR 24). Nothing is saved,
      // and the file is never stored or logged.
      .post(
        '/read',
        bodyLimit({
          // Room for the multipart wrapping around the file itself.
          maxSize: MAX_TEAMSHEET_BYTES + 64 * 1024,
          onError: (c) => c.json({ error: TEAMSHEET_TOO_LARGE }, 413),
        }),
        async (c) => {
          const form = await c.req.parseBody().catch(() => undefined)
          const file = form?.file
          if (!(file instanceof File))
            return c.json({ error: 'Choose a Teamsheet PDF to read.' }, 400)
          if (file.size > MAX_TEAMSHEET_BYTES) return c.json({ error: TEAMSHEET_TOO_LARGE }, 413)

          const read = await readTeamsheet(new Uint8Array(await file.arrayBuffer()))
          if (!read.ok) return c.json({ error: read.error }, 422)
          const draft: ReadTeamView = {
            name: read.name,
            pokemon: read.pokemon.map(nameBuild),
            flags: read.flags,
          }
          return c.json(draft)
        },
      )
      // Judges unsaved Pokémon builds for the Team builder, which can't load the data (ADR 18).
      .post('/check', async (c) => {
        const input = await readBody(c, legalityCheckSchema)
        if (!input.ok) return input.response
        return c.json(judgeTeam(input.data.pokemon, input.data.regulation))
      })
      .get('/:id', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        const [row] = await db
          .select()
          .from(team)
          .where(ownTeam(id, c.get('user').id))
        if (!row) return notFound(c)
        return c.json(toView(row))
      })
      .put('/:id', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        const input = await readBody(c, teamSchema)
        if (!input.ok) return input.response

        const issues = checkPokemon(input.data.pokemon)
        if (issues.length > 0) return invalid(c, issues)

        // Team snapshots are copies (ADR 9), so they don't change. The last save wins.
        const [row] = await db
          .update(team)
          .set(input.data)
          .where(ownTeam(id, c.get('user').id))
          .returning()
        if (!row) return notFound(c)
        return c.json(toView(row))
      })
      .get('/:id/paste', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        const [row] = await db
          .select({ pokemon: team.pokemon })
          .from(team)
          .where(ownTeam(id, c.get('user').id))
        if (!row) return notFound(c)
        return c.text(writePaste(row.pokemon))
      })
      // The Team's Teamsheet, made on demand and never stored (ADR 6, ADR 25), for today's Season.
      .post('/:id/teamsheet', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        const [row] = await db
          .select({ name: team.name, pokemon: team.pokemon })
          .from(team)
          .where(ownTeam(id, c.get('user').id))
        if (!row) return notFound(c)
        return exportTeamsheet(c, row, today())
      })
      .delete('/:id', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        const deleted = await db
          .delete(team)
          .where(ownTeam(id, c.get('user').id))
          .returning({ id: team.id })
        if (deleted.length === 0) return notFound(c)
        return c.body(null, 204)
      })
  )
}

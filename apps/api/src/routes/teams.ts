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
  pickTeamFields,
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
import { deleted, idTaken, invalid, isId, notFound, readBody } from './helpers'
import { exportTeamsheet } from './teamsheet-export'

type TeamRow = typeof team.$inferSelect

function toView(row: TeamRow): TeamView {
  return {
    id: row.id,
    ...pickTeamFields(row),
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

        const { id, paste, pokemon } = input.data
        const ownerId = c.get('user').id
        const owned = { ownerId, ...pickTeamFields(input.data), ...(id ? { id } : {}) }

        /**
         * Saves the new Team. A replay of a create (ADR 17), with an ID the User's Team already
         * has, answers with the saved Team as it is now, since the saved version wins; an ID held
         * by another User's Team answers 409.
         */
        async function create(values: typeof team.$inferInsert, warnings: unknown[]) {
          const [row] = await db
            .insert(team)
            .values(values)
            .onConflictDoNothing({ target: team.id })
            .returning()
          if (row) return c.json({ team: toView(row), warnings }, 201)
          const [saved] = await db.select().from(team).where(ownTeam(id!, ownerId))
          if (!saved) return idTaken(c)
          return c.json({ team: toView(saved), warnings: [] })
        }

        if (pokemon) {
          // Checked here, also for a Team built with no signal: the web app can't load the
          // Champions data, so a name it doesn't know is only found now (ADR 17).
          const issues = checkPokemon(pokemon)
          if (issues.length > 0) return invalid(c, issues)
          return create({ ...owned, pokemon }, [])
        }

        // The schema makes sure a body without Pokémon builds has a paste.
        const read = readPaste(paste!)
        if (!read.ok) return c.json({ errors: read.errors, warnings: read.warnings }, 422)

        return create(
          {
            ...owned,
            // The reader already checks every rule; parsing again guards what reaches the database.
            pokemon: teamPokemonSchema.parse(read.pokemon),
          },
          read.warnings,
        )
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
            replicaTeamId: '',
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
        // Done whether or not there was a Team of the User's to delete, so a replayed delete
        // never fails (ADR 17).
        await db.delete(team).where(ownTeam(id, c.get('user').id))
        return deleted(c)
      })
  )
}

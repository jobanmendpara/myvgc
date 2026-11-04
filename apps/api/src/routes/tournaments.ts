import {
  type EntryFee,
  type RoundView,
  type TeamSnapshotView,
  type TournamentView,
  canRefreshSnapshot,
  isUpcoming,
  linkTeamSchema,
  recordOf,
  nameBuild,
  tournamentWarnings,
  newTournamentSchema,
  regulationOn,
  today,
  tournamentChangesSchema,
  tournamentIssues,
} from '@myvgc/core'
import type { z } from 'zod'
import { and, asc, desc, eq, ilike, isNotNull } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { team, tournament } from '../db/schema'
import type { Database } from '../db/types'
import { alreadyGone, escapeLike, idTaken, invalid, isId, notFound, readBody } from './helpers'
import { loadRounds } from './round-data'

type TournamentRow = typeof tournament.$inferSelect

function toSnapshotView(row: TournamentRow): TeamSnapshotView | null {
  if (!row.teamName || !row.teamRegulation || !row.teamPokemon || !row.teamSnapshotAt) return null
  return {
    teamId: row.teamId,
    name: row.teamName,
    regulation: row.teamRegulation,
    pokemon: row.teamPokemon.map(nameBuild),
    snapshotAt: row.teamSnapshotAt.toISOString(),
  }
}

/** The Entry fee, stored as two columns that are set together. */
export const entryFeeOf = (row: TournamentRow): EntryFee | null =>
  row.entryFeeAmount !== null && row.entryFeeCurrency !== null
    ? { amount: row.entryFeeAmount, currency: row.entryFeeCurrency }
    : null

export function toTournamentView(
  row: TournamentRow,
  rounds: RoundView[],
  on = today(),
): TournamentView {
  const snapshot = toSnapshotView(row)
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
    organizer: row.organizer,
    entryFee: entryFeeOf(row),
    championshipPoints: row.championshipPoints,
    playerCount: row.playerCount,
    link: row.link,
    placement: row.placement,
    dropped: row.dropped,
    notes: row.notes,
    upcoming: isUpcoming(row.startDate, on),
    team: snapshot,
    rounds,
    record: recordOf(rounds),
    warnings: tournamentWarnings({ regulation: row.regulation, team: snapshot }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

type Fields = z.output<typeof tournamentChangesSchema>

/** Turns API fields into table columns, splitting the Entry fee in two. */
function toColumns({ entryFee, ...fields }: Fields): Partial<typeof tournament.$inferInsert> {
  if (entryFee === undefined) return fields
  return {
    ...fields,
    entryFeeAmount: entryFee?.amount ?? null,
    entryFeeCurrency: entryFee?.currency ?? null,
  }
}

/** The only way to pick out one Tournament: by ID and owner together. */
export const ownTournament = (id: string, ownerId: string) =>
  and(eq(tournament.id, id), eq(tournament.ownerId, ownerId))

/** Tournament routes, mounted at /api/tournaments behind the session middleware. */
export function tournamentRoutes(db: Database) {
  const viewWithRounds = async (row: TournamentRow) =>
    toTournamentView(row, (await loadRounds(db, [row.id])).get(row.id)!)

  return (
    new Hono<AppEnv>()
      // Organizers the User has entered before, for suggestions. Before /:id so it isn't an ID.
      .get('/organizers', async (c) => {
        const q = c.req.query('q')?.trim()
        const rows = await db
          .selectDistinct({ organizer: tournament.organizer })
          .from(tournament)
          .where(
            and(
              eq(tournament.ownerId, c.get('user').id),
              isNotNull(tournament.organizer),
              q ? ilike(tournament.organizer, `%${escapeLike(q)}%`) : undefined,
            ),
          )
          .orderBy(asc(tournament.organizer))
          .limit(10)
        return c.json(rows.map((row) => row.organizer))
      })
      .get('/', async (c) => {
        const rows = await db
          .select()
          .from(tournament)
          .where(eq(tournament.ownerId, c.get('user').id))
          .orderBy(desc(tournament.startDate), desc(tournament.createdAt))
        const on = today()
        const rounds = await loadRounds(
          db,
          rows.map((row) => row.id),
        )
        return c.json(rows.map((row) => toTournamentView(row, rounds.get(row.id)!, on)))
      })
      .post('/', async (c) => {
        const input = await readBody(c, newTournamentSchema)
        if (!input.ok) return input.response
        const ownerId = c.get('user').id
        const { id, regulation, ...fields } = input.data
        const [row] = await db
          .insert(tournament)
          .values({
            ...toColumns(fields),
            id,
            name: fields.name,
            startDate: fields.startDate,
            eventTier: fields.eventTier,
            ownerId,
            regulation: regulation ?? regulationOn(fields.startDate),
          })
          .onConflictDoNothing({ target: tournament.id })
          .returning()
        if (row) return c.json(toTournamentView(row, []), 201)

        // A replay: the Tournament is already saved, and the saved version wins.
        const [saved] = await db.select().from(tournament).where(ownTournament(id!, ownerId))
        if (!saved) return idTaken(c)
        return c.json(await viewWithRounds(saved))
      })
      .get('/:id', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        const [row] = await db
          .select()
          .from(tournament)
          .where(ownTournament(id, c.get('user').id))
        if (!row) return notFound(c)
        return c.json(await viewWithRounds(row))
      })
      .patch('/:id', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        const input = await readBody(c, tournamentChangesSchema)
        if (!input.ok) return input.response
        const where = ownTournament(id, c.get('user').id)
        const [saved] = await db.select().from(tournament).where(where)
        if (!saved) return notFound(c)

        // Rules between fields are checked against the Tournament as it will be saved.
        const view = await viewWithRounds(saved)
        const issues = tournamentIssues({ ...view, ...input.data })
        if (issues.length) return invalid(c, issues)
        if (Object.keys(input.data).length === 0) return c.json(view)

        const [row] = await db
          .update(tournament)
          .set(toColumns(input.data))
          .where(where)
          .returning()
        return c.json(toTournamentView(row!, view.rounds))
      })
      .put('/:id/team', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        const input = await readBody(c, linkTeamSchema)
        if (!input.ok) return input.response
        const ownerId = c.get('user').id
        const where = ownTournament(id, ownerId)
        const [saved] = await db.select().from(tournament).where(where)
        if (!saved) return notFound(c)
        if (saved.teamId === input.data.teamId && !canRefreshSnapshot(saved, today()))
          return c.json(
            { error: 'This Tournament is over, so its Team snapshot stays as it is.' },
            409,
          )

        const [source] = await db
          .select()
          .from(team)
          .where(and(eq(team.id, input.data.teamId), eq(team.ownerId, ownerId)))
        if (!source) return notFound(c)

        const [row] = await db
          .update(tournament)
          .set({
            teamId: source.id,
            teamName: source.name,
            teamRegulation: source.regulation,
            teamPokemon: source.pokemon,
            teamSnapshotAt: new Date(),
          })
          .where(where)
          .returning()
        return c.json(await viewWithRounds(row!))
      })
      .delete('/:id/team', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        const [row] = await db
          .update(tournament)
          .set({
            teamId: null,
            teamName: null,
            teamRegulation: null,
            teamPokemon: null,
            teamSnapshotAt: null,
          })
          .where(ownTournament(id, c.get('user').id))
          .returning()
        if (!row) return notFound(c)
        return c.json(await viewWithRounds(row))
      })
      .delete('/:id', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        await db.delete(tournament).where(ownTournament(id, c.get('user').id))
        return alreadyGone(c)
      })
  )
}

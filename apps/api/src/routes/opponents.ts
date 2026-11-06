import {
  type OpponentDetailView,
  type OpponentView,
  type Tally,
  mergeOpponentSchema,
  mergeOpponents,
  newOpponentSchema,
  opponentChangesSchema,
  tallyResult,
} from '@myvgc/core'
import { and, asc, desc, eq, exists, ilike, inArray, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { opponent, opponentAlias, round, tournament } from '../db/schema'
import type { Database } from '../db/types'
import { clash, deleted, escapeLike, idTaken, invalid, isId, notFound, readBody } from './helpers'
import { toRoundView } from './round-data'

type OpponentRow = typeof opponent.$inferSelect

/** The only way to pick out one Opponent: by ID and owner together. */
export const ownOpponent = (id: string, ownerId: string) =>
  and(eq(opponent.id, id), eq(opponent.ownerId, ownerId))

/** Aliases and Head-to-head records for some Opponents. */
async function opponentFacts(db: Database, ids: string[]) {
  const aliases = new Map<string, string[]>(ids.map((id) => [id, []]))
  const tallies = new Map<string, Tally>(ids.map((id) => [id, { wins: 0, losses: 0, ties: 0 }]))
  if (ids.length === 0) return { aliases, tallies }

  const aliasRows = await db
    .select()
    .from(opponentAlias)
    .where(inArray(opponentAlias.opponentId, ids))
    .orderBy(asc(sql`lower(${opponentAlias.name})`))
  for (const row of aliasRows) aliases.get(row.opponentId)!.push(row.name)

  const resultRows = await db
    .select({ opponentId: round.opponentId, result: round.result })
    .from(round)
    .where(inArray(round.opponentId, ids))
  for (const row of resultRows) tallyResult(tallies.get(row.opponentId!)!, row.result)
  return { aliases, tallies }
}

function toOpponentView(
  row: OpponentRow,
  facts: Awaited<ReturnType<typeof opponentFacts>>,
): OpponentView {
  const headToHead = facts.tallies.get(row.id)!
  return {
    id: row.id,
    displayName: row.displayName,
    aliases: facts.aliases.get(row.id)!,
    notes: row.notes,
    headToHead,
    roundCount: headToHead.wins + headToHead.losses + headToHead.ties,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Opponent routes, mounted at /api/opponents behind the session middleware. */
export function opponentRoutes(db: Database) {
  async function views(rows: OpponentRow[]) {
    const facts = await opponentFacts(
      db,
      rows.map((row) => row.id),
    )
    return rows.map((row) => toOpponentView(row, facts))
  }

  return (
    new Hono<AppEnv>()
      // The User's Opponents, or those whose display name or an Alias contains `q`. Exact
      // matches come first, then the rest by name. `limit` caps how many come back.
      .get('/', async (c) => {
        const q = c.req.query('q')?.trim()
        // The Round form asks for a few suggestions; the Opponents list asks for everyone.
        const limit = Math.min(Math.max(Number(c.req.query('limit')) || 1000, 1), 1000)
        const pattern = q ? `%${escapeLike(q)}%` : undefined
        const aliasMatches = (p: string) =>
          exists(
            db
              .select({ one: sql`1` })
              .from(opponentAlias)
              .where(and(eq(opponentAlias.opponentId, opponent.id), ilike(opponentAlias.name, p))),
          )
        const rows = await db
          .select()
          .from(opponent)
          .where(
            and(
              eq(opponent.ownerId, c.get('user').id),
              pattern ? or(ilike(opponent.displayName, pattern), aliasMatches(pattern)) : undefined,
            ),
          )
          .orderBy(
            ...(q
              ? [desc(or(ilike(opponent.displayName, escapeLike(q)), aliasMatches(escapeLike(q)))!)]
              : []),
            asc(sql`lower(${opponent.displayName})`),
          )
          .limit(limit)
        return c.json(await views(rows))
      })
      .post('/', async (c) => {
        const input = await readBody(c, newOpponentSchema)
        if (!input.ok) return input.response
        const ownerId = c.get('user').id
        const { id, displayName, aliases, notes } = input.data
        const created = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(opponent)
            .values({ id, ownerId, displayName, notes })
            .onConflictDoNothing({ target: opponent.id })
            .returning()
          if (row && aliases.length)
            await tx
              .insert(opponentAlias)
              .values(aliases.map((name) => ({ opponentId: row.id, name })))
          return row
        })
        if (created) return c.json((await views([created]))[0], 201)

        // A replay: the Opponent is already saved, and the saved version wins.
        const [saved] = await db.select().from(opponent).where(ownOpponent(id!, ownerId))
        if (!saved) return idTaken(c)
        return c.json((await views([saved]))[0])
      })
      .get('/:id', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        const [row] = await db
          .select()
          .from(opponent)
          .where(ownOpponent(id, c.get('user').id))
        if (!row) return notFound(c)
        const [view] = await views([row])
        const rounds = await db
          .select({
            round,
            tournament: {
              id: tournament.id,
              name: tournament.name,
              startDate: tournament.startDate,
            },
          })
          .from(round)
          .innerJoin(tournament, eq(round.tournamentId, tournament.id))
          .where(eq(round.opponentId, id))
          .orderBy(desc(tournament.startDate), desc(round.createdAt))
        const detail: OpponentDetailView = {
          ...view!,
          rounds: rounds.map((r) => ({
            ...toRoundView(r.round, { id: row.id, displayName: row.displayName }),
            tournament: r.tournament,
          })),
        }
        return c.json(detail)
      })
      .patch('/:id', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        const input = await readBody(c, opponentChangesSchema)
        if (!input.ok) return input.response
        const where = ownOpponent(id, c.get('user').id)
        const row = await db.transaction(async (tx) => {
          const { aliases, ...fields } = input.data
          const [saved] = Object.keys(fields).length
            ? await tx.update(opponent).set(fields).where(where).returning()
            : await tx.select().from(opponent).where(where)
          if (!saved) return undefined
          if (aliases) {
            await tx.delete(opponentAlias).where(eq(opponentAlias.opponentId, id))
            if (aliases.length)
              await tx
                .insert(opponentAlias)
                .values(aliases.map((name) => ({ opponentId: id, name })))
          }
          return saved
        })
        if (!row) return notFound(c)
        const [view] = await views([row])
        return c.json(view)
      })
      // Merges a duplicate Opponent into this one: the duplicate's Rounds move here, its name
      // and Aliases join this one's Aliases, its notes follow these, and it is deleted.
      .post('/:id/merge', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        const input = await readBody(c, mergeOpponentSchema)
        if (!input.ok) return input.response
        const ownerId = c.get('user').id
        const { duplicateId } = input.data
        const notADuplicate = (message: string) => invalid(c, [{ path: ['duplicateId'], message }])
        if (duplicateId === id) return notADuplicate('An Opponent can’t be merged into themselves.')

        const outcome = await db.transaction(async (tx) => {
          const rows = await tx
            .select()
            .from(opponent)
            .where(and(eq(opponent.ownerId, ownerId), inArray(opponent.id, [id, duplicateId])))
            .for('update')
          const survivor = rows.find((row) => row.id === id)
          const duplicate = rows.find((row) => row.id === duplicateId)
          if (!survivor) return { kind: 'not-found' } as const
          // Gone, another User's, or already merged by an earlier send of this request.
          if (!duplicate) return { kind: 'gone' } as const

          const { aliases } = await opponentFacts(tx, [id, duplicateId])
          const merged = mergeOpponents(
            { ...survivor, aliases: aliases.get(id)! },
            { ...duplicate, aliases: aliases.get(duplicateId)! },
          )
          if (!merged.ok) return { kind: 'clash', issues: merged.issues } as const

          await tx.update(round).set({ opponentId: id }).where(eq(round.opponentId, duplicateId))
          await tx.delete(opponentAlias).where(eq(opponentAlias.opponentId, id))
          if (merged.aliases.length)
            await tx
              .insert(opponentAlias)
              .values(merged.aliases.map((name) => ({ opponentId: id, name })))
          await tx.delete(opponent).where(eq(opponent.id, duplicateId))
          const [saved] = await tx
            .update(opponent)
            .set({ notes: merged.notes })
            .where(eq(opponent.id, id))
            .returning()
          return { kind: 'merged', saved: saved! } as const
        })
        if (outcome.kind === 'not-found') return notFound(c)
        if (outcome.kind === 'gone') return notADuplicate('That Opponent no longer exists.')
        if (outcome.kind === 'clash') return clash(c, outcome.issues)
        const [view] = await views([outcome.saved])
        return c.json(view)
      })
      .delete('/:id', async (c) => {
        const id = c.req.param('id')
        if (!isId(id)) return notFound(c)
        const where = ownOpponent(id, c.get('user').id)
        const [row] = await db.select({ id: opponent.id }).from(opponent).where(where)
        if (!row) return deleted(c)
        const [played] = await db
          .select({ id: round.id })
          .from(round)
          .where(eq(round.opponentId, id))
          .limit(1)
        if (played)
          return c.json(
            {
              error:
                'You have Rounds against this Opponent, so they can’t be deleted. Rename them, or merge them into another Opponent.',
            },
            409,
          )
        await db.delete(opponent).where(where)
        return c.body(null, 204)
      })
  )
}

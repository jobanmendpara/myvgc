import {
  type SavedRound,
  newRoundSchema,
  recordOf,
  roundInputSchema,
  roundIssues,
  roundResult,
  suggestedPlacement,
} from '@myvgc/core'
import { and, eq, ne } from 'drizzle-orm'
import { type Context, Hono } from 'hono'
import type { z } from 'zod'
import type { AppEnv } from '../app'
import { opponent, round, tournament } from '../db/schema'
import type { Database } from '../db/types'
import { clash, deleted, idTaken, invalid, isId, notFound, readBody } from './helpers'
import { ownOpponent } from './opponents'
import { loadRounds } from './round-data'
import { ownTournament } from './tournaments'

// A PATCH has no `id`; it only names the Round to create.
type RoundSave = z.output<typeof newRoundSchema>
type Issue = { path: string[]; message: string }
type Clashes = [Issue, ...Issue[]]

/** Thrown inside a save's transaction when a client-chosen ID belongs to another User. */
class IdTaken extends Error {}

/** The constraint a Postgres unique violation names, if the error is one. */
function uniqueViolation(error: unknown): string | undefined {
  for (let e = error; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    const { code, constraint } = e as { code?: string; constraint?: string }
    if (code === '23505') return constraint
  }
  return undefined
}

/**
 * Round routes, mounted at /api/tournaments/:tournamentId/rounds behind the session
 * middleware. A Round belongs to whoever owns its Tournament.
 */
export function roundRoutes(db: Database) {
  /** The User's Tournament from the path, or nothing. */
  async function ownedTournament(tournamentId: string | undefined, ownerId: string) {
    if (!isId(tournamentId)) return undefined
    const [row] = await db.select().from(tournament).where(ownTournament(tournamentId, ownerId))
    return row
  }

  /**
   * Fills in defaults, checks every rule, and saves the Round, adding a new Opponent in the same
   * transaction. Gives the issues instead when the Round isn't valid, or the clashes when it is
   * valid but another Round already has its number or stage.
   */
  async function save(
    t: typeof tournament.$inferSelect,
    input: RoundSave,
    existingId?: string,
    attempt = 1,
  ): Promise<{ issues: Issue[] } | { clashes: Clashes } | { saved: SavedRound } | { taken: true }> {
    const others = await db
      .select({ id: round.id, roundNumber: round.roundNumber, stage: round.stage })
      .from(round)
      .where(and(eq(round.tournamentId, t.id), existingId ? ne(round.id, existingId) : undefined))

    const nextNumber = Math.max(0, ...others.map((r) => r.roundNumber ?? 0)) + 1
    const facts = {
      phase: input.phase,
      roundNumber:
        input.phase === 'swiss' ? (input.roundNumber ?? nextNumber) : (input.roundNumber ?? null),
      stage: input.stage ?? null,
      bestOf: input.bestOf ?? t.defaultBestOf,
      bye: input.bye,
      result: input.result ?? null,
      gameScore: input.gameScore ?? null,
      hasOpponent: Boolean(input.opponentId || input.newOpponentName),
    }
    // The User didn't type the number, so any free one will do.
    const numberIsFree = input.phase === 'swiss' && input.roundNumber == null && !existingId
    const issues: Issue[] = roundIssues(facts)
    if (input.opponentId && input.newOpponentName)
      issues.push({ path: ['opponent'], message: 'Choose an Opponent or add one, not both.' })
    if (input.opponentId && !input.bye) {
      const [own] = await db
        .select({ id: opponent.id })
        .from(opponent)
        .where(ownOpponent(input.opponentId, t.ownerId))
      if (!own) issues.push({ path: ['opponentId'], message: 'Choose one of your Opponents.' })
    }
    if (issues.length) return { issues }

    // Checked once the Round is valid, as fixing it may change the clash.
    const numberClash: Issue = {
      path: ['roundNumber'],
      message: `Round ${facts.roundNumber} is already logged.`,
    }
    const stageClash: Issue = { path: ['stage'], message: 'That Top cut stage is already logged.' }
    const clashes: Issue[] = []
    if (facts.roundNumber !== null && others.some((r) => r.roundNumber === facts.roundNumber))
      clashes.push(numberClash)
    if (facts.stage !== null && others.some((r) => r.stage === facts.stage))
      clashes.push(stageClash)
    if (clashes.length) return { clashes: clashes as Clashes }

    // The checks above read before writing, so two saves at once can both pass them; the unique
    // constraints catch that, and the loser gets the same answer as a plain clash.
    const id = await insertOrUpdate().catch(
      (error: unknown): { clashes: Clashes } | { taken: true } | { retry: true } => {
        if (error instanceof IdTaken) return { taken: true }
        const constraint = uniqueViolation(error)
        // The same new Round sent twice at once: the other send saved it.
        if (constraint === 'round_pkey') return { taken: true }
        if (constraint === 'round_tournament_number_key' && numberIsFree && attempt < 3)
          return { retry: true }
        if (constraint === 'round_tournament_number_key') return { clashes: [numberClash] }
        if (constraint === 'round_tournament_stage_key') return { clashes: [stageClash] }
        throw error
      },
    )
    // Another save took the number this one was given; it takes the next free one instead.
    if (typeof id !== 'string') return 'retry' in id ? save(t, input, existingId, attempt + 1) : id
    return { saved: await standing(t, id) }

    function insertOrUpdate() {
      return db.transaction(async (tx) => {
        let opponentId = facts.bye ? null : (input.opponentId ?? null)
        if (!facts.bye && input.newOpponentName) {
          const [created] = await tx
            .insert(opponent)
            .values({
              id: input.newOpponentId,
              ownerId: t.ownerId,
              displayName: input.newOpponentName,
            })
            .onConflictDoNothing({ target: opponent.id })
            .returning({ id: opponent.id })
          opponentId = created?.id ?? (await replayedOpponent(tx, input.newOpponentId!))
        }
        const values = {
          tournamentId: t.id,
          phase: facts.phase,
          roundNumber: facts.roundNumber,
          stage: facts.stage,
          bestOf: facts.bestOf,
          bye: facts.bye,
          result: roundResult(facts),
          gamesWon: facts.gameScore?.won ?? null,
          gamesLost: facts.gameScore?.lost ?? null,
          opponentId,
          notes: input.notes,
        }
        const [row] = existingId
          ? await tx.update(round).set(values).where(eq(round.id, existingId)).returning()
          : await tx
              .insert(round)
              .values({ ...values, id: input.id })
              .returning()
        return row!.id
      })
    }

    /** A replayed edit already added this Opponent; the saved one is kept. */
    async function replayedOpponent(tx: Pick<Database, 'select'>, opponentId: string) {
      const [own] = await tx
        .select({ id: opponent.id })
        .from(opponent)
        .where(ownOpponent(opponentId, t.ownerId))
      if (!own) throw new IdTaken()
      return own.id
    }
  }

  /**
   * The answer to a create whose Round is already saved: the saved Round, as the server's version
   * wins. Nothing when there is no Round with that ID.
   */
  async function replay(c: Context<AppEnv>, t: typeof tournament.$inferSelect, id: string) {
    const [saved] = await db
      .select({ tournamentId: round.tournamentId })
      .from(round)
      .where(eq(round.id, id))
    if (!saved) return undefined
    if (saved.tournamentId !== t.id) return idTaken(c)
    return c.json(await standing(t, id))
  }

  /** A Round with its Tournament's Record and, if due, a suggested Placement. */
  async function standing(t: typeof tournament.$inferSelect, roundId: string): Promise<SavedRound> {
    const rounds = (await loadRounds(db, [t.id])).get(t.id)!
    return {
      round: rounds.find((r) => r.id === roundId)!,
      record: recordOf(rounds),
      suggestedPlacement: t.placement === null ? (suggestedPlacement(rounds) ?? null) : null,
    }
  }

  return (
    new Hono<AppEnv>()
      .post('/', async (c) => {
        const t = await ownedTournament(c.req.param('tournamentId'), c.get('user').id)
        if (!t) return notFound(c)
        const input = await readBody(c, newRoundSchema)
        if (!input.ok) return input.response
        // A replay is answered before any rule is checked, since a Round always clashes with
        // itself.
        const { id } = input.data
        const replayed = id && (await replay(c, t, id))
        if (replayed) return replayed
        const result = await save(t, input.data)
        if ('taken' in result) return (id && (await replay(c, t, id))) || idTaken(c)
        if ('issues' in result) return invalid(c, result.issues)
        if ('clashes' in result) return clash(c, result.clashes)
        return c.json(result.saved, 201)
      })
      // Saves the whole Round again, as the Round form sends it.
      .patch('/:roundId', async (c) => {
        const t = await ownedTournament(c.req.param('tournamentId'), c.get('user').id)
        const roundId = c.req.param('roundId')
        if (!t || !isId(roundId)) return notFound(c)
        const [existing] = await db
          .select({ id: round.id })
          .from(round)
          .where(and(eq(round.id, roundId), eq(round.tournamentId, t.id)))
        if (!existing) return notFound(c)
        const input = await readBody(c, roundInputSchema)
        if (!input.ok) return input.response
        const result = await save(t, input.data, roundId)
        if ('taken' in result) return idTaken(c)
        if ('issues' in result) return invalid(c, result.issues)
        if ('clashes' in result) return clash(c, result.clashes)
        return c.json(result.saved)
      })
      .delete('/:roundId', async (c) => {
        const roundId = c.req.param('roundId')
        if (!isId(roundId)) return notFound(c)
        const t = await ownedTournament(c.req.param('tournamentId'), c.get('user').id)
        // The Tournament, and so the Round, is gone, or was never the User's.
        if (!t) return deleted(c)
        await db.delete(round).where(and(eq(round.id, roundId), eq(round.tournamentId, t.id)))
        const rounds = (await loadRounds(db, [t.id])).get(t.id)!
        return c.json({ record: recordOf(rounds) })
      })
  )
}

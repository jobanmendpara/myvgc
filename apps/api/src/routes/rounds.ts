import {
  type SavedRound,
  recordOf,
  roundInputSchema,
  roundIssues,
  roundResult,
  suggestedPlacement,
} from '@myvgc/core'
import { and, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import type { z } from 'zod'
import type { AppEnv } from '../app'
import { opponent, round, tournament } from '../db/schema'
import type { Database } from '../db/types'
import { invalid, isId, notFound, readBody } from './helpers'
import { ownOpponent } from './opponents'
import { loadRounds } from './round-data'
import { ownTournament } from './tournaments'

type RoundInput = z.output<typeof roundInputSchema>
type Issue = { path: string[]; message: string }

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
   * transaction. Gives the issues instead when the Round isn't valid.
   */
  async function save(
    t: typeof tournament.$inferSelect,
    input: RoundInput,
    existingId?: string,
  ): Promise<{ issues: Issue[] } | { saved: SavedRound }> {
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
    const issues: Issue[] = roundIssues(facts)
    if (input.opponentId && input.newOpponentName)
      issues.push({ path: ['opponent'], message: 'Choose an Opponent or add one, not both.' })
    if (facts.roundNumber !== null && others.some((r) => r.roundNumber === facts.roundNumber))
      issues.push({
        path: ['roundNumber'],
        message: `Round ${facts.roundNumber} is already logged.`,
      })
    if (facts.stage !== null && others.some((r) => r.stage === facts.stage))
      issues.push({ path: ['stage'], message: 'That Top cut stage is already logged.' })
    if (input.opponentId && !input.bye) {
      const [own] = await db
        .select({ id: opponent.id })
        .from(opponent)
        .where(ownOpponent(input.opponentId, t.ownerId))
      if (!own) issues.push({ path: ['opponentId'], message: 'Choose one of your Opponents.' })
    }
    if (issues.length) return { issues }

    const id = await db.transaction(async (tx) => {
      let opponentId = facts.bye ? null : (input.opponentId ?? null)
      if (!facts.bye && input.newOpponentName) {
        const [created] = await tx
          .insert(opponent)
          .values({ ownerId: t.ownerId, displayName: input.newOpponentName })
          .returning({ id: opponent.id })
        opponentId = created!.id
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
        : await tx.insert(round).values(values).returning()
      return row!.id
    })
    return { saved: await standing(t, id) }
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
        const input = await readBody(c, roundInputSchema)
        if (!input.ok) return input.response
        const result = await save(t, input.data)
        if ('issues' in result) return invalid(c, result.issues)
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
        if ('issues' in result) return invalid(c, result.issues)
        return c.json(result.saved)
      })
      .delete('/:roundId', async (c) => {
        const t = await ownedTournament(c.req.param('tournamentId'), c.get('user').id)
        const roundId = c.req.param('roundId')
        if (!t || !isId(roundId)) return notFound(c)
        const deleted = await db
          .delete(round)
          .where(and(eq(round.id, roundId), eq(round.tournamentId, t.id)))
          .returning({ id: round.id })
        if (deleted.length === 0) return notFound(c)
        const rounds = (await loadRounds(db, [t.id])).get(t.id)!
        return c.json({ record: recordOf(rounds) })
      })
  )
}

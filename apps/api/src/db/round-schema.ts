import { ROUND_PHASES, ROUND_RESULTS, TOP_CUT_STAGES } from '@myvgc/core'
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { opponent } from './opponent-schema'
import { tournament } from './tournament-schema'

export const roundPhase = pgEnum('round_phase', ROUND_PHASES)
export const topCutStage = pgEnum('top_cut_stage', TOP_CUT_STAGES)
export const roundResult = pgEnum('round_result', ROUND_RESULTS)

/** One pairing in a Tournament. Never called "Match". Its owner is the Tournament's. */
export const round = pgTable(
  'round',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournament.id, { onDelete: 'cascade' }),
    phase: roundPhase('phase').notNull(),
    // Swiss Rounds have a number, Top cut Rounds a stage.
    roundNumber: smallint('round_number'),
    stage: topCutStage('stage'),
    bestOf: smallint('best_of').$type<1 | 3>().notNull(),
    bye: boolean('bye').notNull().default(false),
    // Always stored, even when a Game score decided it, so totals don't recompute it.
    result: roundResult('result').notNull(),
    gamesWon: smallint('games_won'),
    gamesLost: smallint('games_lost'),
    // An Opponent with Rounds can't be deleted; merging moves their Rounds to another Opponent.
    opponentId: uuid('opponent_id').references(() => opponent.id, { onDelete: 'restrict' }),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('round_tournament_idx').on(table.tournamentId),
    index('round_opponent_idx').on(table.opponentId),
    // Each Swiss number and each Top cut stage once per Tournament. Nulls never clash.
    unique('round_tournament_number_key').on(table.tournamentId, table.roundNumber),
    unique('round_tournament_stage_key').on(table.tournamentId, table.stage),
  ],
)

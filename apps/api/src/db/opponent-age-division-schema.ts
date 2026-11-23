import type { AgeDivision } from '@myvgc/core'
import { pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { opponent } from './opponent-schema'
import { tournament } from './tournament-schema'

/**
 * The Age Division an Opponent played in at a Tournament (ADR 30): one per Opponent per
 * Tournament, shared by every Round against them there. Its owner is the Tournament's.
 */
export const opponentAgeDivision = pgTable(
  'opponent_age_division',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournament.id, { onDelete: 'cascade' }),
    // Merging Opponents moves or drops these; deleting one with Rounds is refused anyway.
    opponentId: uuid('opponent_id')
      .notNull()
      .references(() => opponent.id, { onDelete: 'restrict' }),
    // Checked by the core schema before every write, as the User's own Age Division is.
    ageDivision: text('age_division').$type<AgeDivision>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique('opponent_age_division_tournament_opponent_key').on(
      table.tournamentId,
      table.opponentId,
    ),
  ],
)

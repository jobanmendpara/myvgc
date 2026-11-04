import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth-schema'

/** Someone a User played. A private record, not a User (see CONTEXT.md). */
export const opponent = pgTable(
  'opponent',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('opponent_owner_idx').on(table.ownerId)],
)

/** Another name an Opponent goes by. */
export const opponentAlias = pgTable(
  'opponent_alias',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    opponentId: uuid('opponent_id')
      .notNull()
      .references(() => opponent.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
  },
  (table) => [index('opponent_alias_opponent_idx').on(table.opponentId)],
)

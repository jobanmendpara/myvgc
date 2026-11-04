import { EVENT_TIERS } from '@myvgc/core'
import {
  boolean,
  date,
  index,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth-schema'
import { regulation } from './team-schema'

export const eventTier = pgEnum('event_tier', EVENT_TIERS)

export const tournament = pgTable(
  'tournament',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    eventTier: eventTier('event_tier').notNull(),
    online: boolean('online').notNull().default(false),
    regulation: regulation('regulation').notNull(),
    defaultBestOf: smallint('default_best_of').$type<1 | 3>().notNull().default(1),
    location: text('location'),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('tournament_owner_start_idx').on(table.ownerId, table.startDate)],
)

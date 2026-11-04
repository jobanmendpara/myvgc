import { EVENT_TIERS, type PokemonBuild } from '@myvgc/core'
import { sql } from 'drizzle-orm'
import {
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth-schema'
import { regulation, team } from './team-schema'

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
    organizer: text('organizer'),
    // In the currency's minor units (cents for USD). Amount and currency are set together.
    entryFeeAmount: integer('entry_fee_amount'),
    entryFeeCurrency: char('entry_fee_currency', { length: 3 }),
    championshipPoints: integer('championship_points'),
    playerCount: integer('player_count'),
    link: text('link'),
    placement: integer('placement'),
    dropped: boolean('dropped').notNull().default(false),
    // The Team snapshot (ADR 9): a copy of the User's Team, linked back to it while it exists.
    // At most one per Tournament, so it lives here rather than in a table of its own.
    teamId: uuid('team_id').references(() => team.id, { onDelete: 'set null' }),
    teamName: text('team_name'),
    teamRegulation: regulation('team_regulation'),
    teamPokemon: jsonb('team_pokemon').$type<PokemonBuild[]>(),
    teamSnapshotAt: timestamp('team_snapshot_at', { withTimezone: true }),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('tournament_owner_start_idx').on(table.ownerId, table.startDate),
    check(
      'tournament_entry_fee_complete',
      sql`(${table.entryFeeAmount} is null) = (${table.entryFeeCurrency} is null)`,
    ),
  ],
)

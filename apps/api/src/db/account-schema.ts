import type { AgeDivision, ListStyle } from '@myvgc/core'
import { date, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth-schema'

/**
 * A User's Player details (see CONTEXT.md), one row per User. The row is made on the first
 * save; until then the User's Player details are blank. Date of Birth is personal data (ADR 26).
 */
export const playerDetails = pgTable('player_details', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  playerName: text('player_name').notNull().default(''),
  trainerName: text('trainer_name').notNull().default(''),
  switchProfileName: text('switch_profile_name').notNull().default(''),
  playerId: text('player_id').notNull().default(''),
  supportId: text('support_id').notNull().default(''),
  ageDivision: text('age_division').$type<AgeDivision>(),
  dateOfBirth: date('date_of_birth'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

/**
 * A User's List style for each list (see CONTEXT.md), one row per User. The row is made on the
 * first save; until then the User gets the defaults (`DEFAULT_LIST_STYLES`). Not part of the
 * Data export.
 */
export const listStyles = pgTable('list_styles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  tournaments: text('tournaments').$type<ListStyle>().notNull(),
  teams: text('teams').$type<ListStyle>().notNull(),
  opponents: text('opponents').$type<ListStyle>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

/**
 * How many times a User read a Team from images on each day, for the optional daily limit
 * (`TEAM_READER_DAILY_LIMIT`, ADR 24). Only counts: nothing about the images is kept. Not part of
 * the Data export.
 */
export const imageReads = pgTable(
  'image_reads',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    count: integer('count').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day] })],
)

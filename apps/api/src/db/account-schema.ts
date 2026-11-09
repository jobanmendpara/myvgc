import type { AgeDivision } from '@myvgc/core'
import { date, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
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

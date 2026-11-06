import type { AgeDivision } from '@myvgc/core'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth-schema'

/**
 * A User's Player details (see CONTEXT.md), one row per User. The row is made on the first
 * save; until then the User's Player details are blank. Date of birth is never kept (ADR 20).
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
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

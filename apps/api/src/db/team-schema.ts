import { REGULATIONS, type PokemonBuild } from '@myvgc/core'
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth-schema'

export const regulation = pgEnum('regulation', REGULATIONS)

export const team = pgTable(
  'team',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    regulation: regulation('regulation').notNull().default('M-C'),
    notes: text('notes').notNull().default(''),
    // Empty when the Team has none.
    replicaTeamId: text('replica_team_id').notNull().default(''),
    // Pokémon builds, validated by the core schema before every write. Stored as one JSON
    // value so a Team snapshot (ADR 9) is a plain copy.
    pokemon: jsonb('pokemon').$type<PokemonBuild[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('team_owner_created_idx').on(table.ownerId, table.createdAt)],
)

import type { PokemonBuild } from '@myvgc/core'
import { jsonb, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { opponent } from './opponent-schema'
import { tournament } from './tournament-schema'

/**
 * The Team an Opponent brought to a Tournament (ADR 22): one per Opponent per Tournament, shared
 * by every Round against them there. Its owner is the Tournament's.
 */
export const opponentTeam = pgTable(
  'opponent_team',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournament.id, { onDelete: 'cascade' }),
    // Merging Opponents moves or combines these; deleting one with Rounds is refused anyway.
    opponentId: uuid('opponent_id')
      .notNull()
      .references(() => opponent.id, { onDelete: 'restrict' }),
    // One to six Pokémon builds, validated by the core schema before every write.
    pokemon: jsonb('pokemon').$type<PokemonBuild[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique('opponent_team_tournament_opponent_key').on(table.tournamentId, table.opponentId),
  ],
)

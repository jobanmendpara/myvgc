import { type StatisticsView, statistics, statisticsFiltersSchema } from '@myvgc/core'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { tournament } from '../db/schema'
import type { Database } from '../db/types'
import { NO_SEASON, applyFilters, filterQuery, filteredTournaments } from './filters'
import { invalid } from './helpers'
import { loadOpponentTeams } from './opponent-team-data'
import { loadRounds } from './round-data'

/** Statistics by species and by Lead, mounted at /api/statistics behind the session middleware. */
export function statisticsRoutes(db: Database) {
  return new Hono<AppEnv>().get('/', async (c) => {
    const parsed = statisticsFiltersSchema.safeParse(filterQuery(c))
    if (!parsed.success) return invalid(c, parsed.error.issues)
    const applied = applyFilters(parsed.data)
    if (!applied) return invalid(c, NO_SEASON)
    const filters = { ...applied, team: parsed.data.team ?? null }

    const rows = await db
      .select({ id: tournament.id, name: tournament.name })
      .from(tournament)
      .where(
        and(
          filteredTournaments(c.get('user').id, filters),
          // Tournaments whose Team snapshot links back to the Team (ADR 9).
          filters.team ? eq(tournament.teamId, filters.team) : undefined,
        ),
      )
      // A row lists the Rounds and Games behind it by Tournament, most recent first, and then
      // as played within each Tournament.
      .orderBy(desc(tournament.startDate), desc(tournament.createdAt), desc(tournament.id))
    const ids = rows.map((row) => row.id)
    const [rounds, opponentTeams] = await Promise.all([
      loadRounds(db, ids),
      loadOpponentTeams(db, ids),
    ])
    const view: StatisticsView = {
      filters,
      statistics: statistics(
        rows.map(({ id, name }) => ({
          id,
          name,
          rounds: rounds.get(id)!,
          opponentTeams: opponentTeams.get(id)!,
        })),
      ),
    }
    return c.json(view)
  })
}

import {
  type DashboardView,
  type SummaryTournament,
  dashboardFiltersSchema,
  summarize,
} from '@myvgc/core'
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { tournament } from '../db/schema'
import type { Database } from '../db/types'
import { NO_SEASON, applyFilters, filterQuery, filteredTournaments } from './filters'
import { invalid } from './helpers'
import { loadRounds } from './round-data'
import { entryFeeOf } from './tournaments'

/** Only what the summary reads, so Team snapshots aren't named build by build. */
function toSummaryTournament(
  row: typeof tournament.$inferSelect,
  rounds: SummaryTournament['rounds'],
): SummaryTournament {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    createdAt: row.createdAt.toISOString(),
    playerCount: row.playerCount,
    placement: row.placement,
    championshipPoints: row.championshipPoints,
    entryFee: entryFeeOf(row),
    team: row.teamName ? { teamId: row.teamId, name: row.teamName } : null,
    rounds,
  }
}

/** The dashboard, mounted at /api/dashboard behind the session middleware. */
export function dashboardRoutes(db: Database) {
  return new Hono<AppEnv>().get('/', async (c) => {
    const parsed = dashboardFiltersSchema.safeParse(filterQuery(c))
    if (!parsed.success) return invalid(c, parsed.error.issues)
    const filters = applyFilters(parsed.data)
    if (!filters) return invalid(c, NO_SEASON)

    const rows = await db
      .select()
      .from(tournament)
      .where(filteredTournaments(c.get('user').id, filters))
    const rounds = await loadRounds(
      db,
      rows.map((row) => row.id),
    )
    const tournaments = rows.map((row) => toSummaryTournament(row, rounds.get(row.id)!))
    const view: DashboardView = { filters, summary: summarize(tournaments) }
    return c.json(view)
  })
}

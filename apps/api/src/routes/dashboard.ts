import {
  type DashboardView,
  type SummaryTournament,
  SEASONS,
  currentRegulation,
  dashboardFiltersSchema,
  summarize,
  today,
} from '@myvgc/core'
import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { tournament } from '../db/schema'
import type { Database } from '../db/types'
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
    const parsed = dashboardFiltersSchema.safeParse({
      ...c.req.query(),
      eventTier: c.req.queries('eventTier') ?? [],
    })
    if (!parsed.success) return invalid(c, parsed.error.issues)
    const input = parsed.data
    const season = input.season ? SEASONS.find((s) => s.id === input.season) : undefined
    if (input.season && !season)
      return invalid(c, [{ path: ['season'], message: 'There is no such Season.' }])

    const on = today()
    const filters: DashboardView['filters'] = {
      regulation: input.regulation ?? currentRegulation(on),
      season: season?.id ?? null,
      from: season?.start ?? input.from ?? null,
      to: season ? (season.end ?? null) : (input.to ?? null),
      eventTier: input.eventTier,
      setting: input.setting ?? null,
    }

    const rows = await db
      .select()
      .from(tournament)
      .where(
        and(
          eq(tournament.ownerId, c.get('user').id),
          filters.regulation === 'all' ? undefined : eq(tournament.regulation, filters.regulation),
          filters.from ? gte(tournament.startDate, filters.from) : undefined,
          filters.to ? lte(tournament.startDate, filters.to) : undefined,
          filters.eventTier.length ? inArray(tournament.eventTier, filters.eventTier) : undefined,
          filters.setting ? eq(tournament.online, filters.setting === 'online') : undefined,
        ),
      )
    const rounds = await loadRounds(
      db,
      rows.map((row) => row.id),
    )
    const tournaments = rows.map((row) => toSummaryTournament(row, rounds.get(row.id)!))
    const view: DashboardView = { filters, summary: summarize(tournaments) }
    return c.json(view)
  })
}

import { type AppliedFilters, applyDashboardFilters, today } from '@myvgc/core'
import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import type { Context } from 'hono'
import type { AppEnv } from '../app'
import { tournament } from '../db/schema'

// The dashboard's filters, shared by the dashboard and Statistics.

/** The filters as they arrive in the query string, unparsed. */
export const filterQuery = (c: Context<AppEnv>) => ({
  ...c.req.query(),
  eventTier: c.req.queries('eventTier') ?? [],
})

/** Parsed filters applied as of the server's today, or nothing if there is no such Season. */
export const applyFilters = (input: Parameters<typeof applyDashboardFilters>[0]) =>
  applyDashboardFilters(input, today())

export const NO_SEASON = [{ path: ['season'], message: 'There is no such Season.' }]

/** The User's Tournaments that the filters keep. */
export const filteredTournaments = (ownerId: string, filters: AppliedFilters) =>
  and(
    eq(tournament.ownerId, ownerId),
    filters.regulation === 'all' ? undefined : eq(tournament.regulation, filters.regulation),
    filters.from ? gte(tournament.startDate, filters.from) : undefined,
    filters.to ? lte(tournament.startDate, filters.to) : undefined,
    filters.eventTier.length ? inArray(tournament.eventTier, filters.eventTier) : undefined,
    filters.setting ? eq(tournament.online, filters.setting === 'online') : undefined,
  )

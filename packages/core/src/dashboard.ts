import { z } from 'zod'
import { type CalendarDate, SEASONS, type Season, currentRegulation, seasonOf } from './calendar'
import { type RoundView, type Tally, tallyResult } from './round'
import { REGULATIONS } from './team'
import { EVENT_TIERS, type EntryFee } from './tournament'

/** A Round as the dashboard needs it. */
export type SummaryRound = Pick<
  RoundView,
  'phase' | 'bestOf' | 'bye' | 'result' | 'gameScore' | 'opponent'
>

/** A Tournament as the dashboard needs it. */
export interface SummaryTournament {
  id: string
  name: string
  startDate: CalendarDate
  createdAt: string
  playerCount: number | null
  placement: number | null
  championshipPoints: number | null
  entryFee: EntryFee | null
  team: { teamId: string | null; name: string } | null
  rounds: SummaryRound[]
}

/** A tally with its win rate: wins out of Rounds played, so Ties count as not won. */
export type Rate = Tally & { winRate: number | null }

export interface DashboardSummary {
  /** Tournaments with a Round or a Placement. Upcoming ones have neither. */
  tournamentsPlayed: number
  /** Every Round except Byes. */
  rounds: Rate
  /** Games in Rounds with a Game score, or nothing if no Round has one. */
  games: { won: number; lost: number; winRate: number | null } | null
  /** Tournaments with a Top cut Round, out of those with any Round. */
  topCut: { made: number; of: number; rate: number | null }
  byPhase: { swiss: Rate; topCut: Rate }
  byBestOf: { 1: Rate; 3: Rate }
  /** Championship Points per Season, oldest first. CP resets each Season, so never one total. */
  championshipPoints: { season: Pick<Season, 'id' | 'name' | 'partial'> | null; points: number }[]
  /** Entry fees per currency, by currency code. Upcoming Tournaments count. */
  entryFees: { currency: string; amount: number; tournaments: number }[]
  /** Performance with each of the User's Teams, most Rounds first. */
  byTeam: (Rate & { teamId: string | null; name: string; tournaments: number })[]
  /** The ten most-played Opponents with Head-to-head records. */
  opponents: (Tally & { id: string; displayName: string; rounds: number })[]
  /** The ten best Placements. */
  bestPlacements: {
    tournamentId: string
    name: string
    startDate: CalendarDate
    placement: number
    playerCount: number | null
  }[]
  /** Some of the Tournaments are in a Season only partly played in Champions. */
  includesPartialSeason: boolean
}

const TOP = 10

export const tally = (): Tally => ({ wins: 0, losses: 0, ties: 0 })
/** A tally with its win rate, or no rate when nothing was played. */
export const rate = (t: Tally): Rate => {
  const played = t.wins + t.losses + t.ties
  return { ...t, winRate: played ? t.wins / played : null }
}

/** Every figure on the dashboard, from Tournaments that have already been filtered. */
export function summarize(tournaments: SummaryTournament[]): DashboardSummary {
  const all = tally()
  const phases = { swiss: tally(), topCut: tally() }
  const bestOfs = { 1: tally(), 3: tally() }
  const games = { won: 0, lost: 0, scored: 0 }
  const topCut = { made: 0, of: 0 }
  const cp = new Map<string, { season: Season | undefined; points: number }>()
  const fees = new Map<string, { amount: number; tournaments: number }>()
  const teams = new Map<
    string,
    { teamId: string | null; name: string; latest: string; tournaments: number; tally: Tally }
  >()
  const opponents = new Map<string, Tally & { id: string; displayName: string; rounds: number }>()
  let played = 0
  let partial = false

  for (const t of tournaments) {
    const season = seasonOf(t.startDate)
    if (season?.partial) partial = true
    if (t.rounds.length || t.placement !== null) played++

    if (t.championshipPoints !== null) {
      const key = season?.id ?? ''
      const entry = cp.get(key) ?? { season, points: 0 }
      entry.points += t.championshipPoints
      cp.set(key, entry)
    }
    if (t.entryFee) {
      const entry = fees.get(t.entryFee.currency) ?? { amount: 0, tournaments: 0 }
      entry.amount += t.entryFee.amount
      entry.tournaments++
      fees.set(t.entryFee.currency, entry)
    }

    if (t.rounds.length) {
      topCut.of++
      if (t.rounds.some((r) => r.phase === 'top-cut')) topCut.made++
    }

    let team: { tally: Tally } | undefined
    if (t.team && t.rounds.length) {
      // Snapshots of the same Team count together; one whose Team was deleted stands alone.
      const key = t.team.teamId ?? `snapshot:${t.id}`
      const order = `${t.startDate} ${t.createdAt}`
      const entry = teams.get(key) ?? {
        teamId: t.team.teamId,
        name: t.team.name,
        latest: order,
        tournaments: 0,
        tally: tally(),
      }
      // The name from the most recent Tournament, as the Team is called now.
      if (order >= entry.latest) {
        entry.latest = order
        entry.name = t.team.name
      }
      entry.tournaments++
      teams.set(key, entry)
      team = entry
    }

    for (const r of t.rounds) {
      if (r.bye) continue
      tallyResult(all, r.result)
      tallyResult(r.phase === 'swiss' ? phases.swiss : phases.topCut, r.result)
      tallyResult(bestOfs[r.bestOf], r.result)
      if (team) tallyResult(team.tally, r.result)
      if (r.gameScore) {
        games.scored++
        games.won += r.gameScore.won
        games.lost += r.gameScore.lost
      }
      if (r.opponent) {
        const entry = opponents.get(r.opponent.id) ?? {
          id: r.opponent.id,
          displayName: r.opponent.displayName,
          rounds: 0,
          ...tally(),
        }
        entry.rounds++
        tallyResult(entry, r.result)
        opponents.set(r.opponent.id, entry)
      }
    }
  }

  const gameCount = games.won + games.lost
  return {
    tournamentsPlayed: played,
    rounds: rate(all),
    games: games.scored
      ? { won: games.won, lost: games.lost, winRate: gameCount ? games.won / gameCount : null }
      : null,
    topCut: { ...topCut, rate: topCut.of ? topCut.made / topCut.of : null },
    byPhase: { swiss: rate(phases.swiss), topCut: rate(phases.topCut) },
    byBestOf: { 1: rate(bestOfs[1]), 3: rate(bestOfs[3]) },
    championshipPoints: [...cp.values()]
      .sort((a, b) => (a.season?.start ?? '').localeCompare(b.season?.start ?? ''))
      .map(({ season, points }) => ({
        season: season ? { id: season.id, name: season.name, partial: season.partial } : null,
        points,
      })),
    entryFees: [...fees.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, fee]) => ({ currency, ...fee })),
    byTeam: [...teams.values()]
      .map(({ teamId, name, tournaments, tally }) => ({
        teamId,
        name,
        tournaments,
        ...rate(tally),
      }))
      .sort((a, b) => b.wins + b.losses + b.ties - (a.wins + a.losses + a.ties)),
    opponents: [...opponents.values()]
      .sort((a, b) => b.rounds - a.rounds || a.displayName.localeCompare(b.displayName))
      .slice(0, TOP),
    bestPlacements: tournaments
      .filter((t): t is SummaryTournament & { placement: number } => t.placement !== null)
      .sort((a, b) => a.placement - b.placement || b.startDate.localeCompare(a.startDate))
      .slice(0, TOP)
      .map((t) => ({
        tournamentId: t.id,
        name: t.name,
        startDate: t.startDate,
        placement: t.placement,
        playerCount: t.playerCount,
      })),
    includesPartialSeason: partial,
  }
}

const calendarDate = z.iso.date('Use a date such as 2026-09-19.')

/**
 * Dashboard filters as they arrive in a query string. The Regulation defaults to the current
 * one (`all` for every Regulation). A Season or a date range, not both.
 */
const dashboardFilterFields = z.object({
  regulation: z.enum([...REGULATIONS, 'all']).optional(),
  season: z.string().optional(),
  from: calendarDate.optional(),
  to: calendarDate.optional(),
  eventTier: z.array(z.enum(EVENT_TIERS)).default([]),
  setting: z.enum(['online', 'in-person']).optional(),
})

const seasonOrDates = (f: { season?: string; from?: string; to?: string }) =>
  !(f.season && (f.from || f.to))
const SEASON_OR_DATES = { message: 'Choose a Season or a date range, not both.', path: ['season'] }

export const dashboardFiltersSchema = dashboardFilterFields.refine(seasonOrDates, SEASON_OR_DATES)

export type DashboardFilters = z.output<typeof dashboardFiltersSchema>

/** The filters the dashboard applied, with the Season's dates and the Regulation filled in. */
export interface AppliedFilters {
  regulation: (typeof REGULATIONS)[number] | 'all'
  season: string | null
  from: CalendarDate | null
  to: CalendarDate | null
  eventTier: (typeof EVENT_TIERS)[number][]
  setting: 'online' | 'in-person' | null
}

/**
 * Dashboard filters with a Season's dates and the Regulation current on `today` filled in, or
 * nothing if there is no such Season.
 */
export function applyDashboardFilters(
  input: DashboardFilters,
  today: CalendarDate,
): AppliedFilters | undefined {
  const season = input.season ? SEASONS.find((s) => s.id === input.season) : undefined
  if (input.season && !season) return undefined
  return {
    regulation: input.regulation ?? currentRegulation(today),
    season: season?.id ?? null,
    from: season?.start ?? input.from ?? null,
    to: season ? (season.end ?? null) : (input.to ?? null),
    eventTier: input.eventTier,
    setting: input.setting ?? null,
  }
}

/** What the dashboard endpoint answers: the summary and the filters it applied. */
export interface DashboardView {
  filters: AppliedFilters
  summary: DashboardSummary
}

/** Statistics filters: the dashboard's, and optionally one Team (ADR 9). */
export const statisticsFiltersSchema = dashboardFilterFields
  .extend({ team: z.uuid('Choose one of your Teams.').optional() })
  .refine(seasonOrDates, SEASON_OR_DATES)

export type StatisticsFilters = z.output<typeof statisticsFiltersSchema>

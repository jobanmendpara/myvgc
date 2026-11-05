import type { Regulation } from './team'

// Seasons and Regulation dates ship with the app (ADR 16). Dates are calendar days written as
// YYYY-MM-DD, so they compare correctly as strings. Today's date is always passed in, which keeps
// everything here pure. Sources: docs/research/pokemon-champions-data.md.

/** A calendar day, such as `2026-09-09`. */
export type CalendarDate = string

export interface RegulationPeriod {
  regulation: Regulation
  start: CalendarDate
  /** The last day it is in force. Left out until it is announced. */
  end?: CalendarDate
}

export interface Season {
  /** The year it ends in, such as `2027`. */
  id: string
  name: string
  start: CalendarDate
  /** The last day of its Worlds. Left out until it is announced. */
  end?: CalendarDate
  /** Only part of the Season was played in Champions. */
  partial: boolean
}

/** Every Regulation with its dates, oldest first. */
export const REGULATION_PERIODS: readonly RegulationPeriod[] = [
  { regulation: 'M-A', start: '2026-04-08', end: '2026-06-16' },
  { regulation: 'M-B', start: '2026-06-17', end: '2026-09-08' },
  { regulation: 'M-C', start: '2026-09-09', end: '2026-12-01' },
]

/** A Showdown mod holding one Regulation's rules. */
export type ChampionsMod = 'champions' | 'championsregmb'

/**
 * The mod that holds each Regulation's rules, or null for one MyVGC has no rules for (ADR 18).
 * `champions` always holds the latest Regulation, so a new one moves this map in the same release.
 */
export const REGULATION_MODS: Readonly<Record<Regulation, ChampionsMod | null>> = {
  'M-A': null,
  'M-B': 'championsregmb',
  'M-C': 'champions',
}

/** Every Season with its dates, oldest first. */
export const SEASONS: readonly Season[] = [
  // Champions came out on 2026-04-08, partway through the 2026 Season.
  { id: '2026', name: '2026 Season', start: '2026-04-08', end: '2026-08-30', partial: true },
  { id: '2027', name: '2027 Season', start: '2026-08-31', partial: false },
]

const covers = (period: { start: CalendarDate; end?: CalendarDate }, date: CalendarDate) =>
  date >= period.start && (period.end === undefined || date <= period.end)

/**
 * The Regulation in force on a day. Days after the last known Regulation get that one, until a
 * release adds the next. Days before Champions get the first.
 */
export function regulationOn(date: CalendarDate): Regulation {
  const period =
    REGULATION_PERIODS.find((p) => covers(p, date)) ??
    REGULATION_PERIODS.findLast((p) => date >= p.start) ??
    REGULATION_PERIODS[0]!
  return period.regulation
}

/** The current Regulation: the one in force on `today`. */
export const currentRegulation = (today: CalendarDate): Regulation => regulationOn(today)

/** The Season a day falls in. Days before Champions are in no Season. */
export function seasonOf(date: CalendarDate): Season | undefined {
  return SEASONS.find((season) => covers(season, date))
}

/** Today's date where the code runs, as a calendar day. */
export function today(now = new Date()): CalendarDate {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

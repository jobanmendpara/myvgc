import { z } from 'zod'
import { clientIdSchema } from './client-id'
import type { RoundView, TournamentRecord } from './round'
import type { OpponentTeamView } from './opponent-team'
import {
  type Legality,
  MAX_NOTES_LENGTH,
  type NamedPokemonBuild,
  REGULATIONS,
  type Regulation,
} from './team'

/** The kinds of Tournament, in the order the User picks from. */
export const EVENT_TIERS = [
  'premier-challenge',
  'regional',
  'international',
  'worlds',
  'grassroots',
  'online',
  'other',
] as const
export type EventTier = (typeof EVENT_TIERS)[number]

export const EVENT_TIER_LABELS: Record<EventTier, string> = {
  'premier-challenge': 'Premier Challenge',
  regional: 'Regional',
  international: 'International',
  worlds: 'Worlds',
  grassroots: 'Grassroots',
  online: 'Online',
  other: 'Other',
}

export const BEST_OF = [1, 3] as const
export type BestOf = (typeof BEST_OF)[number]

export const MAX_TOURNAMENT_NAME_LENGTH = 100
export const MAX_SHORT_TEXT_LENGTH = 200
export const MAX_LINK_LENGTH = 500
/** The largest Entry fee in minor units. */
export const MAX_ENTRY_FEE = 100_000_000

// Intl echoes back any well-formed code, so only the codes it actually supports count.
const CURRENCIES = new Set(Intl.supportedValuesOf('currency'))
const isCurrency = (code: string) => CURRENCIES.has(code)

const calendarDate = z.iso.date('Use a date such as 2026-09-19.')
const bestOf = z.union([z.literal(1), z.literal(3)], 'Rounds are best of 1 or best of 3.')

/** Turns blank text into "not given", so clearing a field removes it. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((text) => text || null)
    .nullable()
    .optional()

/** Every Tournament field a User can set. */
const tournamentFields = {
  name: z
    .string()
    .trim()
    .min(1, 'Give the Tournament a name.')
    .max(
      MAX_TOURNAMENT_NAME_LENGTH,
      `Tournament names can be at most ${MAX_TOURNAMENT_NAME_LENGTH} characters.`,
    ),
  startDate: calendarDate,
  endDate: calendarDate.nullable().optional(),
  eventTier: z.enum(EVENT_TIERS, 'Choose an Event tier.'),
  online: z.boolean(),
  regulation: z.enum(REGULATIONS),
  defaultBestOf: bestOf,
  location: optionalText(MAX_SHORT_TEXT_LENGTH, 'Locations'),
  organizer: optionalText(MAX_SHORT_TEXT_LENGTH, 'Organizers'),
  entryFee: z
    .object({
      amount: z
        .number()
        .int('Entry fees are in whole minor units, such as cents.')
        .min(0, 'Entry fees can’t be negative.')
        .max(MAX_ENTRY_FEE, 'That Entry fee is too large.'),
      currency: z
        .string()
        .regex(/^[A-Z]{3}$/, 'Use a three-letter currency code, such as USD.')
        .refine(isCurrency, 'That isn’t a currency MyVGC knows.'),
    })
    .nullable()
    .optional(),
  championshipPoints: z
    .number()
    .int('Championship Points are whole numbers.')
    .min(0, 'Championship Points can’t be negative.')
    .max(100_000, 'That’s more Championship Points than anyone earns.')
    .nullable()
    .optional(),
  playerCount: z
    .number()
    .int('The player count is a whole number.')
    .min(2, 'A Tournament has at least 2 players.')
    .max(100_000, 'That’s more players than any Tournament has.')
    .nullable()
    .optional(),
  link: z
    .string()
    .trim()
    .max(MAX_LINK_LENGTH, `Links can be at most ${MAX_LINK_LENGTH} characters.`)
    .transform((text) => text || null)
    .refine((text) => text === null || isWebLink(text), 'Use a web address starting with https://.')
    .nullable()
    .optional(),
  placement: z
    .number()
    .int('Placements are whole numbers.')
    .min(1, 'Placements start at 1st.')
    .max(100_000, 'That Placement is too large.')
    .nullable()
    .optional(),
  dropped: z.boolean(),
  notes: z.string().max(MAX_NOTES_LENGTH, `Notes can be at most ${MAX_NOTES_LENGTH} characters.`),
}

function isWebLink(text: string): boolean {
  try {
    const url = new URL(text)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** The fields whose rules involve more than one field. */
interface CrossChecked {
  startDate?: string
  endDate?: string | null
  playerCount?: number | null
  placement?: number | null
}

/**
 * Rules between fields: the end date isn't before the start date, and the Placement isn't
 * below the last place. Run on a whole Tournament, so changes are checked against what is saved.
 */
export function tournamentIssues(t: CrossChecked): { path: string[]; message: string }[] {
  const issues: { path: string[]; message: string }[] = []
  if (t.startDate && t.endDate && t.endDate < t.startDate)
    issues.push({ path: ['endDate'], message: 'The end date can’t be before the start date.' })
  if (t.placement && t.playerCount && t.placement > t.playerCount)
    issues.push({ path: ['placement'], message: `There were only ${t.playerCount} players.` })
  return issues
}

const crossCheck = (t: CrossChecked, ctx: z.RefinementCtx) => {
  for (const issue of tournamentIssues(t)) ctx.addIssue({ code: 'custom', ...issue })
}

/** What a User sends to create a Tournament. A missing Regulation comes from the start date. */
export const newTournamentSchema = z
  .object({
    id: clientIdSchema,
    ...tournamentFields,
    online: tournamentFields.online.default(false),
    regulation: tournamentFields.regulation.optional(),
    defaultBestOf: tournamentFields.defaultBestOf.default(1),
    dropped: tournamentFields.dropped.default(false),
    notes: tournamentFields.notes.default(''),
  })
  .superRefine(crossCheck)

/** What a User sends to change a Tournament: any of its fields. */
export const tournamentChangesSchema = z.object(tournamentFields).partial()

export type NewTournament = z.input<typeof newTournamentSchema>
export type TournamentChanges = z.input<typeof tournamentChangesSchema>

/** An amount in a currency's minor units (cents for USD, yen for JPY) and its ISO 4217 code. */
export interface EntryFee {
  amount: number
  currency: string
}

/** How many decimal places a currency's amounts have: 2 for USD, 0 for JPY. */
export function currencyDecimals(currency: string): number {
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  )
}

/** Reads an amount typed by a User, such as `35` or `35.50`, into minor units. */
export function toMinorUnits(text: string, currency: string): number | undefined {
  const decimals = currencyDecimals(currency)
  const match = /^\s*(\d+)(?:[.,](\d*))?\s*$/.exec(text)
  if (!match) return undefined
  const [, whole, fraction = ''] = match
  if (fraction.length > decimals) return undefined
  return Number(whole) * 10 ** decimals + Number(fraction.padEnd(decimals, '0') || 0)
}

/** The amount as a User would type it back in, such as `35.50`. */
export const fromMinorUnits = (amount: number, currency: string) =>
  (amount / 10 ** currencyDecimals(currency)).toFixed(currencyDecimals(currency))

/** An amount for display, such as `CA$35.00`. */
export const formatMoney = ({ amount, currency }: EntryFee) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(
    amount / 10 ** currencyDecimals(currency),
  )

/** A Tournament as the API returns it. */
export interface TournamentView {
  id: string
  name: string
  startDate: string
  endDate: string | null
  eventTier: EventTier
  online: boolean
  regulation: Regulation
  defaultBestOf: BestOf
  location: string | null
  organizer: string | null
  entryFee: EntryFee | null
  championshipPoints: number | null
  playerCount: number | null
  link: string | null
  placement: number | null
  dropped: boolean
  notes: string
  /** It starts after today. */
  upcoming: boolean
  /** The snapshot of the User's Team for this Tournament (ADR 9). */
  team: TeamSnapshotView | null
  /** Its Rounds as they were played: Swiss by number, then Top cut by stage. */
  rounds: RoundView[]
  /** The Team each Opponent the User played here brought (ADR 22). */
  opponentTeams: OpponentTeamView[]
  record: TournamentRecord
  /** Things worth a second look that don't stop a save, such as a Regulation mismatch. */
  warnings: string[]
  createdAt: string
  updatedAt: string
}

/** Whether a Tournament starting on `startDate` is still Upcoming on `today`. */
export const isUpcoming = (startDate: string, today: string) => startDate > today

/** A frozen copy of a Team, attached to a Tournament (ADR 9). */
export interface TeamSnapshotView {
  /** The Team it was copied from, or null once that Team is deleted. */
  teamId: string | null
  name: string
  regulation: Regulation
  pokemon: NamedPokemonBuild[]
  /** Judged against the Tournament's Regulation, not the Team's own (ADR 18). */
  legality: Legality
  snapshotAt: string
}

export const linkTeamSchema = z.object({ teamId: z.uuid('Choose one of your Teams.') })

/** Whether the Tournament's last day (its end date, or start date for a one-day event) has passed. */
export const isOver = (t: { startDate: string; endDate: string | null }, today: string) =>
  (t.endDate ?? t.startDate) < today

/**
 * Whether the Team snapshot can be refreshed from its Team on `today`. Until the Tournament is
 * over, so last-minute changes are captured; after that it stays as brought. Linking a Team for
 * the first time, or a different Team to fix a wrong choice, is always allowed.
 */
export const canRefreshSnapshot = (
  t: { startDate: string; endDate: string | null },
  today: string,
) => !isOver(t, today)

/** Warnings about a Tournament as it stands. */
export function tournamentWarnings(t: {
  regulation: Regulation
  team: { regulation: Regulation } | null
}): string[] {
  if (t.team && t.team.regulation !== t.regulation)
    return [
      `The Team is tagged Reg ${t.team.regulation}, but this Tournament is Reg ${t.regulation}.`,
    ]
  return []
}

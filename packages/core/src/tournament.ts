import { z } from 'zod'
import { MAX_NOTES_LENGTH, REGULATIONS, type Regulation } from './team'

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
  notes: z.string().max(MAX_NOTES_LENGTH, `Notes can be at most ${MAX_NOTES_LENGTH} characters.`),
}

const endNotBeforeStart = (t: { startDate?: string; endDate?: string | null }) =>
  !t.startDate || !t.endDate || t.endDate >= t.startDate
const endDateIssue = { message: 'The end date can’t be before the start date.', path: ['endDate'] }

/** What a User sends to create a Tournament. A missing Regulation comes from the start date. */
export const newTournamentSchema = z
  .object({
    ...tournamentFields,
    online: tournamentFields.online.default(false),
    regulation: tournamentFields.regulation.optional(),
    defaultBestOf: tournamentFields.defaultBestOf.default(1),
    notes: tournamentFields.notes.default(''),
  })
  .refine(endNotBeforeStart, endDateIssue)

/** What a User sends to change a Tournament: any of its fields. */
export const tournamentChangesSchema = z.object(tournamentFields).partial()

export type NewTournament = z.input<typeof newTournamentSchema>
export type TournamentChanges = z.input<typeof tournamentChangesSchema>

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
  notes: string
  /** It starts after today. */
  upcoming: boolean
  createdAt: string
  updatedAt: string
}

/** Whether a Tournament starting on `startDate` is still Upcoming on `today`. */
export const isUpcoming = (startDate: string, today: string) => startDate > today

/** Checks the end date against the start date once changes are applied. */
export const datesInOrder = endNotBeforeStart
export const DATES_OUT_OF_ORDER = endDateIssue

import { z } from 'zod'
import type { CalendarDate } from './calendar'

export const MAX_PLAYER_DETAIL_LENGTH = 100

export const AGE_DIVISIONS = ['Junior', 'Senior', 'Masters'] as const
export type AgeDivision = (typeof AGE_DIVISIONS)[number]

const dateOfBirth = z.iso.date({ error: 'Enter a Date of Birth such as 2010-01-31.', abort: true })

const detail = z
  .string()
  .trim()
  .max(MAX_PLAYER_DETAIL_LENGTH, `This can be at most ${MAX_PLAYER_DETAIL_LENGTH} characters.`)
  .default('')

/**
 * A User's Player details (see CONTEXT.md), as they send and see them. All optional: an empty
 * field is `''`, and no Age Division or Date of Birth is `null`. With a Date of Birth, Age
 * Division is worked out for each Season (`ageDivisionIn`, ADR 26) and the stored one is only the
 * fallback.
 */
export const playerDetailsSchema = z.object({
  playerName: detail,
  trainerName: detail,
  switchProfileName: detail,
  playerId: detail,
  supportId: detail,
  ageDivision: z
    .enum(
      AGE_DIVISIONS,
      `Choose ${AGE_DIVISIONS.slice(0, -1).join(', ')} or ${AGE_DIVISIONS.at(-1)}.`,
    )
    .nullable()
    .default(null),
  dateOfBirth: dateOfBirth.nullable().default(null),
})

/** Player details as saved on `today`, when a Date of Birth in the future is refused. */
export const playerDetailsSchemaOn = (today: CalendarDate) =>
  playerDetailsSchema.extend({
    dateOfBirth: dateOfBirth
      .refine((date) => date <= today, "A Date of Birth can't be in the future.")
      .nullable()
      .default(null),
  })

export type PlayerDetails = z.output<typeof playerDetailsSchema>

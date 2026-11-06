import { z } from 'zod'

export const MAX_PLAYER_DETAIL_LENGTH = 100

export const AGE_DIVISIONS = ['Junior', 'Senior', 'Masters'] as const
export type AgeDivision = (typeof AGE_DIVISIONS)[number]

const detail = z
  .string()
  .trim()
  .max(MAX_PLAYER_DETAIL_LENGTH, `This can be at most ${MAX_PLAYER_DETAIL_LENGTH} characters.`)
  .default('')

/**
 * A User's Player details (see CONTEXT.md), as they send and see them. All optional: an empty
 * field is `''` and no Age Division is `null`. Date of birth is never kept (ADR 20).
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
})

export type PlayerDetails = z.output<typeof playerDetailsSchema>

import { z } from 'zod'
import { type CalendarDate, ageDivisionIn, seasonOf } from './calendar'
import { type AgeDivision, MAX_PLAYER_DETAIL_LENGTH, playerDetailsSchema } from './player-details'

// The light half of Teamsheet export: what the export dialog sends, and the Age Division it
// shows. The PDF itself is made by `writeTeamsheet` in `@myvgc/core`.

/**
 * What the export dialog sends (ADR 20): the Player details, changed for this export only, and the
 * Battle Team Number / Name, which defaults to the Team's name.
 */
export const teamsheetExportSchema = playerDetailsSchema.extend({
  battleTeamName: z
    .string()
    .trim()
    .max(MAX_PLAYER_DETAIL_LENGTH, `This can be at most ${MAX_PLAYER_DETAIL_LENGTH} characters.`)
    .default(''),
})

export type TeamsheetExport = z.output<typeof teamsheetExportSchema>

/**
 * The Age Division to write on a Teamsheet for the Season of `on` (ADR 26): worked out from Date of
 * Birth when there is one, otherwise the stored Age Division.
 */
export function teamsheetAgeDivision(
  details: { dateOfBirth: CalendarDate | null; ageDivision: AgeDivision | null },
  on: CalendarDate,
): AgeDivision | null {
  const season = seasonOf(on)
  if (details.dateOfBirth && season) return ageDivisionIn(details.dateOfBirth, season)
  return details.ageDivision
}

/** `<Team name> Teamsheet.pdf`. */
export const teamsheetFileName = (teamName: string) => `${teamName} Teamsheet.pdf`

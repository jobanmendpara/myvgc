import {
  type CalendarDate,
  type PokemonBuild,
  teamsheetAgeDivision,
  teamsheetExportSchema,
  teamsheetFileName,
  writeTeamsheet,
} from '@myvgc/core'
import type { Context } from 'hono'
import { teamsheetAssets } from '../teamsheet-assets'
import { contentDisposition, readBody } from './helpers'

/**
 * Answers an export request with the Teamsheet PDF for a Team or Team snapshot (ADR 25). The body
 * holds the Player details and Battle Team name for this export; Age Division is worked out for
 * the Season of `seasonDate`.
 */
export async function exportTeamsheet(
  c: Context,
  team: { name: string; pokemon: PokemonBuild[] },
  seasonDate: CalendarDate,
) {
  const input = await readBody(c, teamsheetExportSchema)
  if (!input.ok) return input.response

  const written = await writeTeamsheet({
    ...(await teamsheetAssets()),
    pokemon: team.pokemon,
    header: {
      ...input.data,
      battleTeamName: input.data.battleTeamName || team.name,
      ageDivision: teamsheetAgeDivision(input.data, seasonDate),
    },
  })
  if (!written.ok) {
    console.error(written.error)
    return c.json({ error: written.error }, 500)
  }
  return c.body(written.pdf, 200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': contentDisposition('attachment', teamsheetFileName(team.name)),
    'Cache-Control': 'private, no-store',
  })
}

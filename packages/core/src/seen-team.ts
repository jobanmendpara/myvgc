import { z } from 'zod'
import { MAX_MOVES, MAX_TEAM_SIZE, type PokemonBuild, STAT_IDS, type StatId } from './build'
import { readBuild } from './read-build'
import { MAX_TEAM_NAME_LENGTH, type ReadFlag } from './team'

/** A number shown on the image, or null when it isn't shown or can't be made out. */
const shown = z.number().nullable()
const stats = z.object(
  Object.fromEntries(STAT_IDS.map((stat) => [stat, shown])) as {
    [stat in StatId]: typeof shown
  },
)

/** The fields an image reader can say it wasn't sure of. */
export const UNSURE_FIELDS = [
  'species',
  'ability',
  'item',
  'statAlignment',
  'moves',
  'stats',
] as const

/**
 * What an image reader saw on screenshots or photos of a Team (ADR 24): the words and numbers
 * shown, not yet matched to the Champions data. The image reader's model fills this in, so it
 * avoids rules a model can't be held to, such as lengths and ranges; `readSeenTeam` checks those.
 */
export const seenTeamSchema = z.object({
  name: z
    .string()
    .describe(
      'The Battle Team name or Replica Team ID shown on the images, or an empty string when none is shown.',
    ),
  pokemon: z
    .array(
      z.object({
        species: z.string().describe("The Pokémon's species or form, in English."),
        ability: z.string().nullable(),
        item: z.string().nullable().describe('The held item, or null when none is shown.'),
        statAlignment: z
          .string()
          .nullable()
          .describe('The Stat Alignment (nature), such as Adamant, or null when not shown.'),
        moves: z.array(z.string()).describe('Up to four moves, in the order shown.'),
        statValues: stats.describe(
          'Each final stat value as the game shows it, such as 169 Speed. Null for any not shown.',
        ),
        statPoints: stats.describe(
          "Each stat's Stat Points (0 to 32), only when the image shows them. Null otherwise.",
        ),
        unsure: z
          .array(z.enum(UNSURE_FIELDS))
          .describe('The fields that were hard to make out, so the User should check them.'),
      }),
    )
    .describe('Each Pokémon on the Team, in the order shown. Empty when no Team is shown.'),
})

export type SeenTeam = z.infer<typeof seenTeamSchema>
type SeenStats = SeenTeam['pokemon'][number]['statValues']

/** Where each unsure field's flag goes, and what it says. */
const UNSURE: Record<(typeof UNSURE_FIELDS)[number], { path: string; message: string }> = {
  species: { path: 'species', message: 'The species was hard to make out, so check it.' },
  ability: { path: 'ability', message: 'The ability was hard to make out, so check it.' },
  item: { path: 'item', message: 'The held item was hard to make out, so check it.' },
  statAlignment: {
    path: 'nature',
    message: 'The Stat Alignment was hard to make out, so check it.',
  },
  moves: { path: 'moves', message: 'The moves were hard to make out, so check them.' },
  stats: { path: 'statPoints', message: 'The stats were hard to make out, so check them.' },
}

/** The stats that were shown, or nothing when none were. */
function shownStats(seen: SeenStats): Partial<Record<StatId, number>> | undefined {
  const known = Object.fromEntries(
    STAT_IDS.flatMap((stat) => (seen[stat] === null ? [] : [[stat, seen[stat]]])),
  )
  return Object.keys(known).length > 0 ? known : undefined
}

/**
 * Turns what an image reader saw into a draft Team, with the same name matching, Stat Points
 * working and flags as a Teamsheet PDF (ADR 24). Pokémon with no species seen are left out.
 */
export function readSeenTeam(seen: SeenTeam): {
  name: string
  pokemon: PokemonBuild[]
  flags: ReadFlag[]
} {
  const flags: ReadFlag[] = []
  const found = seen.pokemon.filter((build) => build.species.trim())
  const pokemon = found.slice(0, MAX_TEAM_SIZE).map((build, index) => {
    const read = readBuild(
      {
        species: build.species,
        ability: build.ability ?? undefined,
        item: build.item ?? undefined,
        statAlignment: build.statAlignment ?? undefined,
        moves: build.moves,
        statValues: shownStats(build.statValues),
        statPoints: shownStats(build.statPoints),
      },
      index,
      flags,
    )
    if (build.moves.filter((move) => move.trim()).length > MAX_MOVES)
      flags.push({
        path: ['pokemon', index, 'moves'],
        message: `More than ${MAX_MOVES} moves were seen, so only the first ${MAX_MOVES} were read.`,
      })
    for (const field of new Set(build.unsure))
      flags.push({ path: ['pokemon', index, UNSURE[field].path], message: UNSURE[field].message })
    return read
  })
  if (found.length > MAX_TEAM_SIZE)
    flags.push({
      path: ['pokemon', MAX_TEAM_SIZE - 1],
      message: `${found.length} Pokémon were seen, so only the first ${MAX_TEAM_SIZE} were read.`,
    })
  return { name: seen.name.trim().slice(0, MAX_TEAM_NAME_LENGTH), pokemon, flags }
}

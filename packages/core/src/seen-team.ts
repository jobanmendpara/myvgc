import { z } from 'zod'
import {
  MAX_MOVES,
  MAX_NICKNAME_LENGTH,
  MAX_TEAM_SIZE,
  type PokemonBuild,
  STAT_IDS,
  STAT_NAMES,
  type StatId,
} from './build'
import { champions } from './champions'
import { readBuild } from './read-build'
import { ALIGNED_STAT_IDS, statAlignmentFromArrows } from './stat-alignment'
import { MAX_TEAM_NAME_LENGTH, type ReadFlag, replicaTeamIdSchema } from './team'

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
  'nickname',
  'gender',
  'ability',
  'item',
  'statAlignment',
  'moves',
  'stats',
] as const

/** The Team's own fields an image reader can say it wasn't sure of. */
export const UNSURE_TEAM_FIELDS = ['battleTeamName', 'replicaTeamId'] as const

/**
 * What kind of screen an image is (ADR 24, DEV-120): the Replica Team's "Moves & More" or "Stats"
 * tab, a Pokémon detail screen, or anything else, from which nothing is read.
 */
export const SEEN_IMAGE_KINDS = [
  'replicaTeamMoves',
  'replicaTeamStats',
  'pokemonDetail',
  'unsupported',
] as const

/** The read's error when no image is a supported screen (DEV-126). It still counts as a read. */
export const NO_SUPPORTED_IMAGE =
  'None of these images is a Replica Team or a Pokémon detail screen.'
/** The read's error when the supported screens showed no Pokémon. */
export const NO_POKEMON_SEEN = "MyVGC couldn't find a Team's Pokémon on these images."

/**
 * What an image reader saw on screenshots of a Team (ADR 24): the words and numbers
 * shown, not yet matched to the Champions data. The image reader's model fills this in, so it
 * avoids rules a model can't be held to, such as lengths and ranges; `readSeenTeam` checks those.
 */
export const seenTeamSchema = z.object({
  images: z
    .array(
      z.object({
        kind: z
          .enum(SEEN_IMAGE_KINDS)
          .describe(
            "replicaTeamMoves: the Replica Team's Moves & More tab. replicaTeamStats: its Stats tab. pokemonDetail: one Pokémon's detail screen. unsupported: any other image.",
          ),
      }),
    )
    .describe('One entry per image, in the order the images were given.'),
  battleTeamName: z
    .string()
    .nullable()
    .describe(
      "The Battle Team's own name, only when the images show one. Never the Replica Team ID, the slot or a Trainer Name. Null when none is shown.",
    ),
  replicaTeamId: z
    .string()
    .nullable()
    .describe(
      'The Replica Team ID: the code of letters and digits after "Team ID:" in a Replica Team tab\'s banner, such as 9TCG84KWXK. Null when not shown.',
    ),
  unsure: z
    .array(z.enum(UNSURE_TEAM_FIELDS))
    .describe("The Team's fields that were hard to make out, so the User should check them."),
  pokemon: z
    .array(
      z.object({
        species: z
          .string()
          .describe(
            'The species in English: on a detail screen the name after "No.", on a Replica Team tab the panel\'s heading. Exactly as written, with a form only when the screen names one. Never the nickname or the gender.',
          ),
        nickname: z
          .string()
          .nullable()
          .describe(
            'The nickname exactly as shown by the Poké Ball and gender symbol on a detail screen. Null when no detail screen shows this Pokémon: the Replica Team tabs show only the species.',
          ),
        gender: z
          .enum(['male', 'female'])
          .nullable()
          .describe('From the gender symbol: ♂ is male, ♀ is female. Null when none is shown.'),
        ability: z.string().nullable(),
        item: z.string().nullable().describe('The held item, or null when none is shown.'),
        statAlignment: z
          .string()
          .nullable()
          .describe(
            "The Stat Alignment's name (nature), such as Adamant, only where it is written. Null when only arrows show.",
          ),
        raisedStat: z
          .enum(ALIGNED_STAT_IDS)
          .nullable()
          .describe(
            'The stat with the pink ▲ by its name: atk Attack, def Defense, spa Sp. Atk, spd Sp. Def, spe Speed. Null when no ▲ is shown.',
          ),
        loweredStat: z
          .enum(ALIGNED_STAT_IDS)
          .nullable()
          .describe(
            'The stat with the blue ▼ by its name: atk Attack, def Defense, spa Sp. Atk, spd Sp. Def, spe Speed. Null when no ▼ is shown.',
          ),
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
  nickname: { path: 'nickname', message: 'The nickname was hard to make out, so check it.' },
  gender: { path: 'gender', message: 'The gender was hard to make out, so check it.' },
  ability: { path: 'ability', message: 'The ability was hard to make out, so check it.' },
  item: { path: 'item', message: 'The held item was hard to make out, so check it.' },
  statAlignment: {
    path: 'nature',
    message: 'The Stat Alignment was hard to make out, so check it.',
  },
  moves: { path: 'moves', message: 'The moves were hard to make out, so check them.' },
  stats: { path: 'statPoints', message: 'The stats were hard to make out, so check them.' },
}

/** Where each unsure Team field's flag goes, and what it says. */
const UNSURE_TEAM: Record<(typeof UNSURE_TEAM_FIELDS)[number], { path: string; message: string }> =
  {
    battleTeamName: { path: 'name', message: 'The Team name was hard to make out, so check it.' },
    replicaTeamId: {
      path: 'replicaTeamId',
      message: 'The Replica Team ID was hard to make out, so check it.',
    },
  }

/**
 * The species whose form follows gender in the Champions data (DEV-124): the plain ID is the male
 * form, and `-F` the female one.
 */
const GENDER_FORMS = ['meowstic', 'indeedee', 'basculegion'] as const

/** Lowercase letters and digits only, as Showdown compares names. */
const toId = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * The species text to look up, with its gender form chosen (DEV-124). When the text is a gender
 * form's base name, female gives the `-F` form and male the base form; with no gender, the base
 * form stays, with a flag. A form named in the text wins over the gender, with a flag when the two
 * contradict.
 */
function withGenderForm(
  species: string,
  gender: 'male' | 'female' | null,
  flag: (message: string) => void,
): string {
  const found = champions.species(species)
  const base = GENDER_FORMS.find((id) => found?.id === id || found?.id === `${id}f`)
  if (!found || !base) return species
  if (toId(species) === base) {
    if (gender === 'female') return champions.species(`${base}f`)?.name ?? species
    if (gender === null) flag('No gender was shown, so check whether this is the female form.')
    return species
  }
  if (gender !== null && (found.id === `${base}f`) !== (gender === 'female'))
    flag("The form shown doesn't match the gender shown, so check them.")
  return species
}

/**
 * The nickname to keep: the text as shown, on one line, or nothing when it's blank or the same as
 * the species text as read, ignoring case (DEV-124). Comparing with the text rather than the
 * matched species means a female Basculegion with no nickname doesn't get "Basculegion".
 */
function keptNickname(nickname: string | null, species: string): string | undefined {
  const text = nickname
    ?.replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, MAX_NICKNAME_LENGTH)
  if (!text || text.toLowerCase() === species.trim().toLowerCase()) return undefined
  return text
}

type SeenBuild = SeenTeam['pokemon'][number]

/**
 * The Stat Alignment's name to read (DEV-121): the name when one was shown, or else the one the
 * ▲/▼ arrows name, with no inference. With no arrows and no name, a Pokémon on a Stats tab that was
 * read gets Serious, since the five neutral Stat Alignments make the same Pokémon; with no Stats
 * tab it's left blank. Arrows no Stat Alignment has are left blank, with a flag giving what was
 * seen.
 */
function chosenStatAlignment(
  build: SeenBuild,
  statsTabRead: boolean,
  flag: (field: string, message: string) => void,
): string | undefined {
  if (build.statAlignment?.trim()) return build.statAlignment
  const { raisedStat: raised, loweredStat: lowered } = build
  if (!raised && !lowered) return statsTabRead ? 'Serious' : undefined
  const found = raised && lowered ? statAlignmentFromArrows(raised, lowered) : undefined
  if (found) return found.name
  const seen = [
    ...(raised ? [`▲ ${STAT_NAMES[raised]}`] : []),
    ...(lowered ? [`▼ ${STAT_NAMES[lowered]}`] : []),
    ...(raised ? [] : ['no ▲']),
    ...(lowered ? [] : ['no ▼']),
  ]
  flag('nature', `The arrows showed ${seen.join(' and ')}, so the Stat Alignment was left blank.`)
  flag('statPoints', 'Stat Points were worked out with no Stat Alignment, so check them.')
  return undefined
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
 * working, numbers check and flags as a Teamsheet PDF (ADR 24), plus each Pokémon's nickname and
 * gender and the gender form they choose (DEV-124), and the Stat Alignment its arrows name
 * (DEV-121). Pokémon with no species seen are left out. Each
 * unsupported image gets a flag for the Team; a read with no supported image, or no Pokémon,
 * fails.
 */
export function readSeenTeam(
  seen: SeenTeam,
):
  | { ok: true; name: string; replicaTeamId: string; pokemon: PokemonBuild[]; flags: ReadFlag[] }
  | { ok: false; error: string } {
  if (seen.images.length > 0 && seen.images.every((image) => image.kind === 'unsupported'))
    return { ok: false, error: NO_SUPPORTED_IMAGE }
  const flags: ReadFlag[] = []
  seen.images.forEach((image, index) => {
    if (image.kind === 'unsupported')
      flags.push({
        path: ['images', index],
        message: `Image ${index + 1} isn't a Replica Team or Pokémon detail screen, so nothing was read from it.`,
      })
  })
  // The ID is stored as the Team schema stores it; one that still isn't valid is left blank.
  const seenId = seen.replicaTeamId?.trim() ?? ''
  const id = replicaTeamIdSchema.safeParse(seenId)
  if (!id.success)
    flags.push({
      path: ['replicaTeamId'],
      message: `"${seenId}" isn't a Replica Team ID, so it was left blank.`,
    })
  for (const field of new Set(seen.unsure))
    // An ID left blank already has its flag.
    if (field !== 'replicaTeamId' || (id.success && id.data))
      flags.push({ path: [UNSURE_TEAM[field].path], message: UNSURE_TEAM[field].message })
  const found = seen.pokemon.filter((build) => build.species.trim())
  if (found.length === 0) return { ok: false, error: NO_POKEMON_SEEN }
  const statsTabRead = seen.images.some((image) => image.kind === 'replicaTeamStats')
  const pokemon = found.slice(0, MAX_TEAM_SIZE).map((build, index): PokemonBuild => {
    // The species is never swapped with the nickname: one that doesn't match is left blank.
    const species = withGenderForm(build.species, build.gender, (message) =>
      flags.push({ path: ['pokemon', index, 'species'], message }),
    )
    const read = readBuild(
      {
        species,
        nickname: build.nickname ?? undefined,
        ability: build.ability ?? undefined,
        item: build.item ?? undefined,
        statAlignment: chosenStatAlignment(build, statsTabRead, (field, message) =>
          flags.push({ path: ['pokemon', index, field], message }),
        ),
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
    const nickname = keptNickname(build.nickname, build.species)
    const { species: id, ...rest } = read
    return {
      species: id,
      ...(nickname && { nickname }),
      ...(build.gender && { gender: build.gender === 'female' ? 'F' : 'M' }),
      ...rest,
    }
  })
  if (found.length > MAX_TEAM_SIZE)
    flags.push({
      path: ['pokemon', MAX_TEAM_SIZE - 1],
      message: `${found.length} Pokémon were seen, so only the first ${MAX_TEAM_SIZE} were read.`,
    })
  return {
    ok: true,
    // No supported screen shows a Battle Team name, so the name is usually blank, with no flag:
    // the Team builder asks for one (DEV-126).
    name: (seen.battleTeamName ?? '').trim().slice(0, MAX_TEAM_NAME_LENGTH),
    replicaTeamId: id.success ? id.data : '',
    pokemon,
    flags,
  }
}

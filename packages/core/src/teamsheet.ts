import { PDFDocument, PDFTextField } from 'pdf-lib'
import {
  MAX_MOVES,
  MAX_TOTAL_STAT_POINTS,
  type PokemonBuild,
  STAT_IDS,
  STAT_LABELS,
  repeatedMoves,
  totalStatPoints,
} from './build'
import { type ChampionsKind, champions, championsNames } from './champions'
import { statPointsFromValues } from './stat-values'
import type { ReadFlag } from './team'

export type ReadTeamsheetResult =
  | { ok: true; name: string; pokemon: PokemonBuild[]; flags: ReadFlag[] }
  | { ok: false; error: string }

// teamsheet.gg's form fields, `f0` to `f150` (docs/research/vg-team-list-pdf.md). Each page has
// a Battle Team name field and six Pokémon boxes; a box's fields run on from its first.
const PAGES = [
  { name: 10, boxes: [19, 41, 63, 85, 107, 129], stats: true },
  { name: 11, boxes: [33, 55, 77, 99, 121, 143], stats: false },
]
const FIELD_COUNT = 151
const SPECIES = 0
const STAT_ALIGNMENT = 1
const ABILITY = 2
const ITEM = 3
const FIRST_MOVE = 4
const FIRST_STAT = 8

const NOT_A_TEAMSHEET =
  "This isn't a recognised Teamsheet. MyVGC reads Teamsheets filled in on teamsheet.gg."

/**
 * Reads a Teamsheet PDF filled in on teamsheet.gg into a draft Team (ADR 24). Names become
 * Showdown IDs; one the Champions data doesn't know is left out and flagged. Stat Points are
 * worked out from the staff page's stat values. Player details are ignored.
 */
export async function readTeamsheet(pdf: Uint8Array): Promise<ReadTeamsheetResult> {
  let fields: Map<string, string>
  try {
    const doc = await PDFDocument.load(pdf, { updateMetadata: false })
    fields = new Map(
      doc
        .getForm()
        .getFields()
        .map((field) => [
          field.getName(),
          field instanceof PDFTextField ? (field.getText() ?? '').trim() : '',
        ]),
    )
  } catch (error) {
    // pdf-lib's error classes don't survive its ES5 build, so `instanceof` can't tell them apart.
    if (error instanceof Error && /\bis encrypted\b/.test(error.message))
      return { ok: false, error: "This PDF is password-protected, so MyVGC can't read it." }
    return { ok: false, error: "This file isn't a PDF MyVGC can open." }
  }
  if (!Array.from({ length: FIELD_COUNT }, (_, n) => `f${n}`).every((name) => fields.has(name)))
    return { ok: false, error: NOT_A_TEAMSHEET }

  const text = (field: number) => fields.get(`f${field}`) ?? ''
  // The staff page has stat values; the opponents page is the fallback.
  const page = PAGES.find(({ boxes }) => boxes.some((first) => text(first + SPECIES)))
  if (!page) return { ok: false, error: 'This Teamsheet has no Pokémon on it.' }

  const flags: ReadFlag[] = []
  const pokemon = page.boxes
    .filter((first) => text(first + SPECIES))
    .map((first, index) => readBox(text, first, page.stats, index, flags))
  // Players often fill in only one page's header.
  const name = text(page.name) || PAGES.map((other) => text(other.name)).find(Boolean) || ''
  return { ok: true, name, pokemon, flags }
}

function readBox(
  text: (field: number) => string,
  /** The number of the box's first field, such as 19 for `f19`. */
  first: number,
  withStats: boolean,
  index: number,
  flags: ReadFlag[],
): PokemonBuild {
  const lookUp = (kind: ChampionsKind, offset: number, field: (string | number)[]) => {
    const name = text(first + offset)
    if (!name) return undefined
    const found = champions[kind](name)
    if (!found)
      flags.push({ path: ['pokemon', index, ...field], message: `Couldn't read "${name}".` })
    return found?.id
  }

  const build: PokemonBuild = {
    species: lookUp('species', SPECIES, ['species']) ?? '',
    moves: [],
    statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  }
  const nature = lookUp('nature', STAT_ALIGNMENT, ['nature'])
  if (nature) build.nature = nature
  const ability = lookUp('ability', ABILITY, ['ability'])
  if (ability) build.ability = ability
  const item = lookUp('item', ITEM, ['item'])
  if (item) build.item = item

  for (let move = 0; move < MAX_MOVES; move++) {
    const id = lookUp('move', FIRST_MOVE + move, ['moves', build.moves.length])
    if (!id) continue
    if (repeatedMoves([...build.moves, id]).length > 0) {
      flags.push({
        path: ['pokemon', index, 'moves'],
        message: `"${text(first + FIRST_MOVE + move)}" was listed twice, so it was read once.`,
      })
      continue
    }
    build.moves.push(id)
  }

  if (!withStats) return build
  const flagStats = (message: string, ...stat: string[]) =>
    flags.push({ path: ['pokemon', index, 'statPoints', ...stat], message })
  const values = Object.fromEntries(
    STAT_IDS.flatMap((stat, offset) => {
      const value = text(first + FIRST_STAT + offset)
      return /^\d+$/.test(value) ? [[stat, Number(value)]] : []
    }),
  )
  const baseStats = championsNames().baseStats[build.species]
  if (!baseStats) {
    if (Object.keys(values).length > 0)
      flagStats("Stat Points weren't worked out, since the species wasn't read.")
    return build
  }

  const read = statPointsFromValues(baseStats, values, build.nature)
  build.statPoints = read.statPoints
  // Without its Stat Alignment the raised and lowered stats can't fit, so one flag says it all.
  if (text(first + STAT_ALIGNMENT) && !build.nature)
    flagStats('Stat Points were worked out with no Stat Alignment, so check them.')
  else
    for (const stat of read.impossible)
      flagStats(
        `No Stat Points give ${values[stat]} ${STAT_LABELS[stat]}, so it was set to 0.`,
        stat,
      )
  const total = totalStatPoints(read.statPoints)
  if (total > MAX_TOTAL_STAT_POINTS)
    flagStats(`The Stat Points read add up to ${total}; the most is ${MAX_TOTAL_STAT_POINTS}.`)
  return build
}

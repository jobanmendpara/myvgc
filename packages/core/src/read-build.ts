import {
  MAX_MOVES,
  MAX_STAT_POINTS,
  MAX_TOTAL_STAT_POINTS,
  type PokemonBuild,
  STAT_IDS,
  STAT_LABELS,
  type StatId,
  repeatedMoves,
  totalStatPoints,
} from './build'
import { type ChampionsKind, champions, championsNames } from './champions'
import { statPointsFromValues } from './stat-values'
import type { ReadFlag } from './team'

/**
 * One Pokémon build as a reader saw it on a file, before names are matched (ADR 24): the text of
 * each field, and any numbers. Leave a field out, or blank, when the file doesn't show it.
 */
export interface BuildText {
  species: string
  statAlignment?: string
  ability?: string
  item?: string
  /** Up to four moves, in order. Blank ones are skipped. */
  moves: string[]
  /** Stat values as the game shows them. Stat Points are worked out from them. */
  statValues?: Partial<Record<StatId, number>>
  /** Stat Points, when the file shows them. They win over `statValues`. */
  statPoints?: Partial<Record<StatId, number>>
}

/**
 * Turns what a reader saw into a Pokémon build (ADR 24). Names become Showdown IDs through the
 * Champions data; one that doesn't match is left out with a flag giving the text read. Anything
 * else the reader can't make sense of is flagged too, on the field it's about.
 */
export function readBuild(text: BuildText, index: number, flags: ReadFlag[]): PokemonBuild {
  const flag = (message: string, ...field: (string | number)[]) =>
    flags.push({ path: ['pokemon', index, ...field], message })
  const lookUp = (kind: ChampionsKind, name: string | undefined, field: (string | number)[]) => {
    name = name?.trim()
    if (!name) return undefined
    const found = champions[kind](name)
    if (!found) flag(`Couldn't read "${name}".`, ...field)
    return found?.id
  }

  const build: PokemonBuild = {
    species: lookUp('species', text.species, ['species']) ?? '',
    moves: [],
    statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  }
  const nature = lookUp('nature', text.statAlignment, ['nature'])
  if (nature) build.nature = nature
  const ability = lookUp('ability', text.ability, ['ability'])
  if (ability) build.ability = ability
  const item = lookUp('item', text.item, ['item'])
  if (item) build.item = item

  for (const move of text.moves.slice(0, MAX_MOVES)) {
    const id = lookUp('move', move, ['moves', build.moves.length])
    if (!id) continue
    if (repeatedMoves([...build.moves, id]).length > 0) {
      flag(`"${move.trim()}" was listed twice, so it was read once.`, 'moves')
      continue
    }
    build.moves.push(id)
  }

  const checkTotal = () => {
    const total = totalStatPoints(build.statPoints)
    if (total > MAX_TOTAL_STAT_POINTS)
      flag(
        `The Stat Points read add up to ${total}; the most is ${MAX_TOTAL_STAT_POINTS}.`,
        'statPoints',
      )
  }

  const points = text.statPoints ?? {}
  if (Object.keys(points).length > 0) {
    for (const stat of STAT_IDS) {
      const value = points[stat]
      if (value === undefined) continue
      if (Number.isInteger(value) && value >= 0 && value <= MAX_STAT_POINTS)
        build.statPoints[stat] = value
      else
        flag(
          `${value} ${STAT_LABELS[stat]} Stat Points isn't possible, so it was set to 0.`,
          'statPoints',
          stat,
        )
    }
    checkTotal()
    return build
  }

  const values = text.statValues
  if (!values) return build
  const baseStats = championsNames().baseStats[build.species]
  if (!baseStats) {
    if (Object.keys(values).length > 0)
      flag("Stat Points weren't worked out, since the species wasn't read.", 'statPoints')
    return build
  }

  const read = statPointsFromValues(baseStats, values, build.nature)
  build.statPoints = read.statPoints
  // Without its Stat Alignment the raised and lowered stats can't fit, so one flag says it all.
  if (text.statAlignment?.trim() && !build.nature)
    flag('Stat Points were worked out with no Stat Alignment, so check them.', 'statPoints')
  else
    for (const stat of read.impossible)
      flag(
        `No Stat Points give ${values[stat]} ${STAT_LABELS[stat]}, so it was set to 0.`,
        'statPoints',
        stat,
      )
  checkTotal()
  return build
}

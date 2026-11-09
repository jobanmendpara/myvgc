import { MAX_STAT_POINTS, STAT_IDS, type StatId, type StatPoints } from './build'
import { statAlignmentEffect } from './stat-alignment'

/** A species' or form's base stats. */
export type BaseStats = Record<StatId, number>

/** A Pokémon build's final stats at level 50, as the game shows them. Never stored. */
export type StatValues = Record<StatId, number>

/**
 * The stat values for a build, from its species' base stats, Stat Points and Stat Alignment.
 * Showdown's Champions formula (`statModify`), checked against the game: HP is base + SP + 75;
 * every other stat is base + SP + 20, then 10% up or down for the Stat Alignment, rounded down.
 */
export function statValues(
  baseStats: BaseStats,
  statPoints: StatPoints,
  statAlignment?: string,
): StatValues {
  const value = (stat: StatId) => {
    const raw = baseStats[stat] + statPoints[stat]
    if (stat === 'hp') return raw + 75
    const effect = statAlignmentEffect(statAlignment, stat)
    const percent = effect === 'raises' ? 110 : effect === 'lowers' ? 90 : 100
    // Whole numbers, so the rounding can't be thrown off by floating point.
    return Math.floor(((raw + 20) * percent) / 100)
  }
  return {
    hp: value('hp'),
    atk: value('atk'),
    def: value('def'),
    spa: value('spa'),
    spd: value('spd'),
    spe: value('spe'),
  }
}

/** Stat Points worked out from stat values, and the stats no Stat Points could explain. */
export interface StatPointsRead {
  statPoints: StatPoints
  /** Stats whose value no Stat Points give, for this species and Stat Alignment. Given 0. */
  impossible: StatId[]
}

/**
 * The Stat Points behind some stat values, working `statValues` backwards (ADR 24). A missing
 * value gives 0. On a lowered stat, rounding down often lets two Stat Points values give the same
 * stat value; they make the same Pokémon, so the smallest is used.
 */
export function statPointsFromValues(
  baseStats: BaseStats,
  values: Partial<StatValues>,
  statAlignment?: string,
): StatPointsRead {
  const statPoints: StatPoints = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  const impossible: StatId[] = []
  for (const stat of STAT_IDS) {
    const value = values[stat]
    if (value === undefined) continue
    const fits = Array.from({ length: MAX_STAT_POINTS + 1 }, (_, points) => points).filter(
      (points) =>
        statValues(baseStats, { ...statPoints, [stat]: points }, statAlignment)[stat] === value,
    )
    statPoints[stat] = fits[0] ?? 0
    if (fits.length === 0) impossible.push(stat)
  }
  return { statPoints, impossible }
}

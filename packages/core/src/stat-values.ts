import type { StatId, StatPoints } from './build'
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

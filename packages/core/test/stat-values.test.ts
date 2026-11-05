import { describe, expect, it } from 'vitest'
import { championsNames, statAlignmentEffect, statValues } from '../src'

const { baseStats } = championsNames()

describe('statValues', () => {
  // Read off in-game summary screens in Pokémon Champions, 2026-11-05 (DEV-50). Each row: the
  // species, its Stat Alignment, its Stat Points and the stat values the game showed, in the
  // order HP, Atk, Def, SpA, SpD, Spe.
  const fromTheGame = [
    ['charizard', 'timid', [2, 0, 0, 32, 0, 32], [155, 93, 98, 161, 105, 167]],
    ['venusaur', 'calm', [32, 0, 2, 16, 16, 0], [187, 91, 105, 136, 149, 100]],
    ['whimsicott', 'timid', [4, 0, 0, 30, 0, 32], [139, 78, 105, 127, 95, 184]],
    ['kingambit', 'adamant', [32, 32, 0, 0, 0, 2], [207, 205, 140, 72, 105, 72]],
    ['garchomp', 'jolly', [0, 32, 2, 0, 0, 32], [183, 182, 117, 90, 105, 169]],
    ['basculegion', 'adamant', [0, 32, 2, 0, 0, 32], [195, 180, 87, 90, 95, 130]],
  ] as const

  it.each(fromTheGame)('matches the game for %s', (species, alignment, points, shown) => {
    const [hp, atk, def, spa, spd, spe] = points
    expect(statValues(baseStats[species]!, { hp, atk, def, spa, spd, spe }, alignment)).toEqual({
      hp: shown[0],
      atk: shown[1],
      def: shown[2],
      spa: shown[3],
      spd: shown[4],
      spe: shown[5],
    })
  })

  it('applies no Stat Alignment when there is none or it has no effect', () => {
    const points = { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }
    const neutral = { hp: 183, atk: 182, def: 115, spa: 100, spd: 105, spe: 154 }
    expect(statValues(baseStats.garchomp!, points)).toEqual(neutral)
    expect(statValues(baseStats.garchomp!, points, 'serious')).toEqual(neutral)
  })

  it('rounds a raised or lowered stat down', () => {
    // Incineroar's base Speed is 60: (60 + 20) × 0.9 is 72 and (60 + 21) × 1.1 is 89.1.
    const points = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
    expect(statValues(baseStats.incineroar!, points, 'brave').spe).toBe(72)
    expect(statValues(baseStats.incineroar!, { ...points, spe: 1 }, 'jolly').spe).toBe(89)
  })

  it('gives a base stat for every species and form in the names list', () => {
    const { species } = championsNames()
    expect(Object.keys(baseStats).sort()).toEqual(Object.keys(species).sort())
    expect(baseStats.charizardmegay).toEqual({
      hp: 78,
      atk: 104,
      def: 78,
      spa: 159,
      spd: 115,
      spe: 100,
    })
  })
})

describe('statAlignmentEffect', () => {
  it('says which stat a Stat Alignment raises and which it lowers', () => {
    expect(statAlignmentEffect('adamant', 'atk')).toBe('raises')
    expect(statAlignmentEffect('adamant', 'spa')).toBe('lowers')
    expect(statAlignmentEffect('adamant', 'spe')).toBeUndefined()
  })

  it('says nothing for no Stat Alignment, or one with no effect', () => {
    expect(statAlignmentEffect(undefined, 'atk')).toBeUndefined()
    expect(statAlignmentEffect('hardy', 'atk')).toBeUndefined()
  })
})

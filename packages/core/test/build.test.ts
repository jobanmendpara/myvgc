import { describe, expect, it } from 'vitest'
import { champions, pokemonBuildSchema, teamPokemonSchema } from '../src'
import { STAT_ALIGNMENTS, statAlignmentLabel } from '../src/schema'

const NO_POINTS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }

function issues(input: unknown) {
  const result = teamPokemonSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map(({ path, message }) => ({ path, message }))
}

describe('teamPokemonSchema', () => {
  it('needs only a species', () => {
    expect(issues([{ species: 'incineroar', moves: [], statPoints: NO_POINTS }])).toEqual([])
  })

  it('asks for a species when a build has none', () => {
    expect(issues([{ species: '', moves: [], statPoints: NO_POINTS }])).toEqual([
      { path: [0, 'species'], message: 'Choose a species or remove this Pokémon' },
    ])
  })

  it('needs at least one Pokémon build and at most six', () => {
    const one = { species: 'incineroar', moves: [], statPoints: NO_POINTS }
    expect(issues([])).toEqual([{ path: [], message: 'A Team needs at least one Pokémon.' }])
    expect(issues(Array(7).fill(one))).toEqual([
      { path: [], message: 'A Team has at most 6 Pokémon.' },
    ])
  })

  it('rejects the same move twice in a build, at the repeat', () => {
    expect(
      issues([
        { species: 'incineroar', moves: ['fakeout', 'protect', 'fakeout'], statPoints: NO_POINTS },
      ]),
    ).toEqual([{ path: [0, 'moves', 2], message: 'This Pokémon already has this move.' }])
  })

  it('rejects more than four moves', () => {
    expect(
      issues([{ species: 'incineroar', moves: ['a', 'b', 'c', 'd', 'e'], statPoints: NO_POINTS }]),
    ).toEqual([{ path: [0, 'moves'], message: 'A Pokémon has at most 4 moves.' }])
  })

  it('rejects Stat Points over the limit for one stat, by stat', () => {
    expect(
      issues([{ species: 'incineroar', moves: [], statPoints: { ...NO_POINTS, atk: 33 } }]),
    ).toEqual([
      { path: [0, 'statPoints', 'atk'], message: 'The most for one stat is 32 Stat Points.' },
    ])
  })

  it('rejects Stat Points over the total limit', () => {
    expect(
      issues([
        {
          species: 'incineroar',
          moves: [],
          statPoints: { ...NO_POINTS, hp: 32, atk: 32, def: 3 },
        },
      ]),
    ).toEqual([{ path: [0, 'statPoints'], message: 'Stat Points can add up to at most 66' }])
  })

  it('rejects a nickname that would break a line of the paste', () => {
    const result = pokemonBuildSchema.safeParse({
      species: 'incineroar',
      nickname: 'Two\nlines',
      moves: [],
      statPoints: NO_POINTS,
    })
    expect(result.error?.issues[0]?.path).toEqual(['nickname'])
  })
})

describe('STAT_ALIGNMENTS', () => {
  it('matches the Champions data', () => {
    expect(STAT_ALIGNMENTS).toHaveLength(25)
    for (const alignment of STAT_ALIGNMENTS) {
      expect(champions.nature(alignment.id)).toEqual({ id: alignment.id, name: alignment.name })
    }
  })

  it('shows what a Stat Alignment raises and lowers', () => {
    const label = (id: string) => statAlignmentLabel(STAT_ALIGNMENTS.find((a) => a.id === id)!)
    expect(label('adamant')).toBe('Adamant (+Atk −SpA)')
    expect(label('timid')).toBe('Timid (+Spe −Atk)')
    expect(label('hardy')).toBe('Hardy (no effect)')
  })
})

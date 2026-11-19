import { describe, expect, it } from 'vitest'
import { type SeenTeam, championsNames, readSeenTeam, statValues } from '../src'

type SeenBuild = SeenTeam['pokemon'][number]
type Stats = Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>
const noStats = { hp: null, atk: null, def: null, spa: null, spd: null, spe: null }
const { baseStats } = championsNames()

// Garchomp on the sample Replica Team's Stats tab (IMG_5086), Jolly.
const garchompPoints: Stats = { hp: 0, atk: 32, def: 2, spa: 0, spd: 0, spe: 32 }
const garchompValues: Stats = { hp: 183, atk: 182, def: 117, spa: 90, spd: 105, spe: 169 }

/**
 * A Pokémon as its detail screen and the Replica Team's tabs show it, with an empty held-item slot
 * and one move, so no field is flagged as not shown.
 */
const seen = (build: Partial<SeenBuild>): SeenBuild => ({
  species: 'Charizard',
  nickname: 'Garchomp',
  gender: 'male',
  ability: 'Blaze',
  item: null,
  itemShown: true,
  statAlignment: 'Jolly',
  raisedStat: null,
  loweredStat: null,
  moves: ['Protect'],
  statValues: garchompValues,
  statPoints: garchompPoints,
  unsure: [],
  disagreeing: [],
  ...build,
})

/** The draft read from a Replica Team's two tabs and a detail screen. */
function read(build: Partial<SeenBuild>) {
  const result = readSeenTeam({
    images: [{ kind: 'replicaTeamMoves' }, { kind: 'replicaTeamStats' }, { kind: 'pokemonDetail' }],
    battleTeamName: null,
    replicaTeamId: '9TCG84KWXK',
    unsure: [],
    pokemon: [seen(build)],
  })
  if (!result.ok) throw new Error(result.error)
  return result
}

const speciesFlags = (draft: ReturnType<typeof read>) =>
  draft.flags.filter(({ path }) => path[2] === 'species')

describe('readSeenTeam: a nickname that names a species', () => {
  it('flags the species, never changing it, when the stats fit the nickname instead', () => {
    const draft = read({})

    expect(draft.pokemon[0]).toMatchObject({
      species: 'charizard',
      nickname: 'Garchomp',
      nature: 'jolly',
      statPoints: garchompPoints,
    })
    // The species is what to check, so the stats aren't flagged one by one.
    expect(draft.flags).toEqual([
      {
        path: ['pokemon', 0, 'species'],
        message: 'The stats fit Garchomp (the nickname), not Charizard, so check the species.',
      },
    ])
  })

  it("stays quiet when the nickname isn't a species' own name", () => {
    for (const nickname of ['Chorizo', 'Chomp', null]) {
      const draft = read({ nickname })

      expect(draft.pokemon[0]!.species).toBe('charizard')
      expect(speciesFlags(draft)).toEqual([])
      // The numbers check still flags the stats that don't fit Charizard.
      expect(draft.flags.length).toBeGreaterThan(0)
    }
  })

  it('stays quiet when the stats fit the species read', () => {
    expect(read({ species: 'Garchomp', nickname: 'Charizard' }).flags).toEqual([])
  })

  it('stays quiet when the stats fit both', () => {
    // Meowstic's two forms have the same base stats.
    const points: Stats = { hp: 32, atk: 0, def: 2, spa: 0, spd: 0, spe: 32 }

    const draft = read({
      species: 'Meowstic',
      nickname: 'Meowstic-F',
      statPoints: points,
      statValues: statValues(baseStats.meowstic!, points, 'jolly'),
    })

    expect(draft.pokemon[0]!.species).toBe('meowstic')
    expect(draft.flags).toEqual([])
  })

  it('stays quiet when the stats fit neither', () => {
    const draft = read({ statValues: { ...garchompValues, hp: 184 } })

    expect(speciesFlags(draft)).toEqual([])
    expect(draft.flags.length).toBeGreaterThan(0)
  })

  it('stays quiet when no stat has both a value and Stat Points', () => {
    expect(read({ statValues: noStats }).flags).toEqual([])
    expect(speciesFlags(read({ statPoints: noStats }))).toEqual([])
  })
})

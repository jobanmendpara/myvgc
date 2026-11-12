import { describe, expect, it } from 'vitest'
import { MAX_REPLICA_TEAM_ID_LENGTH, nameBuild, newTeamSchema, teamSchema } from '../src'

describe('newTeamSchema', () => {
  it('defaults the Regulation to M-C, and the notes and Replica Team ID to empty', () => {
    expect(newTeamSchema.parse({ name: ' Sun ', paste: 'Incineroar' })).toEqual({
      name: 'Sun',
      regulation: 'M-C',
      paste: 'Incineroar',
      notes: '',
      replicaTeamId: '',
    })
  })

  it.each([
    [{ name: '   ', paste: 'x' }, 'Give the Team a name.'],
    [{ name: 'a'.repeat(101), paste: 'x' }, 'Team names can be at most 100 characters.'],
    [{ name: 'Sun', paste: 'x'.repeat(10_001) }, 'Pastes can be at most 10000 characters.'],
  ])('rejects %j', (input, message) => {
    const result = newTeamSchema.safeParse(input)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(message)
  })

  it('rejects a Regulation that does not exist', () => {
    expect(newTeamSchema.safeParse({ name: 'Sun', regulation: 'H', paste: 'x' }).success).toBe(
      false,
    )
  })
})

describe('newTeamSchema, either way in', () => {
  const pokemon = [
    {
      species: 'incineroar',
      moves: [],
      statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    },
  ]

  it('accepts Pokémon builds in place of a paste', () => {
    expect(newTeamSchema.parse({ name: 'Sun', pokemon }).pokemon).toEqual(pokemon)
  })

  it.each([
    ['neither', { name: 'Sun' }],
    ['both', { name: 'Sun', paste: 'Incineroar', pokemon }],
  ])('rejects %s', (_, input) => {
    expect(newTeamSchema.safeParse(input).error?.issues[0]?.message).toBe(
      'Send either a paste or Pokémon builds.',
    )
  })
})

describe('teamSchema', () => {
  const pokemon = [
    {
      species: 'incineroar',
      moves: [],
      statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    },
  ]

  const whole = { name: 'Sun', regulation: 'M-B', notes: '', replicaTeamId: '', pokemon }

  it('takes the whole Team', () => {
    expect(
      teamSchema.parse({
        name: ' Sun ',
        regulation: 'M-B',
        notes: 'Lead',
        replicaTeamId: '9TCG84KWXK',
        pokemon,
      }),
    ).toEqual({
      name: 'Sun',
      regulation: 'M-B',
      notes: 'Lead',
      replicaTeamId: '9TCG84KWXK',
      pokemon,
    })
  })

  it.each(['name', 'regulation', 'notes', 'replicaTeamId', 'pokemon'])('needs %s', (field) => {
    const input = Object.fromEntries(Object.entries(whole).filter(([key]) => key !== field))
    expect(teamSchema.safeParse(input).error?.issues[0]?.path).toEqual([field])
  })
})

describe('Replica Team ID', () => {
  const pokemon = [
    {
      species: 'incineroar',
      moves: [],
      statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    },
  ]
  const withId = (replicaTeamId: string) =>
    teamSchema.safeParse({ name: 'Sun', regulation: 'M-C', notes: '', replicaTeamId, pokemon })

  it.each([
    ['9TCG84KWXK', '9TCG84KWXK'],
    [' 9tcg84kwxk ', '9TCG84KWXK'],
    ['9TCG 84KW XK', '9TCG84KWXK'],
    ['', ''],
    ['   ', ''],
  ])('reads %j as %j', (input, stored) => {
    expect(withId(input).data?.replicaTeamId).toBe(stored)
  })

  it.each(['9TCG-84KWXK', '9TCG84KWX!', 'A'.repeat(MAX_REPLICA_TEAM_ID_LENGTH + 1)])(
    'rejects %j',
    (input) => {
      const result = withId(input)
      expect(result.error?.issues[0]?.path).toEqual(['replicaTeamId'])
      expect(result.error?.issues[0]?.message).toMatch(/Replica Team ID/)
    },
  )

  it('is kept on a Team made from a paste', () => {
    expect(
      newTeamSchema.parse({ name: 'Sun', paste: 'Incineroar', replicaTeamId: '9tcg84kwxk' })
        .replicaTeamId,
    ).toBe('9TCG84KWXK')
  })
})

describe('nameBuild', () => {
  it('adds display names for every stored ID', () => {
    const named = nameBuild({
      species: 'floetteeternal',
      item: 'floettite',
      ability: 'flowerveil',
      nature: 'timid',
      moves: ['moonblast', 'lightofruin'],
      statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    })
    expect(named.names).toEqual({
      species: 'Floette-Eternal',
      item: 'Floettite',
      ability: 'Flower Veil',
      nature: 'Timid',
      moves: ['Moonblast', 'Light of Ruin'],
    })
  })

  it('leaves out names for fields the build does not have', () => {
    const named = nameBuild({
      species: 'pikachu',
      moves: [],
      statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    })
    expect(named.names).toEqual({ species: 'Pikachu', moves: [] })
  })
})

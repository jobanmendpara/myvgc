import { describe, expect, it } from 'vitest'
import { nameBuild, newTeamSchema } from '../src'

describe('newTeamSchema', () => {
  it('defaults the Regulation to M-C and the notes to empty', () => {
    expect(newTeamSchema.parse({ name: ' Sun ', paste: 'Incineroar' })).toEqual({
      name: 'Sun',
      regulation: 'M-C',
      paste: 'Incineroar',
      notes: '',
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

import { describe, expect, it } from 'vitest'
import {
  type SeenTeam,
  championsNames,
  readSeenTeam,
  seenTeamSchema,
  statValues,
  teamImageType,
} from '../src'

const noStats = { hp: null, atk: null, def: null, spa: null, spd: null, spe: null }

type SeenBuild = SeenTeam['pokemon'][number]
const seen = (build: Partial<SeenBuild> = {}): SeenBuild => ({
  species: 'Charizard',
  ability: 'Solar Power',
  item: 'Charizardite Y',
  statAlignment: 'Timid',
  moves: ['Heat Wave', 'Weather Ball', 'Solar Beam', 'Protect'],
  statValues: noStats,
  statPoints: noStats,
  unsure: [],
  ...build,
})

describe('readSeenTeam', () => {
  it('matches the names seen to Showdown IDs and keeps the Battle Team name', () => {
    const read = readSeenTeam({
      name: ' 9TCG84KWXK ',
      pokemon: [seen({ statPoints: { ...noStats, hp: 2, spa: 32, spe: 32 } })],
    })

    expect(read).toEqual({
      name: '9TCG84KWXK',
      pokemon: [
        {
          species: 'charizard',
          ability: 'solarpower',
          item: 'charizarditey',
          nature: 'timid',
          moves: ['heatwave', 'weatherball', 'solarbeam', 'protect'],
          statPoints: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
        },
      ],
      flags: [],
    })
  })

  it('works Stat Points out from stat values when only those are shown', () => {
    const statPoints = { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 }
    const values = statValues(championsNames().baseStats.charizard!, statPoints, 'timid')

    const read = readSeenTeam({ name: '', pokemon: [seen({ statValues: values })] })

    expect(read.pokemon[0]!.statPoints).toEqual(statPoints)
    expect(read.flags).toEqual([])
  })

  it('flags names it can not match, impossible Stat Points and what the reader was unsure of', () => {
    const read = readSeenTeam({
      name: '',
      pokemon: [
        seen({
          item: 'Charcoal Biscuit',
          statPoints: { ...noStats, spe: 40 },
          unsure: ['ability', 'ability', 'statAlignment'],
        }),
      ],
    })

    expect(read.pokemon[0]).not.toHaveProperty('item')
    expect(read.pokemon[0]!.statPoints.spe).toBe(0)
    expect(read.flags).toEqual([
      { path: ['pokemon', 0, 'item'], message: 'Couldn\'t read "Charcoal Biscuit".' },
      {
        path: ['pokemon', 0, 'statPoints', 'spe'],
        message: "40 Spe Stat Points isn't possible, so it was set to 0.",
      },
      {
        path: ['pokemon', 0, 'ability'],
        message: 'The ability was hard to make out, so check it.',
      },
      {
        path: ['pokemon', 0, 'nature'],
        message: 'The Stat Alignment was hard to make out, so check it.',
      },
    ])
  })

  it('reads at most six Pokémon and four moves, and skips ones with no species', () => {
    const read = readSeenTeam({
      name: '',
      pokemon: [
        seen({ species: ' ', moves: [] }),
        ...Array.from({ length: 7 }, () =>
          seen({ moves: ['Protect', 'Tailwind', 'Roost', 'Fly', 'Ember'] }),
        ),
      ],
    })

    expect(read.pokemon).toHaveLength(6)
    expect(read.pokemon[0]!.moves).toEqual(['protect', 'tailwind', 'roost', 'fly'])
    expect(read.flags).toContainEqual({
      path: ['pokemon', 0, 'moves'],
      message: 'More than 4 moves were seen, so only the first 4 were read.',
    })
    expect(read.flags).toContainEqual({
      path: ['pokemon', 5],
      message: '7 Pokémon were seen, so only the first 6 were read.',
    })
  })

  it('has a schema the reader output is checked against', () => {
    expect(seenTeamSchema.safeParse({ name: '', pokemon: [seen()] }).success).toBe(true)
    expect(
      seenTeamSchema.safeParse({ name: '', pokemon: [{ species: 'Charizard' }] }).success,
    ).toBe(false)
  })
})

describe('teamImageType', () => {
  const bytes = (...start: number[]) => new Uint8Array([...start, 0, 0, 0, 0, 0, 0, 0, 0])

  it('knows PNG, JPEG and WebP by their first bytes', () => {
    expect(teamImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
    expect(teamImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(teamImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe(
      'image/webp',
    )
  })

  it("doesn't take other files, such as a PDF or HEIC", () => {
    expect(teamImageType(new TextEncoder().encode('%PDF-1.7'))).toBeUndefined()
    expect(
      teamImageType(bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63)),
    ).toBe(undefined)
  })
})

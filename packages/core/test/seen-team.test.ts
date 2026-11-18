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

/** What a reader saw of a Team: no Battle Team name or Replica Team ID unless given. */
const team = (pokemon: SeenBuild[], fields: Partial<Omit<SeenTeam, 'pokemon'>> = {}): SeenTeam => ({
  battleTeamName: null,
  replicaTeamId: null,
  unsure: [],
  pokemon,
  ...fields,
})

describe('readSeenTeam', () => {
  it('matches the names seen to Showdown IDs and keeps the Battle Team name and Replica Team ID', () => {
    const read = readSeenTeam(
      team([seen({ statPoints: { ...noStats, hp: 2, spa: 32, spe: 32 } })], {
        battleTeamName: ' Sun Room ',
        replicaTeamId: '9TCG84KWXK',
      }),
    )

    expect(read).toEqual({
      name: 'Sun Room',
      replicaTeamId: '9TCG84KWXK',
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

    const read = readSeenTeam(team([seen({ statValues: values })]))

    expect(read.pokemon[0]!.statPoints).toEqual(statPoints)
    expect(read.flags).toEqual([])
  })

  it('takes Stat Points where shown and works the other stats out from their values', () => {
    const statPoints = { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 }
    const values = statValues(championsNames().baseStats.charizard!, statPoints, 'timid')

    const read = readSeenTeam(
      team([seen({ statValues: { ...values, spa: 1 }, statPoints: { ...noStats, spa: 32 } })]),
    )

    expect(read.pokemon[0]!.statPoints).toEqual(statPoints)
    expect(read.flags).toEqual([])
  })

  it('flags names it can not match, impossible Stat Points and what the reader was unsure of', () => {
    const read = readSeenTeam(
      team([
        seen({
          item: 'Charcoal Biscuit',
          statPoints: { ...noStats, spe: 40 },
          unsure: ['ability', 'ability', 'statAlignment'],
        }),
      ]),
    )

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
    const read = readSeenTeam(
      team([
        seen({ species: ' ', moves: [] }),
        ...Array.from({ length: 7 }, () =>
          seen({ moves: ['Protect', 'Tailwind', 'Roost', 'Fly', 'Ember'] }),
        ),
      ]),
    )

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

  it('leaves the name blank, with no flag, when no Battle Team name is shown', () => {
    const read = readSeenTeam(team([seen()], { replicaTeamId: '9TCG84KWXK' }))

    expect(read.name).toBe('')
    expect(read.replicaTeamId).toBe('9TCG84KWXK')
    expect(read.flags).toEqual([])
  })

  it('stores the Replica Team ID as the Team schema does', () => {
    expect(readSeenTeam(team([seen()], { replicaTeamId: ' 9tcg 84kwxk ' })).replicaTeamId).toBe(
      '9TCG84KWXK',
    )
    expect(readSeenTeam(team([seen()], { replicaTeamId: '' })).replicaTeamId).toBe('')
  })

  it("leaves a Replica Team ID that isn't valid blank, with a flag giving what was read", () => {
    const read = readSeenTeam(team([seen()], { replicaTeamId: '9TCG84KWX!' }))

    expect(read.replicaTeamId).toBe('')
    expect(read.flags).toEqual([
      {
        path: ['replicaTeamId'],
        message: '"9TCG84KWX!" isn\'t a Replica Team ID, so it was left blank.',
      },
    ])
  })

  it('flags a Replica Team ID or Battle Team name that was hard to make out', () => {
    const read = readSeenTeam(
      team([seen()], {
        battleTeamName: 'Sun Room',
        replicaTeamId: '9TCG84KWXK',
        unsure: ['replicaTeamId', 'battleTeamName', 'replicaTeamId'],
      }),
    )

    expect(read.replicaTeamId).toBe('9TCG84KWXK')
    expect(read.flags).toEqual([
      {
        path: ['replicaTeamId'],
        message: 'The Replica Team ID was hard to make out, so check it.',
      },
      { path: ['name'], message: 'The Team name was hard to make out, so check it.' },
    ])
  })

  it('gives an ID left blank one flag, even when the reader was unsure of it', () => {
    const invalid = readSeenTeam(
      team([seen()], { replicaTeamId: '9TCG_84KWXK', unsure: ['replicaTeamId'] }),
    )
    expect(invalid.flags.map(({ message }) => message)).toEqual([
      '"9TCG_84KWXK" isn\'t a Replica Team ID, so it was left blank.',
    ])
    expect(readSeenTeam(team([seen()], { unsure: ['replicaTeamId'] })).flags).toEqual([])
  })

  it('has a schema the reader output is checked against', () => {
    expect(seenTeamSchema.safeParse(team([seen()])).success).toBe(true)
    expect(seenTeamSchema.safeParse(team([{ species: 'Charizard' } as SeenBuild])).success).toBe(
      false,
    )
    expect(seenTeamSchema.safeParse({ name: '', pokemon: [seen()] }).success).toBe(false)
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

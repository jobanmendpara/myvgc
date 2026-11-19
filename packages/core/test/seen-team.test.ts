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
  nickname: null,
  gender: null,
  ability: 'Solar Power',
  item: 'Charizardite Y',
  statAlignment: 'Timid',
  moves: ['Heat Wave', 'Weather Ball', 'Solar Beam', 'Protect'],
  statValues: noStats,
  statPoints: noStats,
  unsure: [],
  ...build,
})

/**
 * What a reader saw of a Team on a Replica Team's two tabs: no Battle Team name or Replica Team ID
 * unless given.
 */
const team = (pokemon: SeenBuild[], fields: Partial<Omit<SeenTeam, 'pokemon'>> = {}): SeenTeam => ({
  images: [{ kind: 'replicaTeamMoves' }, { kind: 'replicaTeamStats' }],
  battleTeamName: null,
  replicaTeamId: null,
  unsure: [],
  pokemon,
  ...fields,
})

/** The draft a read makes, failing the test when the read fails. */
function readDraft(seen: SeenTeam) {
  const read = readSeenTeam(seen)
  if (!read.ok) throw new Error(read.error)
  return read
}

describe('readSeenTeam', () => {
  it('matches the names seen to Showdown IDs and keeps the Battle Team name and Replica Team ID', () => {
    const read = readDraft(
      team([seen({ statPoints: { ...noStats, hp: 2, spa: 32, spe: 32 } })], {
        battleTeamName: ' Sun Room ',
        replicaTeamId: '9TCG84KWXK',
      }),
    )

    expect(read).toEqual({
      ok: true,
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

    const read = readDraft(team([seen({ statValues: values })]))

    expect(read.pokemon[0]!.statPoints).toEqual(statPoints)
    expect(read.flags).toEqual([])
  })

  it('takes Stat Points where shown and works the other stats out from their values', () => {
    const statPoints = { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 }
    const values = statValues(championsNames().baseStats.charizard!, statPoints, 'timid')

    const read = readDraft(
      team([seen({ statValues: { ...values, spa: 1 }, statPoints: { ...noStats, spa: 32 } })]),
    )

    expect(read.pokemon[0]!.statPoints).toEqual(statPoints)
    expect(read.flags).toEqual([])
  })

  it('flags names it can not match, impossible Stat Points and what the reader was unsure of', () => {
    const read = readDraft(
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

  it('keeps the nickname exactly as shown, and the gender, in the Pokémon build', () => {
    const read = readDraft(team([seen({ nickname: ' Bad Sushi ', gender: 'male' })]))

    expect(read.pokemon[0]).toMatchObject({
      species: 'charizard',
      nickname: 'Bad Sushi',
      gender: 'M',
    })
    expect(readDraft(team([seen({ gender: 'female' })])).pokemon[0]!.gender).toBe('F')
    expect(readDraft(team([seen()])).pokemon[0]).not.toHaveProperty('gender')
    expect(readDraft(team([seen()])).pokemon[0]).not.toHaveProperty('nickname')
  })

  it('drops a nickname equal to the species text as read, ignoring case and spaces', () => {
    for (const nickname of ['Charizard', ' charizard ', ''])
      expect(readDraft(team([seen({ nickname })])).pokemon[0]).not.toHaveProperty('nickname')

    // Compared with the text read, not the form chosen, so the female form keeps no nickname.
    const basculegion = readDraft(
      team([seen({ species: 'Basculegion', nickname: 'BASCULEGION', gender: 'female' })]),
    ).pokemon[0]!
    expect(basculegion.species).toBe('basculegionf')
    expect(basculegion).not.toHaveProperty('nickname')
  })

  it('never swaps the species with a nickname that names a species', () => {
    const read = readDraft(team([seen({ species: 'Charizerd', nickname: 'Garchomp' })]))

    expect(read.pokemon[0]).toMatchObject({ species: '', nickname: 'Garchomp' })
    expect(read.flags).toContainEqual({
      path: ['pokemon', 0, 'species'],
      message: 'Couldn\'t read "Charizerd".',
    })
  })

  it('chooses the gender form of Meowstic, Indeedee and Basculegion from the gender', () => {
    const species = (name: string, gender: SeenBuild['gender']) => {
      const read = readDraft(team([seen({ species: name, gender })]))
      return { species: read.pokemon[0]!.species, flags: read.flags }
    }

    expect(species('Meowstic', 'female')).toEqual({ species: 'meowsticf', flags: [] })
    expect(species('Indeedee', 'female')).toEqual({ species: 'indeedeef', flags: [] })
    expect(species('Basculegion', 'female')).toEqual({ species: 'basculegionf', flags: [] })
    expect(species('Basculegion', 'male')).toEqual({ species: 'basculegion', flags: [] })
    // Other species keep their own form whatever the gender.
    expect(species('Charizard', 'female')).toEqual({ species: 'charizard', flags: [] })
  })

  it('keeps the base form, with a flag, when a gender form shows no gender', () => {
    const read = readDraft(team([seen({ species: 'Basculegion' })]))

    expect(read.pokemon[0]!.species).toBe('basculegion')
    expect(read.flags).toEqual([
      {
        path: ['pokemon', 0, 'species'],
        message: 'No gender was shown, so check whether this is the female form.',
      },
    ])
  })

  it('takes a form named in the text over the gender, with a flag when they contradict', () => {
    const read = (name: string, gender: SeenBuild['gender']) =>
      readDraft(team([seen({ species: name, gender })]))
    const contradiction = {
      path: ['pokemon', 0, 'species'],
      message: "The form shown doesn't match the gender shown, so check them.",
    }

    expect(read('Meowstic-F', 'female')).toMatchObject({
      pokemon: [{ species: 'meowsticf', gender: 'F' }],
      flags: [],
    })
    expect(read('Meowstic-F', null)).toMatchObject({
      pokemon: [{ species: 'meowsticf' }],
      flags: [],
    })
    expect(read('Meowstic-F', 'male')).toMatchObject({
      pokemon: [{ species: 'meowsticf', gender: 'M' }],
      flags: [contradiction],
    })
    expect(read('Indeedee-M', 'female')).toMatchObject({
      pokemon: [{ species: 'indeedee', gender: 'F' }],
      flags: [contradiction],
    })
  })

  it('flags a nickname or gender that was hard to make out', () => {
    const read = readDraft(
      team([seen({ nickname: 'Chorizo', gender: 'male', unsure: ['nickname', 'gender'] })]),
    )

    expect(read.flags).toEqual([
      {
        path: ['pokemon', 0, 'nickname'],
        message: 'The nickname was hard to make out, so check it.',
      },
      { path: ['pokemon', 0, 'gender'], message: 'The gender was hard to make out, so check it.' },
    ])
  })

  it('reads at most six Pokémon and four moves, and skips ones with no species', () => {
    const read = readDraft(
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
    const read = readDraft(team([seen()], { replicaTeamId: '9TCG84KWXK' }))

    expect(read.name).toBe('')
    expect(read.replicaTeamId).toBe('9TCG84KWXK')
    expect(read.flags).toEqual([])
  })

  it('stores the Replica Team ID as the Team schema does', () => {
    expect(readDraft(team([seen()], { replicaTeamId: ' 9tcg 84kwxk ' })).replicaTeamId).toBe(
      '9TCG84KWXK',
    )
    expect(readDraft(team([seen()], { replicaTeamId: '' })).replicaTeamId).toBe('')
  })

  it("leaves a Replica Team ID that isn't valid blank, with a flag giving what was read", () => {
    const read = readDraft(team([seen()], { replicaTeamId: '9TCG84KWX!' }))

    expect(read.replicaTeamId).toBe('')
    expect(read.flags).toEqual([
      {
        path: ['replicaTeamId'],
        message: '"9TCG84KWX!" isn\'t a Replica Team ID, so it was left blank.',
      },
    ])
  })

  it('flags a Replica Team ID or Battle Team name that was hard to make out', () => {
    const read = readDraft(
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
    const invalid = readDraft(
      team([seen()], { replicaTeamId: '9TCG_84KWXK', unsure: ['replicaTeamId'] }),
    )
    expect(invalid.flags.map(({ message }) => message)).toEqual([
      '"9TCG_84KWXK" isn\'t a Replica Team ID, so it was left blank.',
    ])
    expect(readDraft(team([seen()], { unsure: ['replicaTeamId'] })).flags).toEqual([])
  })

  it('flags each unsupported image by its place in the upload, and reads the rest', () => {
    const read = readDraft(
      team([seen()], {
        images: [
          { kind: 'replicaTeamMoves' },
          { kind: 'unsupported' },
          { kind: 'pokemonDetail' },
          { kind: 'unsupported' },
        ],
      }),
    )

    expect(read.pokemon).toHaveLength(1)
    expect(read.flags).toEqual([
      {
        path: ['images', 1],
        message:
          "Image 2 isn't a Replica Team or Pokémon detail screen, so nothing was read from it.",
      },
      {
        path: ['images', 3],
        message:
          "Image 4 isn't a Replica Team or Pokémon detail screen, so nothing was read from it.",
      },
    ])
  })

  it('fails when no image is a supported screen', () => {
    expect(
      readSeenTeam(team([seen()], { images: [{ kind: 'unsupported' }, { kind: 'unsupported' }] })),
    ).toEqual({
      ok: false,
      error: 'None of these images is a Replica Team or a Pokémon detail screen.',
    })
  })

  it('fails when the supported screens show no Pokémon', () => {
    expect(readSeenTeam(team([seen({ species: ' ' })]))).toEqual({
      ok: false,
      error: "MyVGC couldn't find a Team's Pokémon on these images.",
    })
  })

  it('has a schema the reader output is checked against', () => {
    expect(seenTeamSchema.safeParse(team([seen()])).success).toBe(true)
    expect(seenTeamSchema.safeParse(team([{ species: 'Charizard' } as SeenBuild])).success).toBe(
      false,
    )
    expect(seenTeamSchema.safeParse({ name: '', pokemon: [seen()] }).success).toBe(false)
    expect(
      seenTeamSchema.safeParse(team([seen()], { images: [{ kind: 'battle' as 'unsupported' }] }))
        .success,
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

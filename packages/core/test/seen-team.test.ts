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
  itemShown: true,
  statAlignment: 'Timid',
  raisedStat: null,
  loweredStat: null,
  moves: ['Heat Wave', 'Weather Ball', 'Solar Beam', 'Protect'],
  statValues: noStats,
  statPoints: { ...noStats, hp: 2, spa: 32, spe: 32 },
  unsure: [],
  disagreeing: [],
  ...build,
})

/** What a reader saw of a Team on a Replica Team's two tabs: no Battle Team name unless given. */
const team = (pokemon: SeenBuild[], fields: Partial<Omit<SeenTeam, 'pokemon'>> = {}): SeenTeam => ({
  images: [{ kind: 'replicaTeamMoves' }, { kind: 'replicaTeamStats' }],
  battleTeamName: null,
  replicaTeamId: '9TCG84KWXK',
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

    const read = readDraft(team([seen({ statValues: values, statPoints: noStats })]))

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
    // The Stat Points shown win, and the value that doesn't match them is flagged.
    expect(read.flags).toEqual([
      {
        path: ['pokemon', 0, 'statPoints', 'spa'],
        message: "1 Sp. Atk doesn't match 32 Sp. Atk Stat Points, so check them.",
      },
    ])
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

  it('reads the Male or Female a detail screen writes after a gender form as its form', () => {
    // A detail screen writes "No. 902 Basculegion Male" (DEV-163), and the model sometimes keeps
    // the word in the species.
    const read = (name: string, gender: SeenBuild['gender']) =>
      readDraft(team([seen({ species: name, gender })]))
    const contradiction = {
      path: ['pokemon', 0, 'species'],
      message: "The form shown doesn't match the gender shown, so check them.",
    }

    for (const name of ['Basculegion-Male', 'Basculegion Male', 'Basculegion (Male)'])
      expect(read(name, 'male')).toMatchObject({
        pokemon: [{ species: 'basculegion', gender: 'M' }],
        flags: [],
      })
    expect(read('Basculegion-Female', 'female')).toMatchObject({
      pokemon: [{ species: 'basculegionf', gender: 'F' }],
      flags: [],
    })
    expect(read('Indeedee Female', null)).toMatchObject({
      pokemon: [{ species: 'indeedeef' }],
      flags: [],
    })
    expect(read('Meowstic Male', null)).toMatchObject({
      pokemon: [{ species: 'meowstic' }],
      flags: [],
    })
    expect(read('Basculegion-Male', 'female')).toMatchObject({
      pokemon: [{ species: 'basculegion', gender: 'F' }],
      flags: [contradiction],
    })
    // Only the gender forms: any other species with a gender word still doesn't match.
    expect(read('Charizard-Male', 'male')).toMatchObject({
      pokemon: [{ species: '' }],
      flags: [{ path: ['pokemon', 0, 'species'], message: 'Couldn\'t read "Charizard-Male".' }],
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
    expect(
      readDraft(team([seen()], { replicaTeamId: null, unsure: ['replicaTeamId'] })).flags,
    ).toEqual([
      {
        path: ['replicaTeamId'],
        message: "The Replica Team ID couldn't be read from the Replica Team tabs, so type it in.",
      },
    ])
  })

  it("asks for the Replica Team ID to be typed in, not for another tab, when a tab was read but the ID wasn't", () => {
    const fromTab = (kind: 'replicaTeamMoves' | 'replicaTeamStats') =>
      readDraft(
        team([seen()], {
          images: [{ kind }, { kind: 'pokemonDetail' }],
          replicaTeamId: null,
        }),
      ).flags
    for (const kind of ['replicaTeamMoves', 'replicaTeamStats'] as const)
      expect(fromTab(kind)).toContainEqual({
        path: ['replicaTeamId'],
        message: "The Replica Team ID couldn't be read from the Replica Team tab, so type it in.",
      })
    expect(readDraft(team([seen()], { replicaTeamId: ' ' })).flags).toEqual([
      {
        path: ['replicaTeamId'],
        message: "The Replica Team ID couldn't be read from the Replica Team tabs, so type it in.",
      },
    ])
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
    // HP is never raised or lowered.
    expect(seenTeamSchema.safeParse(team([seen({ raisedStat: 'hp' as 'atk' })])).success).toBe(
      false,
    )
  })
})

describe('readSeenTeam: the Stat Alignment', () => {
  const { baseStats } = championsNames()
  type Shown = Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>
  const asStats = ([hp, atk, def, spa, spd, spe]: readonly number[]): Shown => ({
    hp: hp!,
    atk: atk!,
    def: def!,
    spa: spa!,
    spd: spd!,
    spe: spe!,
  })

  // The sample Replica Team's Stats tab (IMG_5086): each Pokémon's ▲ and ▼ stats, the Stat
  // Alignment its detail screen names, and its Stat Points and stat values, in the order HP, Atk,
  // Def, SpA, SpD, Spe.
  const statsTab = [
    ['Charizard', 'spe', 'atk', 'timid', [2, 0, 0, 32, 0, 32], [155, 93, 98, 161, 105, 167]],
    ['Venusaur', 'spd', 'atk', 'calm', [32, 0, 2, 16, 16, 0], [187, 91, 105, 136, 149, 100]],
    ['Whimsicott', 'spe', 'atk', 'timid', [4, 0, 0, 30, 0, 32], [139, 78, 105, 127, 95, 184]],
    ['Kingambit', 'atk', 'spa', 'adamant', [32, 32, 0, 0, 0, 2], [207, 205, 140, 72, 105, 72]],
    ['Garchomp', 'spe', 'spa', 'jolly', [0, 32, 2, 0, 0, 32], [183, 182, 117, 90, 105, 169]],
    ['Basculegion', 'atk', 'spa', 'adamant', [0, 32, 2, 0, 0, 32], [195, 180, 87, 90, 95, 130]],
  ] as const

  /**
   * A Pokémon as the Stats tab shows it: stat values and Stat Points, and no name. It keeps the
   * Moves & More tab's fields from `seen`, so only the Stats tab's flags show.
   */
  const onStatsTab = (
    species: string,
    points: readonly number[],
    values: readonly number[],
    build: Partial<SeenBuild> = {},
  ) =>
    seen({
      species,
      gender: 'male',
      statAlignment: null,
      statPoints: asStats(points),
      statValues: asStats(values),
      ...build,
    })

  /** Garchomp's stat values with no Stat Alignment's effect. */
  const neutralGarchomp = (points: readonly number[]) =>
    Object.values(statValues(baseStats.garchomp!, asStats(points))) as number[]

  it("works out every sample Pokémon's Stat Alignment from the Stats tab's arrows", () => {
    const read = readDraft(
      team(
        statsTab.map(([species, raisedStat, loweredStat, , points, values]) =>
          onStatsTab(species, points, values, { raisedStat, loweredStat }),
        ),
      ),
    )

    expect(read.pokemon.map((build) => build.nature)).toEqual(statsTab.map((row) => row[3]))
    expect(read.pokemon.map((build) => build.statPoints)).toEqual(
      statsTab.map((row) => asStats(row[4])),
    )
    expect(read.flags).toEqual([])
  })

  it("doesn't flag a lowered stat that two Stat Points values give", () => {
    // Kingambit's Adamant Sp. Atk is 72 with 0 or 1 Stat Points (ADR 24). The sample has 0; this
    // one moves a Stat Point from HP to Sp. Atk.
    const [species, raisedStat, loweredStat] = statsTab[3]
    const read = readDraft(
      team([
        onStatsTab(species, [31, 32, 0, 1, 0, 2], [206, 205, 140, 72, 105, 72], {
          raisedStat,
          loweredStat,
        }),
      ]),
    )

    expect(read.pokemon[0]!.statPoints.spa).toBe(1)
    expect(read.flags).toEqual([])
  })

  it('takes the name shown over the arrows', () => {
    const read = readDraft(
      team([seen({ statAlignment: 'Timid', raisedStat: 'atk', loweredStat: 'spa' })]),
    )

    expect(read.pokemon[0]!.nature).toBe('timid')
    expect(read.flags).toEqual([])
  })

  it('gives Serious, with no flag, when a Stats tab was read and shows no arrows', () => {
    const points = [0, 32, 0, 0, 0, 32]

    const read = readDraft(team([onStatsTab('Garchomp', points, neutralGarchomp(points))]))

    expect(read.pokemon[0]!.nature).toBe('serious')
    expect(read.flags).toEqual([])
  })

  it('leaves the Stat Alignment blank, flagged as not shown, when no Stats tab or name shows it', () => {
    const read = readDraft(
      team([seen({ statAlignment: null })], { images: [{ kind: 'replicaTeamMoves' }] }),
    )

    expect(read.pokemon[0]).not.toHaveProperty('nature')
    expect(read.flags).toEqual([
      { path: ['pokemon', 0, 'nature'], message: "The Stat Alignment wasn't shown." },
      {
        path: ['nature'],
        message:
          "No screenshot showed the Stat Alignment. Add the Replica Team's Stats tab or detail screens, or fill it in.",
      },
    ])
  })

  it("leaves the Stat Alignment blank, with flags, when the arrows can't be one", () => {
    const [species, , , , points, values] = statsTab[3]
    const read = (arrows: Partial<SeenBuild>) =>
      readDraft(team([onStatsTab(species, points, values, arrows)]))
    const noStatAlignment = {
      path: ['pokemon', 0, 'statPoints'],
      message: 'Stat Points were worked out with no Stat Alignment, so check them.',
    }

    const oneArrow = read({ raisedStat: 'atk' })
    expect(oneArrow.pokemon[0]).not.toHaveProperty('nature')
    expect(oneArrow.pokemon[0]!.statPoints).toEqual(asStats(points))
    expect(oneArrow.flags).toEqual([
      {
        path: ['pokemon', 0, 'nature'],
        message: 'The arrows showed ▲ Attack and no ▼, so the Stat Alignment was left blank.',
      },
      noStatAlignment,
    ])
    expect(read({ loweredStat: 'spe' }).flags[0]!.message).toBe(
      'The arrows showed ▼ Speed and no ▲, so the Stat Alignment was left blank.',
    )
    const sameStat = read({ raisedStat: 'spa', loweredStat: 'spa' })
    expect(sameStat.pokemon[0]).not.toHaveProperty('nature')
    expect(sameStat.flags).toEqual([
      {
        path: ['pokemon', 0, 'nature'],
        message: 'The arrows showed ▲ Sp. Atk and ▼ Sp. Atk, so the Stat Alignment was left blank.',
      },
      noStatAlignment,
    ])
  })

  it('flags the Stat Alignment, naming the one the stats fit, but keeps it', () => {
    const [species, , , , points, values] = statsTab[4]

    const read = readDraft(
      team([onStatsTab(species, points, values, { statAlignment: 'Adamant' })]),
    )

    expect(read.pokemon[0]!.nature).toBe('adamant')
    expect(read.pokemon[0]!.statPoints).toEqual(asStats(points))
    expect(read.flags).toEqual([
      {
        path: ['pokemon', 0, 'nature'],
        message: 'The stats fit Jolly, not Adamant, so check the Stat Alignment.',
      },
    ])
  })

  it('names a neutral Stat Alignment when the stats fit one', () => {
    const points = [0, 32, 0, 0, 0, 32]
    const values = neutralGarchomp(points)

    const read = readDraft(
      team([onStatsTab('Garchomp', points, values, { raisedStat: 'spe', loweredStat: 'spa' })]),
    )

    expect(read.pokemon[0]!.nature).toBe('jolly')
    expect(read.flags).toEqual([
      {
        path: ['pokemon', 0, 'nature'],
        message: 'The stats fit Serious, not Jolly, so check the Stat Alignment.',
      },
    ])
    // A neutral Stat Alignment isn't flagged for fitting another neutral one.
    expect(
      readDraft(team([onStatsTab('Garchomp', points, values, { statAlignment: 'Hardy' })])).flags,
    ).toEqual([])
  })

  it('flags each stat no other Stat Alignment explains, keeping the Stat Points shown', () => {
    const garchomp = (shown: Partial<Shown>) =>
      readDraft(
        team([
          seen({
            species: 'Garchomp',
            statAlignment: 'Adamant',
            statPoints: { ...noStats, hp: 0, spe: 32 },
            statValues: { ...noStats, ...shown },
          }),
        ]),
      )

    // Only Speed is shown, and four Stat Alignments raise it, so the stat is flagged.
    const speed = garchomp({ spe: 169 })
    expect(speed.pokemon[0]!.statPoints.spe).toBe(32)
    expect(speed.flags).toEqual([
      {
        path: ['pokemon', 0, 'statPoints', 'spe'],
        message: "169 Speed doesn't match 32 Speed Stat Points, so check them.",
      },
    ])
    // No Stat Alignment changes HP.
    expect(garchomp({ hp: 190 }).flags).toEqual([
      {
        path: ['pokemon', 0, 'statPoints', 'hp'],
        message: "190 HP doesn't match 0 HP Stat Points, so check them.",
      },
    ])
  })

  it('checks only HP when there is no Stat Alignment', () => {
    const [species, , , , points, values] = statsTab[4]
    const read = (shown: readonly number[]) =>
      readDraft(
        team([onStatsTab(species, points, shown)], { images: [{ kind: 'replicaTeamMoves' }] }),
      )

    const statPointsFlags = (shown: readonly number[]) =>
      read(shown).flags.filter(({ path }) => path[2] === 'statPoints')
    expect(statPointsFlags(values)).toEqual([])
    expect(statPointsFlags([184, ...values.slice(1)])).toEqual([
      {
        path: ['pokemon', 0, 'statPoints', 'hp'],
        message: "184 HP doesn't match 0 HP Stat Points, so check them.",
      },
    ])
  })
})

describe("readSeenTeam: fields the images didn't show, and images that disagree", () => {
  const venusaur = (build: Partial<SeenBuild> = {}) =>
    seen({
      species: 'Venusaur',
      ability: 'Overgrow',
      item: 'Sitrus Berry',
      statAlignment: 'Calm',
      moves: ['Giga Drain', 'Sludge Bomb', 'Sleep Powder', 'Protect'],
      statPoints: { ...noStats, hp: 32, def: 2, spa: 16, spd: 16 },
      ...build,
    })
  const detailScreens: Partial<SeenTeam> = {
    images: [{ kind: 'pokemonDetail' }, { kind: 'pokemonDetail' }],
  }

  it('flags every held item and the Replica Team ID when only detail screens were read', () => {
    const notShown = { item: null, itemShown: false }
    const read = readDraft(
      team([seen(notShown), venusaur(notShown)], { ...detailScreens, replicaTeamId: null }),
    )

    expect(read.pokemon.map((build) => build.item)).toEqual([undefined, undefined])
    expect(read.flags).toEqual([
      {
        path: ['replicaTeamId'],
        message: 'No screenshot showed the Replica Team ID. Add a Replica Team tab, or type it in.',
      },
      { path: ['pokemon', 0, 'item'], message: "The held item wasn't shown." },
      { path: ['pokemon', 1, 'item'], message: "The held item wasn't shown." },
      {
        path: ['item'],
        message:
          "No screenshot showed the held items. Add the Replica Team's Moves & More tab, or fill them in.",
      },
    ])
  })

  it('says "held item" when only one Pokémon is missing it', () => {
    const read = readDraft(
      team([seen({ item: null, itemShown: false }), venusaur()], detailScreens),
    )

    expect(read.flags.map(({ message }) => message)).toEqual([
      "The held item wasn't shown.",
      "No screenshot showed the held item. Add the Replica Team's Moves & More tab, or fill it in.",
    ])
  })

  it('takes an empty held-item slot as no item, with no flag', () => {
    const read = readDraft(team([seen({ item: null, itemShown: true })]))

    expect(read.pokemon[0]).not.toHaveProperty('item')
    expect(read.flags).toEqual([])
  })

  it('flags nothing, Stat Alignments included, when the Replica Team pair was read', () => {
    const read = readDraft(
      team([seen({ statAlignment: null, raisedStat: 'spe', loweredStat: 'atk' })]),
    )

    expect(read.pokemon[0]!.nature).toBe('timid')
    expect(read.flags).toEqual([])
  })

  it('flags abilities and moves, and held items, when only the Stats tab was read', () => {
    const statsOnly = { ability: null, item: null, itemShown: false, moves: [] }
    const read = readDraft(
      team([seen(statsOnly), venusaur(statsOnly)], { images: [{ kind: 'replicaTeamStats' }] }),
    )

    expect(read.flags).toEqual([
      { path: ['pokemon', 0, 'item'], message: "The held item wasn't shown." },
      { path: ['pokemon', 0, 'ability'], message: "The ability and moves weren't shown." },
      { path: ['pokemon', 1, 'item'], message: "The held item wasn't shown." },
      { path: ['pokemon', 1, 'ability'], message: "The ability and moves weren't shown." },
      {
        path: ['item'],
        message:
          "No screenshot showed the held items. Add the Replica Team's Moves & More tab, or fill them in.",
      },
      {
        path: ['ability'],
        message:
          "No screenshot showed the abilities and moves. Add the Replica Team's Moves & More tab or detail screens, or fill them in.",
      },
    ])
  })

  it('flags only the moves when the abilities were shown', () => {
    const read = readDraft(team([seen({ moves: [' '] })]))

    expect(read.flags).toEqual([
      { path: ['pokemon', 0, 'moves'], message: "The moves weren't shown." },
      {
        path: ['moves'],
        message:
          "No screenshot showed the moves. Add the Replica Team's Moves & More tab or detail screens, or fill them in.",
      },
    ])
  })

  it('gives one flag for a missing Stat Alignment and stats when only the Moves & More tab was read', () => {
    const movesOnly = { statAlignment: null, statPoints: noStats }
    const read = readDraft(
      team([seen(movesOnly), venusaur(movesOnly)], { images: [{ kind: 'replicaTeamMoves' }] }),
    )

    expect(read.pokemon[0]).not.toHaveProperty('nature')
    expect(read.flags).toEqual([
      { path: ['pokemon', 0, 'nature'], message: "The Stat Alignment and stats weren't shown." },
      { path: ['pokemon', 1, 'nature'], message: "The Stat Alignment and stats weren't shown." },
      {
        path: ['nature'],
        message:
          "No screenshot showed the Stat Alignments and stats. Add the Replica Team's Stats tab or detail screens, or fill them in.",
      },
    ])
  })

  it('flags stats no image showed on their own', () => {
    const read = readDraft(team([seen({ statPoints: noStats })], detailScreens))

    expect(read.flags).toEqual([
      { path: ['pokemon', 0, 'statPoints'], message: "The stats weren't shown." },
      {
        path: ['statPoints'],
        message:
          "No screenshot showed the stats. Add the Replica Team's Stats tab or detail screens, or fill them in.",
      },
    ])
  })

  it('never flags a nickname, gender or Battle Team name as missing', () => {
    expect(readDraft(team([seen({ nickname: null, gender: null })])).flags).toEqual([])
  })

  it('flags each field the images disagree on, in place of the reader being unsure of it', () => {
    const read = readDraft(
      team([seen({ disagreeing: ['item', 'moves', 'item'], unsure: ['item', 'ability'] })]),
    )

    expect(read.flags).toEqual([
      {
        path: ['pokemon', 0, 'item'],
        message: 'The screenshots show different held items, so check it.',
      },
      {
        path: ['pokemon', 0, 'moves'],
        message: 'The screenshots show different moves, so check them.',
      },
      {
        path: ['pokemon', 0, 'ability'],
        message: 'The ability was hard to make out, so check it.',
      },
    ])
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

import { describe, expect, it } from 'vitest'
import { type ReadPasteResult, readPaste, teamPokemonSchema, writePaste } from '../src'
import { fixture, fixtures } from './fixtures'

function expectRead(result: ReadPasteResult) {
  if (!result.ok)
    throw new Error(`Expected the paste to be read, got ${JSON.stringify(result.errors)}`)
  return result
}

function expectErrors(paste: string) {
  const result = readPaste(paste)
  if (result.ok) throw new Error('Expected the paste to be rejected')
  return result.errors
}

describe('reading Champions pastes', () => {
  it.each(fixtures)('reads $file into the expected builds', ({ file, pokemon }) => {
    const result = expectRead(readPaste(fixture(file)))
    expect(result.pokemon).toEqual(pokemon)
    expect(teamPokemonSchema.parse(result.pokemon)).toEqual(pokemon)
  })

  it.each(fixtures)('warns only about ignored Level lines in $file', ({ file, levelLines }) => {
    const result = expectRead(readPaste(fixture(file)))
    expect(result.warnings.map((w) => w.line)).toEqual(levelLines)
  })

  it('looks names up ignoring case and punctuation', () => {
    const result = expectRead(
      readPaste(
        [
          'ROTOM wash @ sitrus-berry',
          'Ability: LEVITATE',
          'evs: 32 hp / 2 spatk / 32 Speed',
          'bold nature',
          '- kings shield',
          '-Will O Wisp',
          '~ HYDRO PUMP',
        ].join('\n'),
      ),
    )
    expect(result.pokemon).toEqual([
      {
        species: 'rotomwash',
        item: 'sitrusberry',
        ability: 'levitate',
        nature: 'bold',
        moves: ['kingsshield', 'willowisp', 'hydropump'],
        statPoints: { hp: 32, atk: 0, def: 0, spa: 2, spd: 0, spe: 32 },
      },
    ])
  })

  it('reads a Pokémon with only a species', () => {
    const result = expectRead(readPaste('Pikachu'))
    expect(result.pokemon).toEqual([
      {
        species: 'pikachu',
        moves: [],
        statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      },
    ])
  })

  it('drops a nickname that is just the species name', () => {
    const result = expectRead(readPaste('Incineroar (Incineroar) @ Sitrus Berry'))
    expect(result.pokemon[0]).not.toHaveProperty('nickname')
  })

  it('separates Pokémon with --- as well as blank lines', () => {
    const result = expectRead(readPaste('Incineroar\n---\nGarchomp'))
    expect(result.pokemon.map((p) => p.species)).toEqual(['incineroar', 'garchomp'])
  })
})

describe('ignored lines', () => {
  it.each([
    ['Level: 50', 'Champions Pokémon are always level 50, so the Level line was ignored.'],
    ['IVs: 0 Atk', 'Champions has no IVs, so the IVs line was ignored.'],
    ['Tera Type: Fire', 'Champions has no Terastallization, so the Tera Type line was ignored.'],
    ['Shiny: Yes', "MyVGC doesn't track shiny Pokémon, so the Shiny line was ignored."],
    ['Happiness: 0', "Champions doesn't use Happiness, so the Happiness line was ignored."],
  ])('warns about "%s" without rejecting the paste', (line, message) => {
    const result = expectRead(readPaste(`Incineroar\nAbility: Intimidate\n${line}\n- Fake Out`))
    expect(result.warnings).toEqual([{ line: 3, message }])
    expect(result.pokemon[0]).toMatchObject({ species: 'incineroar', moves: ['fakeout'] })
  })

  it('returns warnings alongside errors', () => {
    const result = readPaste('Incineroar\nLevel: 50\nAbility: Not Real')
    expect(result.ok).toBe(false)
    expect(result.warnings).toHaveLength(1)
  })
})

describe('rejecting pastes', () => {
  it.each(['', '   \n\n  \n'])('rejects a paste with no Pokémon', (paste) => {
    expect(expectErrors(paste)).toEqual([{ line: 1, message: 'The paste has no Pokémon.' }])
  })

  it('rejects more than 6 Pokémon at the 7th', () => {
    const paste = [
      'Incineroar',
      'Garchomp',
      'Whimsicott',
      'Rotom-Wash',
      'Sinistcha',
      'Kingambit',
      'Gengar',
      'Charizard',
    ].join('\n\n')
    expect(expectErrors(paste)).toEqual([
      { line: 13, message: 'A Team has at most 6 Pokémon; this is Pokémon 7.' },
    ])
  })

  it('rejects more than 4 moves at the 5th', () => {
    const paste = 'Incineroar\n- Fake Out\n- Parting Shot\n- Flare Blitz\n- Knock Off\n- Protect'
    expect(expectErrors(paste)).toEqual([
      { line: 6, message: 'A Pokémon has at most 4 moves; this is move 5.' },
    ])
  })

  it('rejects a stat above 32 Stat Points', () => {
    expect(expectErrors('Incineroar\nAbility: Intimidate\nEVs: 33 HP / 2 Atk')).toEqual([
      { line: 3, message: 'HP has 33 Stat Points; the most for one stat is 32.' },
    ])
  })

  it('rejects Stat Points that add up to more than 66', () => {
    expect(expectErrors('Incineroar\nEVs: 32 HP / 32 Atk / 3 Spe')).toEqual([
      { line: 2, message: 'The Stat Points add up to 67; the most is 66.' },
    ])
  })

  it('rejects a Scarlet/Violet EV spread', () => {
    const errors = expectErrors('Incineroar\nEVs: 252 HP / 4 Atk / 252 SpD')
    expect(errors.map((e) => e.line)).toEqual([2, 2, 2])
  })

  it.each([
    ['Pokémon', 'Flutter Mane', 'Flutter Mane'],
    ['Pokémon', 'Notamon @ Leftovers', 'Notamon'],
    ['item', 'Incineroar @ Choice Specs', 'Choice Specs'],
    ['item', 'Incineroar @ Shiny Rock', 'Shiny Rock'],
  ])('rejects a %s that Champions does not have (%s)', (kind, line, name) => {
    expect(expectErrors(line)).toEqual([
      { line: 1, message: `"${name}" is not a ${kind} in Pokémon Champions.` },
    ])
  })

  it.each([
    ['ability', 'Ability: Totally Real', 'Totally Real'],
    ['move', '- Tera Blast', 'Tera Blast'],
    ['move', '- Protect / Detect', 'Protect / Detect'],
    ['nature', 'Grumpy Nature', 'Grumpy'],
  ])('rejects a %s that Champions does not have (%s)', (kind, line, name) => {
    expect(expectErrors(`Incineroar\n${line}`)).toEqual([
      { line: 2, message: `"${name}" is not a ${kind} in Pokémon Champions.` },
    ])
  })

  it.each(['Pokeball: Poke Ball', 'Hello there', 'Ability'])(
    'rejects a line it cannot read: %s',
    (line) => {
      expect(expectErrors(`Incineroar\n${line}`)).toEqual([
        { line: 2, message: "Can't read this line." },
      ])
    },
  )

  it('rejects Stat Points it cannot read', () => {
    expect(expectErrors('Incineroar\nEVs: lots HP')).toEqual([
      {
        line: 2,
        message: 'Can\'t read the Stat Points "lots HP". Write them like "32 HP / 2 Atk / 32 Spe".',
      },
    ])
  })

  it('reports every error in the paste, in line order', () => {
    const paste = 'Incineroar @ Choice Specs\n- Tera Blast\n\nFlutter Mane\nEVs: 40 Spe'
    expect(expectErrors(paste).map((e) => e.line)).toEqual([1, 2, 4, 5])
  })
})

describe('writing Champions pastes', () => {
  it('writes display names in Showdown export order', () => {
    const [build] = fixtures[1]!.pokemon
    expect(writePaste([build!])).toBe(
      [
        'Chompy (Garchomp) (F) @ Garchompite Z',
        'Ability: Rough Skin',
        'EVs: 32 Atk / 2 Def / 32 Spe',
        'Jolly Nature',
        '- Earthquake',
        '- Dragon Claw',
        '- Rock Slide',
        '- Protect',
        '',
      ].join('\n'),
    )
  })

  it('leaves out lines for missing fields', () => {
    expect(
      writePaste([
        {
          species: 'pikachu',
          moves: [],
          statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        },
      ]),
    ).toBe('Pikachu\n')
  })

  it('separates Pokémon with a blank line', () => {
    const paste = writePaste(fixtures[0]!.pokemon)
    expect(paste.split('\n\n')).toHaveLength(6)
    expect(paste).toContain(
      'Rotom-Wash @ Leftovers\nAbility: Levitate\nEVs: 32 HP / 18 Def / 16 SpA\nBold Nature',
    )
  })

  it.each(fixtures)('round-trips $file', ({ pokemon }) => {
    const result = expectRead(readPaste(writePaste(pokemon)))
    expect(result.pokemon).toEqual(pokemon)
    expect(result.warnings).toEqual([])
  })
})

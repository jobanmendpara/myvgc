import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { checkPokemon, readTeamsheet, teamPokemonSchema } from '../src'

// Downloaded from teamsheet.gg on 2026-11-01 by the maintainer, with its Player details replaced
// by made-up ones. Its Pokémon are the ones read off the game in `stat-values.test.ts`.
const FIXTURE = new URL('./fixtures/teamsheet-gg-filled.pdf', import.meta.url)
const fixture = () => readFile(FIXTURE)

/** The fixture with some form fields changed, such as `{ f22: 'Charcoal' }`. `''` empties one. */
async function teamsheetWith(fields: Record<string, string>): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fixture())
  const form = doc.getForm()
  for (const [name, text] of Object.entries(fields))
    form.getTextField(name).setText(text || undefined)
  return doc.save()
}

// Each Pokémon box's first field (`vg-team-list-pdf.md`). Staff page boxes have 14 fields, with
// stats; opponents page boxes have 8.
const STAFF_BOXES = [19, 41, 63, 85, 107, 129]
const OPPONENT_BOXES = [33, 55, 77, 99, 121, 143]

/** Every field of some Pokémon boxes emptied, by box number from 1. */
function emptyBoxes(page: 'staff' | 'opponents', boxes = [1, 2, 3, 4, 5, 6]) {
  const [firsts, size] = page === 'staff' ? [STAFF_BOXES, 14] : [OPPONENT_BOXES, 8]
  return Object.fromEntries(
    boxes.flatMap((box) =>
      Array.from({ length: size }, (_, offset) => [`f${firsts[box - 1]! + offset}`, '']),
    ),
  )
}

const STAT_POINTS = (
  hp: number,
  atk: number,
  def: number,
  spa: number,
  spd: number,
  spe: number,
) => ({
  hp,
  atk,
  def,
  spa,
  spd,
  spe,
})

describe('readTeamsheet', () => {
  it('reads every Pokémon build and the Battle Team name from a teamsheet.gg PDF', async () => {
    const read = await readTeamsheet(await fixture())

    expect(read).toEqual({
      ok: true,
      name: '9TCG84KWXK',
      flags: [],
      pokemon: [
        {
          species: 'charizard',
          nature: 'timid',
          ability: 'solarpower',
          item: 'charizarditey',
          moves: ['heatwave', 'weatherball', 'solarbeam', 'protect'],
          statPoints: STAT_POINTS(2, 0, 0, 32, 0, 32),
        },
        {
          species: 'venusaur',
          nature: 'calm',
          ability: 'overgrow',
          item: 'sitrusberry',
          moves: ['gigadrain', 'sludgebomb', 'sleeppowder', 'protect'],
          statPoints: STAT_POINTS(32, 0, 2, 16, 16, 0),
        },
        {
          species: 'whimsicott',
          nature: 'timid',
          ability: 'prankster',
          item: 'focussash',
          moves: ['moonblast', 'encore', 'tailwind', 'protect'],
          statPoints: STAT_POINTS(4, 0, 0, 30, 0, 32),
        },
        {
          species: 'kingambit',
          nature: 'adamant',
          ability: 'defiant',
          item: 'chopleberry',
          moves: ['kowtowcleave', 'suckerpunch', 'ironhead', 'protect'],
          statPoints: STAT_POINTS(32, 32, 0, 0, 0, 2),
        },
        {
          species: 'garchomp',
          nature: 'jolly',
          ability: 'roughskin',
          item: 'lifeorb',
          moves: ['earthquake', 'rockslide', 'dragonclaw', 'protect'],
          statPoints: STAT_POINTS(0, 32, 2, 0, 0, 32),
        },
        {
          species: 'basculegion',
          nature: 'adamant',
          ability: 'adaptability',
          item: 'mysticwater',
          moves: ['wavecrash', 'aquajet', 'flipturn', 'lastrespects'],
          statPoints: STAT_POINTS(0, 32, 2, 0, 0, 32),
        },
      ],
    })
  })

  it('reads Pokémon builds that pass the same checks as a paste (ADR 14)', async () => {
    const read = await readTeamsheet(await fixture())
    if (!read.ok) throw new Error(read.error)
    expect(teamPokemonSchema.safeParse(read.pokemon).success).toBe(true)
    expect(checkPokemon(read.pokemon)).toEqual([])
  })

  it("leaves out a name the Champions data doesn't know, and flags it", async () => {
    // Box 2 is Venusaur: f44 is its Held Item, f46 its second move.
    const read = await readTeamsheet(await teamsheetWith({ f44: 'Sitrus Bery', f46: 'Sludge Bom' }))

    expect(read.ok && read.pokemon[1]).toMatchObject({
      species: 'venusaur',
      moves: ['gigadrain', 'sleeppowder', 'protect'],
    })
    expect(read.ok && read.pokemon[1]!.item).toBeUndefined()
    expect(read.ok && read.flags).toEqual([
      { path: ['pokemon', 1, 'item'], message: 'Couldn\'t read "Sitrus Bery".' },
      { path: ['pokemon', 1, 'moves', 1], message: 'Couldn\'t read "Sludge Bom".' },
    ])
  })

  it('flags a stat value no Stat Points can give, and gives that stat 0', async () => {
    // f27 is Charizard's HP: 155 is right, 300 can't be reached.
    const read = await readTeamsheet(await teamsheetWith({ f27: '300' }))

    expect(read.ok && read.pokemon[0]!.statPoints).toEqual(STAT_POINTS(0, 0, 0, 32, 0, 32))
    expect(read.ok && read.flags).toEqual([
      {
        path: ['pokemon', 0, 'statPoints', 'hp'],
        message: 'No Stat Points give 300 HP, so it was set to 0.',
      },
    ])
  })

  it('flags Stat Points that add up to more than 66', async () => {
    // Venusaur's SpA 136 has 16 Stat Points; 152 needs 32, making 82 in all.
    const read = await readTeamsheet(await teamsheetWith({ f52: '152' }))

    expect(read.ok && read.flags).toEqual([
      {
        path: ['pokemon', 1, 'statPoints'],
        message: 'The Stat Points read add up to 82; the most is 66.',
      },
    ])
  })

  it("says so when Stat Points can't be trusted because a name wasn't read", async () => {
    // f20 is Charizard's Stat Alignment; f41 is box 2's species.
    const read = await readTeamsheet(await teamsheetWith({ f20: 'Timidd', f41: 'Venusaurr' }))

    expect(read.ok && read.flags).toEqual([
      { path: ['pokemon', 0, 'nature'], message: 'Couldn\'t read "Timidd".' },
      {
        path: ['pokemon', 0, 'statPoints'],
        message: 'Stat Points were worked out with no Stat Alignment, so check them.',
      },
      { path: ['pokemon', 1, 'species'], message: 'Couldn\'t read "Venusaurr".' },
      {
        path: ['pokemon', 1, 'statPoints'],
        message: "Stat Points weren't worked out, since the species wasn't read.",
      },
    ])
  })

  it('takes the Battle Team name from the opponents page when the staff page has none', async () => {
    const read = await readTeamsheet(await teamsheetWith({ f10: '', f11: 'Sun' }))
    expect(read.ok && read.name).toBe('Sun')
  })

  it('reads the opponents page, without Stat Points, when the staff page is empty', async () => {
    const read = await readTeamsheet(await teamsheetWith(emptyBoxes('staff')))

    expect(read.ok && read.pokemon.map((build) => build.species)).toEqual([
      'charizard',
      'venusaur',
      'whimsicott',
      'kingambit',
      'garchomp',
      'basculegion',
    ])
    expect(read.ok && read.pokemon[0]).toMatchObject({
      nature: 'timid',
      item: 'charizarditey',
      statPoints: STAT_POINTS(0, 0, 0, 0, 0, 0),
    })
  })

  it('skips empty boxes, so a Team can have fewer than six Pokémon', async () => {
    // Box 3 is Whimsicott.
    const read = await readTeamsheet(
      await teamsheetWith({ ...emptyBoxes('staff', [3]), ...emptyBoxes('opponents', [3]) }),
    )

    expect(read.ok && read.pokemon.map((build) => build.species)).toEqual([
      'charizard',
      'venusaur',
      'kingambit',
      'garchomp',
      'basculegion',
    ])
  })

  it('refuses a Teamsheet with no Pokémon', async () => {
    const empty = { ...emptyBoxes('staff'), ...emptyBoxes('opponents') }
    expect(await readTeamsheet(await teamsheetWith(empty))).toEqual({
      ok: false,
      error: 'This Teamsheet has no Pokémon on it.',
    })
  })

  it("refuses a PDF that isn't a teamsheet.gg Teamsheet", async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    expect(await readTeamsheet(await doc.save())).toEqual({
      ok: false,
      error: "This isn't a recognised Teamsheet. MyVGC reads Teamsheets filled in on teamsheet.gg.",
    })
  })

  it('refuses a password-protected PDF', async () => {
    const doc = await PDFDocument.load(await fixture())
    // Marking the file encrypted is enough: pdf-lib refuses before reading anything else.
    doc.context.trailerInfo.Encrypt = doc.context.register(doc.context.obj({ Filter: 'Standard' }))
    expect(await readTeamsheet(await doc.save())).toEqual({
      ok: false,
      error: "This PDF is password-protected, so MyVGC can't read it.",
    })
  })

  it("refuses a file that isn't a PDF", async () => {
    expect(await readTeamsheet(new TextEncoder().encode('Incineroar @ Sitrus Berry'))).toEqual({
      ok: false,
      error: "This file isn't a PDF MyVGC can open.",
    })
  })
})

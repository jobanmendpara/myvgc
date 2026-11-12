import { readFile } from 'node:fs/promises'
import fontkit from '@pdf-lib/fontkit'
import { PDFCheckBox, PDFDocument, PDFTextField } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  type PokemonBuild,
  type WriteTeamsheetInput,
  readTeamsheet,
  teamsheetAgeDivision,
  writeTeamsheet,
} from '../src'
import { TEAM_LIST_PAGES, pageFields } from '../src/team-list'

// The bundled template and font live with the API, which reads them (ADR 18, ADR 28).
const ASSETS = new URL('../../../apps/api/assets/', import.meta.url)
const template = () => readFile(new URL('team-list/play-pokemon-vg-team-list.pdf', ASSETS))
const font = () => readFile(new URL('fonts/DejaVuSans.ttf', ASSETS))
const FIXTURE = new URL('./fixtures/teamsheet-gg-filled.pdf', import.meta.url)

const BLANK_HEADER: WriteTeamsheetInput['header'] = {
  playerName: '',
  trainerName: '',
  switchProfileName: '',
  playerId: '',
  supportId: '',
  ageDivision: null,
  dateOfBirth: null,
  battleTeamName: '',
}

async function exported(
  pokemon: PokemonBuild[],
  header: Partial<WriteTeamsheetInput['header']> = {},
): Promise<Uint8Array> {
  const result = await writeTeamsheet({
    template: await template(),
    font: await font(),
    pokemon,
    header: { ...BLANK_HEADER, ...header },
  })
  if (!result.ok) throw new Error(result.error)
  return result.pdf
}

/** Every field's text, or whether it is checked, by name. */
async function fieldsOf(pdf: Uint8Array): Promise<Record<string, string | boolean>> {
  const form = (await PDFDocument.load(pdf)).getForm()
  return Object.fromEntries(
    form
      .getFields()
      .map((field) => [
        field.getName(),
        field instanceof PDFCheckBox
          ? field.isChecked()
          : field instanceof PDFTextField
            ? (field.getText() ?? '')
            : '',
      ]),
  )
}

const build = (species: string, more: Partial<PokemonBuild> = {}): PokemonBuild => ({
  species,
  moves: [],
  statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ...more,
})

// Each export embeds and deflates the full DejaVu Sans (ADR 28), about 0.2 s of CPU on an idle
// machine, and the first test also loads the Champions data. With other test runs sharing the CPU,
// as when agents run `pnpm test` side by side, a test here took up to 6 s, past Vitest's default
// 5 s (DEV-101). The time limit is there to catch a hang, not to measure speed.
describe('writeTeamsheet', { timeout: 30_000 }, () => {
  it('reads back as the same Team', async () => {
    const read = await readTeamsheet(await readFile(FIXTURE))
    if (!read.ok) throw new Error(read.error)

    const back = await readTeamsheet(
      await exported(read.pokemon, { battleTeamName: 'Sun and Shade' }),
    )

    expect(back).toEqual({ ok: true, name: 'Sun and Shade', pokemon: read.pokemon, flags: [] })
  })

  it('fills the header on both pages, and Date of Birth on the staff page', async () => {
    const fields = await fieldsOf(
      await exported([], {
        playerName: 'Ash Ketchum',
        trainerName: 'ASH',
        switchProfileName: 'ashk',
        playerId: '1234567',
        supportId: 'ABCD-1234',
        dateOfBirth: '2010-01-31',
        ageDivision: 'Senior',
        battleTeamName: 'Team 3',
      }),
    )

    expect(fields).toMatchObject({
      f0: 'Ash Ketchum',
      f5: 'Ash Ketchum',
      f1: 'ASH',
      f6: 'ASH',
      f10: 'Team 3',
      f11: 'Team 3',
      f12: 'ashk',
      f13: 'ashk',
      f14: '1234567',
      f15: '01',
      f16: '31',
      f17: '2010',
      f18: 'ABCD-1234',
      f2: false,
      f3: true,
      f4: false,
      f7: false,
      f8: true,
      f9: false,
    })
  })

  it("has teamsheet.gg's 151 fields, in the fixture's places", async () => {
    const pdf = await PDFDocument.load(await exported([]))
    const fixture = await PDFDocument.load(await readFile(FIXTURE))
    const placed = (doc: PDFDocument) =>
      Object.fromEntries(
        doc
          .getForm()
          .getFields()
          .map((field) => {
            const widget = field.acroField.getWidgets()[0]!
            const { x, y, width, height } = widget.getRectangle()
            const page = doc.getPages().findIndex((p) => p.ref === widget.P())
            return [
              field.getName(),
              [field.constructor.name, page, ...[x, y, width, height].map((n) => n.toFixed(2))],
            ]
          }),
      )

    expect(placed(pdf)).toEqual(placed(fixture))
    expect(TEAM_LIST_PAGES.flatMap(pageFields)).toHaveLength(151)
  })

  it('writes a battle-only form as its base form, and leaves gaps blank', async () => {
    const fields = await fieldsOf(
      await exported([
        build('charizardmegay', { item: 'charizarditey', moves: ['heatwave'] }),
        build('ogerponhearthflametera'),
      ]),
    )

    expect(fields).toMatchObject({
      f19: 'Charizard',
      f33: 'Charizard',
      f22: 'Charizardite Y',
      f23: 'Heat Wave',
      f24: '',
      f20: '',
      f41: 'Ogerpon-Hearthflame',
      f63: '',
      f77: '',
    })
  })

  it('fills stat boxes only for a build with a Stat Alignment or Stat Points', async () => {
    const fields = await fieldsOf(
      await exported([
        build('garchomp'),
        build('garchomp', { nature: 'jolly' }),
        build('garchomp', { statPoints: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } }),
      ]),
    )

    expect([27, 28, 29, 30, 31, 32].map((n) => fields[`f${n}`])).toEqual(['', '', '', '', '', ''])
    // Garchomp is 108 / 130 / 95 / 80 / 85 / 102.
    expect([49, 50, 51, 52, 53, 54].map((n) => fields[`f${n}`])).toEqual([
      '183',
      '150',
      '115',
      '90',
      '105',
      '134',
    ])
    expect([71, 72, 73, 74, 75, 76].map((n) => fields[`f${n}`])).toEqual([
      '183',
      '182',
      '115',
      '100',
      '105',
      '154',
    ])
  })

  it('writes the longest names in the data whole, in the embedded font', async () => {
    const pdf = await exported([
      build('ogerponcornerstonetera', {
        ability: 'embodyaspectcornerstone',
        item: 'terrainextender',
        moves: ['firstimpression', 'burningjealousy', 'chillyreception'],
      }),
      build('sirfetchd'),
    ])
    const fields = await fieldsOf(pdf)

    expect(fields).toMatchObject({
      f19: 'Ogerpon-Cornerstone',
      f21: 'Embody Aspect (Cornerstone)',
      f22: 'Terrain Extender',
      f25: 'Chilly Reception',
      f41: 'Sirfetch’d',
    })
  })

  it('embeds a font that covers what a User might type in a PDF viewer (ADR 28)', async () => {
    const embedded = fontkit.create(await font())

    for (const character of 'Nidoran♀ Nidoran♂ Sirfetch’d Flabébé') {
      expect(embedded.hasGlyphForCodePoint(character.codePointAt(0)!), character).toBe(true)
    }
  })

  it("refuses a template it doesn't know", async () => {
    const result = await writeTeamsheet({
      template: await readFile(FIXTURE),
      font: await font(),
      pokemon: [],
      header: BLANK_HEADER,
    })

    expect(result).toEqual({ ok: false, error: expect.stringContaining("isn't the one") })
  })
})

describe('teamsheetAgeDivision', () => {
  it('works it out from Date of Birth for the Season, falling back to the stored one', () => {
    expect(
      teamsheetAgeDivision({ dateOfBirth: '2012-05-01', ageDivision: 'Masters' }, '2026-11-09'),
    ).toBe('Senior')
    expect(teamsheetAgeDivision({ dateOfBirth: null, ageDivision: 'Masters' }, '2026-11-09')).toBe(
      'Masters',
    )
    expect(teamsheetAgeDivision({ dateOfBirth: null, ageDivision: null }, '2026-11-09')).toBeNull()
  })
})

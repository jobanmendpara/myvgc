import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { TEAM_LIST_SHA256, readTeamsheet } from '@myvgc/core'
import type { PDFTextField } from 'pdf-lib'
import { PDFCheckBox, PDFDocument } from 'pdf-lib'
import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, json, post, put, signUp } from './app'

const PASTE = `Floette-Eternal @ Floettite
Ability: Flower Veil
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Moonblast
- Protect

Charizard-Mega-Y @ Charizardite Y
Ability: Drought
- Heat Wave`

const PLAYER = {
  playerName: 'Ash Ketchum',
  trainerName: 'ASH',
  switchProfileName: 'ashk',
  playerId: '1234567',
  supportId: 'ABCD-1234',
  ageDivision: 'Masters',
  dateOfBirth: null,
}

/** Every field's text, or whether it is checked, by name. */
async function fieldsOf(res: Response): Promise<Record<string, string | boolean>> {
  const form = (await PDFDocument.load(await res.arrayBuffer())).getForm()
  return Object.fromEntries(
    form
      .getFields()
      .map((field) => [
        field.getName(),
        field instanceof PDFCheckBox
          ? field.isChecked()
          : ((field as PDFTextField).getText() ?? ''),
      ]),
  )
}

describe('Teamsheet export', () => {
  let t: TestApp
  let ash: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
    const created = await json(
      await post(t.app, '/api/teams', { name: 'Fairy rain', regulation: 'M-C', paste: PASTE }, ash),
    )
    return created.team.id as string
  }

  it('makes a Team’s Teamsheet, named after the Team, that reads back as the Team', async () => {
    const teamId = await setUp()

    const res = await post(t.app, `/api/teams/${teamId}/teamsheet`, PLAYER, ash)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toContain(
      'attachment; filename="Fairy rain Teamsheet.pdf"',
    )
    const read = await readTeamsheet(new Uint8Array(await res.arrayBuffer()))
    const team = await json(
      await t.app.request(`/api/teams/${teamId}`, { headers: { cookie: ash } }),
    )
    expect(read).toMatchObject({ ok: true, name: 'Fairy rain' })
    // The Mega is written as its base form, so it reads back as Charizard.
    expect(read.ok && read.pokemon.map((build) => build.species)).toEqual([
      team.pokemon[0].species,
      'charizard',
    ])
  })

  it('fills the Player details sent for this export', async () => {
    const teamId = await setUp()

    const fields = await fieldsOf(
      await post(
        t.app,
        `/api/teams/${teamId}/teamsheet`,
        { ...PLAYER, battleTeamName: 'Team 3' },
        ash,
      ),
    )

    expect(fields).toMatchObject({
      f0: 'Ash Ketchum',
      f5: 'Ash Ketchum',
      f10: 'Team 3',
      f14: '1234567',
      f18: 'ABCD-1234',
      f4: true,
      f9: true,
    })
  })

  it('works out Age Division from Date of Birth for the Tournament’s Season', async () => {
    const teamId = await setUp()
    const { id } = await json(
      await post(
        t.app,
        '/api/tournaments',
        {
          name: 'Lille Regional',
          startDate: '2026-11-14',
          eventTier: 'regional',
          regulation: 'M-C',
        },
        ash,
      ),
    )
    await put(t.app, `/api/tournaments/${id}/team`, { teamId }, ash)

    const res = await post(
      t.app,
      `/api/tournaments/${id}/team/teamsheet`,
      { ...PLAYER, dateOfBirth: '2012-05-01' },
      ash,
    )

    expect(res.status).toBe(200)
    // Born 2012, so a Senior in the 2027 Season, whatever Age Division was sent.
    expect(await fieldsOf(res)).toMatchObject({
      f10: 'Fairy rain',
      f15: '05',
      f16: '01',
      f17: '2012',
      f3: true,
      f4: false,
    })
  })

  it('answers 404 for another User’s Team, or a Tournament with no Team snapshot', async () => {
    const teamId = await setUp()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    const { id } = await json(
      await post(
        t.app,
        '/api/tournaments',
        { name: 'Lille Regional', startDate: '2026-11-14', eventTier: 'regional' },
        ash,
      ),
    )

    expect((await post(t.app, `/api/teams/${teamId}/teamsheet`, {}, misty)).status).toBe(404)
    expect((await post(t.app, `/api/tournaments/${id}/team/teamsheet`, {}, ash)).status).toBe(404)
  })

  it('answers 400 naming the field for Player details that are too long', async () => {
    const teamId = await setUp()

    const res = await post(
      t.app,
      `/api/teams/${teamId}/teamsheet`,
      { playerName: 'x'.repeat(101) },
      ash,
    )

    expect(res.status).toBe(400)
    expect((await json(res)).fields).toHaveProperty('playerName')
  })
})

describe('The bundled team list', () => {
  it('is the official file the field rectangles were measured on (ADR 18)', async () => {
    const file = await readFile(
      new URL('../assets/team-list/play-pokemon-vg-team-list.pdf', import.meta.url),
    )
    expect(createHash('sha256').update(file).digest('hex')).toBe(TEAM_LIST_SHA256)
  })
})

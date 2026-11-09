import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, get, json, put, signUp } from './app'

const BLANK = {
  playerName: '',
  trainerName: '',
  switchProfileName: '',
  playerId: '',
  supportId: '',
  ageDivision: null,
  dateOfBirth: null,
}

describe('Player details', () => {
  let t: TestApp
  let ash: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
  }
  const read = async (cookie = ash) => json(await get(t.app, '/api/account/player-details', cookie))
  const save = (details: object, cookie = ash) =>
    put(t.app, '/api/account/player-details', details, cookie)

  it('are blank until the User saves some', async () => {
    await setUp()
    const res = await get(t.app, '/api/account/player-details', ash)
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual(BLANK)
  })

  it('saves trimmed Player details and reads them back', async () => {
    await setUp()
    const res = await save({
      playerName: ' Ash Ketchum ',
      playerId: '1234567',
      ageDivision: 'Masters',
    })
    expect(res.status).toBe(200)
    const saved = {
      ...BLANK,
      playerName: 'Ash Ketchum',
      playerId: '1234567',
      ageDivision: 'Masters',
    }
    expect(await json(res)).toEqual(saved)
    expect(await read()).toEqual(saved)
  })

  it('saves a Date of Birth and reads it back, and clears it again', async () => {
    await setUp()
    const res = await save({ playerName: 'Ash', dateOfBirth: '2010-05-22' })
    expect(res.status).toBe(200)
    expect((await json(res)).dateOfBirth).toBe('2010-05-22')
    expect(await read()).toEqual({ ...BLANK, playerName: 'Ash', dateOfBirth: '2010-05-22' })

    await save({ playerName: 'Ash', dateOfBirth: null })
    expect((await read()).dateOfBirth).toBeNull()
  })

  it('replaces them all on each save, so a field left out is blanked', async () => {
    await setUp()
    await save({ playerName: 'Ash', supportId: 'ABCD', ageDivision: 'Senior' })
    await save({ playerName: 'Ash Ketchum' })
    expect(await read()).toEqual({ ...BLANK, playerName: 'Ash Ketchum' })
  })

  it("keeps each User's Player details to themselves", async () => {
    await setUp()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    await save({ playerName: 'Ash' })
    await save({ playerName: 'Misty' }, misty)
    expect((await read()).playerName).toBe('Ash')
    expect((await read(misty)).playerName).toBe('Misty')
  })

  it('refuses invalid Player details, naming the fields, and keeps what was saved', async () => {
    await setUp()
    await save({ playerName: 'Ash' })
    const res = await save({
      playerName: 'x'.repeat(101),
      ageDivision: 'Adult',
      dateOfBirth: '2999-01-01',
    })
    expect(res.status).toBe(400)
    expect(Object.keys((await json(res)).fields)).toEqual([
      'playerName',
      'ageDivision',
      'dateOfBirth',
    ])
    expect((await read()).playerName).toBe('Ash')
  })

  it('need a session', async () => {
    await setUp()
    expect((await get(t.app, '/api/account/player-details')).status).toBe(401)
    expect((await put(t.app, '/api/account/player-details', { playerName: 'Ash' })).status).toBe(
      401,
    )
  })
})

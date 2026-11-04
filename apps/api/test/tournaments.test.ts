import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, del, get, json, patch, post, signUp } from './app'

const REGIONAL = {
  name: 'Toronto Regional',
  startDate: '2026-09-19',
  endDate: '2026-09-20',
  eventTier: 'regional',
  online: false,
  defaultBestOf: 3,
}

describe('Tournaments', () => {
  let t: TestApp
  let ash: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
  }

  it('creates a Tournament, taking its Regulation from the start date', async () => {
    await setUp()
    const res = await post(t.app, '/api/tournaments', REGIONAL, ash)

    expect(res.status).toBe(201)
    expect(await json(res)).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      ...REGIONAL,
      regulation: 'M-C',
      upcoming: false,
    })
  })

  it('keeps a Regulation the User chose', async () => {
    await setUp()
    const res = await post(t.app, '/api/tournaments', { ...REGIONAL, regulation: 'M-B' }, ash)
    expect((await json(res)).regulation).toBe('M-B')
  })

  it('defaults to one day, in person, best of 1', async () => {
    await setUp()
    const res = await post(
      t.app,
      '/api/tournaments',
      { name: 'Locals', startDate: '2026-06-20', eventTier: 'grassroots' },
      ash,
    )
    expect(await json(res)).toMatchObject({
      endDate: null,
      online: false,
      defaultBestOf: 1,
      regulation: 'M-B',
    })
  })

  it('marks Tournaments that start in the future as Upcoming', async () => {
    await setUp()
    const res = await post(
      t.app,
      '/api/tournaments',
      { ...REGIONAL, startDate: '2999-01-01', endDate: undefined },
      ash,
    )
    expect((await json(res)).upcoming).toBe(true)
  })

  it.each([
    [{ ...REGIONAL, name: '  ' }, 'name'],
    [{ ...REGIONAL, startDate: '19/09/2026' }, 'startDate'],
    [{ ...REGIONAL, endDate: '2026-09-18' }, 'endDate'],
    [{ ...REGIONAL, eventTier: 'major' }, 'eventTier'],
    [{ ...REGIONAL, defaultBestOf: 2 }, 'defaultBestOf'],
  ])('refuses an invalid Tournament (%j)', async (body, field) => {
    await setUp()
    const res = await post(t.app, '/api/tournaments', body, ash)
    expect(res.status).toBe(400)
    expect((await json(res)).fields).toHaveProperty(field)
  })

  it('lists only the User’s Tournaments, newest start date first', async () => {
    await setUp()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    await post(
      t.app,
      '/api/tournaments',
      { ...REGIONAL, name: 'Older', startDate: '2026-05-01', endDate: undefined },
      ash,
    )
    await post(t.app, '/api/tournaments', { ...REGIONAL, name: 'Newer' }, ash)
    await post(t.app, '/api/tournaments', { ...REGIONAL, name: 'Misty’s' }, misty)

    const res = await get(t.app, '/api/tournaments', ash)
    expect(res.status).toBe(200)
    expect((await json(res)).map((x: { name: string }) => x.name)).toEqual(['Newer', 'Older'])
  })

  it('shows a Tournament to its owner and answers 404 to everyone else', async () => {
    await setUp()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    const { id } = await json(await post(t.app, '/api/tournaments', REGIONAL, ash))

    const own = await get(t.app, `/api/tournaments/${id}`, ash)
    expect(own.status).toBe(200)
    expect(await json(own)).toMatchObject({ id, name: 'Toronto Regional' })

    expect((await get(t.app, `/api/tournaments/${id}`, misty)).status).toBe(404)
    expect((await get(t.app, '/api/tournaments/not-an-id', ash)).status).toBe(404)
  })
})

describe('GET /api/calendar', () => {
  let t: TestApp
  afterEach(async () => {
    await t?.client.close()
  })

  it('returns the Regulations and Seasons with their dates', async () => {
    t = await createTestApp()
    const { cookie } = await signUp(t.app, 'ash@example.com')
    const body = await json(await get(t.app, '/api/calendar', cookie))

    expect(body.regulations).toContainEqual({
      regulation: 'M-B',
      start: '2026-06-17',
      end: '2026-09-08',
    })
    expect(body.seasons).toContainEqual(expect.objectContaining({ id: '2026', partial: true }))
    expect(body.currentRegulation).toMatch(/^M-/)
    expect(body.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('Tournament details', () => {
  let t: TestApp
  let ash: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
  }

  const DETAILS = {
    organizer: 'Pokémon Toronto',
    entryFee: { amount: 3500, currency: 'CAD' },
    championshipPoints: 50,
    playerCount: 128,
    link: 'https://rk9.gg/tournament/abc',
    placement: 9,
    dropped: false,
  }

  it('records the Organizer, Entry fee, Championship Points, player count, link and Placement', async () => {
    await setUp()
    const res = await post(t.app, '/api/tournaments', { ...REGIONAL, ...DETAILS }, ash)
    expect(res.status).toBe(201)
    expect(await json(res)).toMatchObject(DETAILS)
  })

  it('leaves the optional details out by default', async () => {
    await setUp()
    expect(await json(await post(t.app, '/api/tournaments', REGIONAL, ash))).toMatchObject({
      organizer: null,
      entryFee: null,
      championshipPoints: null,
      playerCount: null,
      link: null,
      placement: null,
      dropped: false,
    })
  })

  it.each([
    [{ entryFee: { amount: -1, currency: 'CAD' } }, 'entryFee.amount'],
    [{ entryFee: { amount: 3500, currency: 'dollars' } }, 'entryFee.currency'],
    [{ championshipPoints: -5 }, 'championshipPoints'],
    [{ playerCount: 1 }, 'playerCount'],
    [{ placement: 0 }, 'placement'],
    [{ playerCount: 16, placement: 17 }, 'placement'],
    [{ link: 'javascript:alert(1)' }, 'link'],
    [{ link: 'not a link' }, 'link'],
  ])('refuses invalid details (%j)', async (details, field) => {
    await setUp()
    const res = await post(t.app, '/api/tournaments', { ...REGIONAL, ...details }, ash)
    expect(res.status).toBe(400)
    expect((await json(res)).fields).toHaveProperty([field])
  })

  it('changes only the fields sent', async () => {
    await setUp()
    const { id } = await json(
      await post(t.app, '/api/tournaments', { ...REGIONAL, ...DETAILS }, ash),
    )

    const res = await patch(
      t.app,
      `/api/tournaments/${id}`,
      { placement: 3, dropped: true, link: null },
      ash,
    )
    expect(res.status).toBe(200)
    expect(await json(res)).toMatchObject({
      ...DETAILS,
      placement: 3,
      dropped: true,
      link: null,
      name: REGIONAL.name,
    })
    expect(await json(await get(t.app, `/api/tournaments/${id}`, ash))).toMatchObject({
      placement: 3,
    })
  })

  it('checks changes against the fields already saved', async () => {
    await setUp()
    const { id } = await json(
      await post(t.app, '/api/tournaments', { ...REGIONAL, playerCount: 16 }, ash),
    )

    const tooLow = await patch(t.app, `/api/tournaments/${id}`, { placement: 20 }, ash)
    expect(tooLow.status).toBe(400)
    expect((await json(tooLow)).fields).toHaveProperty('placement')

    const backwards = await patch(t.app, `/api/tournaments/${id}`, { endDate: '2026-09-01' }, ash)
    expect(backwards.status).toBe(400)
    expect((await json(backwards)).fields).toHaveProperty('endDate')
  })

  it('deletes a Tournament', async () => {
    await setUp()
    const { id } = await json(await post(t.app, '/api/tournaments', REGIONAL, ash))
    expect((await del(t.app, `/api/tournaments/${id}`, ash)).status).toBe(204)
    expect((await get(t.app, `/api/tournaments/${id}`, ash)).status).toBe(404)
  })

  it('never changes or deletes another User’s Tournament', async () => {
    await setUp()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    const { id } = await json(await post(t.app, '/api/tournaments', REGIONAL, ash))

    expect((await patch(t.app, `/api/tournaments/${id}`, { name: 'Mine now' }, misty)).status).toBe(
      404,
    )
    // A delete has nothing of Misty's to remove, so it is done, and Ash's Tournament stays.
    expect((await del(t.app, `/api/tournaments/${id}`, misty)).status).toBe(204)
    expect(await json(await get(t.app, `/api/tournaments/${id}`, ash))).toMatchObject({
      name: REGIONAL.name,
    })
  })

  it('suggests the User’s own Organizers', async () => {
    await setUp()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    await post(t.app, '/api/tournaments', { ...REGIONAL, organizer: 'Pokémon Toronto' }, ash)
    await post(t.app, '/api/tournaments', { ...REGIONAL, organizer: 'Pokémon Toronto' }, ash)
    await post(t.app, '/api/tournaments', { ...REGIONAL, organizer: 'Game Kastle' }, ash)
    await post(t.app, '/api/tournaments', { ...REGIONAL, organizer: 'Toronto Secret Club' }, misty)

    const all = await json(await get(t.app, '/api/tournaments/organizers', ash))
    expect(all.sort()).toEqual(['Game Kastle', 'Pokémon Toronto'])
    expect(await json(await get(t.app, '/api/tournaments/organizers?q=toron', ash))).toEqual([
      'Pokémon Toronto',
    ])
  })
})

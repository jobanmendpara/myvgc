import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, get, json, post, signUp } from './app'

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

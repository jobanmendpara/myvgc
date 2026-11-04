import { currentRegulation, today } from '@myvgc/core'
import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, get, json, post, signUp } from './app'

describe('GET /api/dashboard', () => {
  let t: TestApp
  let ash: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
    // One win at each Tournament, so the number of wins counts the Tournaments included.
    const add = async (fields: object) => {
      const { id } = await json(
        await post(t.app, '/api/tournaments', { eventTier: 'regional', ...fields }, ash),
      )
      await post(
        t.app,
        `/api/tournaments/${id}/rounds`,
        { result: 'win', newOpponentName: 'X' },
        ash,
      )
    }
    await add({
      name: 'M-A Regional',
      startDate: '2026-05-01',
      regulation: 'M-A',
      championshipPoints: 50,
    })
    await add({
      name: 'M-B online',
      startDate: '2026-07-01',
      regulation: 'M-B',
      eventTier: 'online',
      online: true,
    })
    await add({
      name: 'M-C Regional',
      startDate: '2026-09-19',
      regulation: 'M-C',
      championshipPoints: 80,
    })
    await add({
      name: 'M-C locals',
      startDate: '2026-10-10',
      regulation: 'M-C',
      eventTier: 'grassroots',
    })
  }
  const dashboard = async (query = '') => json(await get(t.app, `/api/dashboard${query}`, ash))

  it('defaults to the current Regulation and says so', async () => {
    await setUp()
    const body = await dashboard()
    const current = currentRegulation(today())
    expect(body.filters).toMatchObject({ regulation: current, season: null, from: null, to: null })
    expect(body.summary.rounds.wins).toBe({ 'M-A': 1, 'M-B': 1, 'M-C': 2 }[current])
  })

  it('filters by Regulation, or includes every Regulation', async () => {
    await setUp()
    expect((await dashboard('?regulation=M-B')).summary.rounds.wins).toBe(1)
    expect((await dashboard('?regulation=all')).summary.rounds.wins).toBe(4)
  })

  it('filters by Season, using its dates', async () => {
    await setUp()
    const body = await dashboard('?regulation=all&season=2026')
    expect(body.filters).toMatchObject({ season: '2026', from: '2026-04-08', to: '2026-08-30' })
    expect(body.summary.rounds.wins).toBe(2)
    expect(body.summary.championshipPoints).toEqual([
      { season: { id: '2026', name: '2026 Season', partial: true }, points: 50 },
    ])
    expect(body.summary.includesPartialSeason).toBe(true)
  })

  it('filters by a date range, Event tier and setting', async () => {
    await setUp()
    expect(
      (await dashboard('?regulation=all&from=2026-07-01&to=2026-09-19')).summary.rounds.wins,
    ).toBe(2)
    expect(
      (await dashboard('?regulation=all&eventTier=regional&eventTier=grassroots')).summary.rounds
        .wins,
    ).toBe(3)
    expect((await dashboard('?regulation=all&setting=online')).summary.rounds.wins).toBe(1)
    expect((await dashboard('?regulation=all&setting=in-person')).summary.rounds.wins).toBe(3)
  })

  it('refuses a Season together with a date range, and unknown filters', async () => {
    await setUp()
    const both = await get(t.app, '/api/dashboard?season=2026&from=2026-05-01', ash)
    expect(both.status).toBe(400)
    expect((await json(both)).fields).toHaveProperty('season')
    expect((await get(t.app, '/api/dashboard?season=1999', ash)).status).toBe(400)
    expect((await get(t.app, '/api/dashboard?regulation=H', ash)).status).toBe(400)
  })

  it('only counts the User’s own Tournaments', async () => {
    await setUp()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    const body = await json(await get(t.app, '/api/dashboard?regulation=all', misty))
    expect(body.summary.tournamentsPlayed).toBe(0)
  })
})

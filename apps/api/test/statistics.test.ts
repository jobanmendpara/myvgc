import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, get, json, post, put, signUp } from './app'

const SUN = `Incineroar @ Sitrus Berry
Ability: Intimidate
- Fake Out
`

describe('GET /api/statistics', () => {
  let t: TestApp
  let ash: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
  }
  const addTournament = async (fields: object = {}) =>
    (
      await json(
        await post(
          t.app,
          '/api/tournaments',
          {
            name: 'Regional',
            startDate: '2026-10-10',
            regulation: 'M-C',
            eventTier: 'regional',
            ...fields,
          },
          ash,
        ),
      )
    ).id as string
  const logRound = (tournamentId: string, body: object) =>
    post(t.app, `/api/tournaments/${tournamentId}/rounds`, body, ash)
  const statistics = async (query = '') => json(await get(t.app, `/api/statistics${query}`, ash))

  it('counts species faced from Opponent’s Teams, and Leads and Brought Pokémon from Games', async () => {
    await setUp()
    const id = await addTournament()
    await logRound(id, {
      bestOf: 1,
      newOpponentName: 'Wolfe',
      opponentTeam: [{ species: 'rillaboom' }, { species: 'kingambit' }],
      games: [{ number: 1, result: 'win', brought: ['incineroar'], leads: ['incineroar'] }],
    })
    await logRound(id, { result: 'loss', newOpponentName: 'Aaron' })
    await logRound(id, { bye: true })

    const body = await statistics('?regulation=M-C')
    expect(body.filters).toMatchObject({ regulation: 'M-C', team: null })
    expect(body.statistics.speciesFaced).toEqual({
      rows: [
        { species: 'kingambit', played: 1, wins: 1, losses: 0, ties: 0, winRate: 1 },
        { species: 'rillaboom', played: 1, wins: 1, losses: 0, ties: 0, winRate: 1 },
      ],
      coverage: { counted: 1, of: 2, noOpponentTeam: 1 },
    })
    expect(body.statistics.leads.rows).toEqual([
      { species: 'incineroar', played: 1, wins: 1, losses: 0, ties: 0, winRate: 1 },
    ])
    expect(body.statistics.brought.coverage).toEqual({
      counted: 1,
      of: 1,
      noResult: 0,
      noBrought: 0,
    })
  })

  it('applies the dashboard’s filters', async () => {
    await setUp()
    const online = await addTournament({ eventTier: 'online', online: true })
    await logRound(online, { result: 'win', newOpponentName: 'X' })
    await logRound(await addTournament(), { result: 'win', newOpponentName: 'Y' })

    const of = async (query: string) =>
      (await statistics(query)).statistics.speciesFaced.coverage.of
    expect(await of('?regulation=all')).toBe(2)
    expect(await of('?regulation=all&setting=online')).toBe(1)
    expect(await of('?regulation=M-A')).toBe(0)
    expect((await get(t.app, '/api/statistics?season=2026&from=2026-05-01', ash)).status).toBe(400)
  })

  it('filters by Team, keeping the Tournaments whose Team snapshot came from it', async () => {
    await setUp()
    const { team } = await json(
      await post(t.app, '/api/teams', { name: 'Sun', regulation: 'M-C', paste: SUN }, ash),
    )
    const withTeam = await addTournament()
    await put(t.app, `/api/tournaments/${withTeam}/team`, { teamId: team.id }, ash)
    await logRound(withTeam, { result: 'win', newOpponentName: 'X' })
    await logRound(await addTournament(), { result: 'win', newOpponentName: 'Y' })

    const body = await statistics(`?regulation=all&team=${team.id}`)
    expect(body.filters.team).toBe(team.id)
    expect(body.statistics.speciesFaced.coverage.of).toBe(1)
    expect((await get(t.app, '/api/statistics?team=nope', ash)).status).toBe(400)
  })

  it('only counts the User’s own Tournaments', async () => {
    await setUp()
    await logRound(await addTournament(), { result: 'win', newOpponentName: 'X' })
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    const body = await json(await get(t.app, '/api/statistics?regulation=all', misty))
    expect(body.statistics.speciesFaced.coverage.of).toBe(0)
  })
})

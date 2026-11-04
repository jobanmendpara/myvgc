import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, del, get, json, patch, post, signUp } from './app'

const REGIONAL = {
  name: 'Toronto Regional',
  startDate: '2026-09-19',
  eventTier: 'regional',
  defaultBestOf: 3,
  playerCount: 128,
}

describe('Rounds', () => {
  let t: TestApp
  let ash: string
  let tournamentId: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
    tournamentId = (await json(await post(t.app, '/api/tournaments', REGIONAL, ash))).id
  }
  const logRound = (body: object, cookie = ash) =>
    post(t.app, `/api/tournaments/${tournamentId}/rounds`, body, cookie)

  it('logs a Round against a new Opponent, numbering it and taking the Tournament’s best-of', async () => {
    await setUp()
    const res = await logRound({
      result: 'win',
      newOpponentName: 'Wolfe Glick',
      notes: 'Led Incin + Rilla',
    })

    expect(res.status).toBe(201)
    const body = await json(res)
    expect(body.round).toMatchObject({
      phase: 'swiss',
      roundNumber: 1,
      stage: null,
      bestOf: 3,
      bye: false,
      result: 'win',
      gameScore: null,
      opponent: { id: expect.any(String), displayName: 'Wolfe Glick' },
      notes: 'Led Incin + Rilla',
    })
    expect(body.record.swiss).toEqual({ wins: 1, losses: 0, ties: 0 })

    const opponents = await json(await get(t.app, '/api/opponents', ash))
    expect(opponents.map((o: { displayName: string }) => o.displayName)).toEqual(['Wolfe Glick'])
  })

  it('logs a Round against an Opponent the User already has, and numbers Rounds in order', async () => {
    await setUp()
    const first = await json(await logRound({ result: 'loss', newOpponentName: 'Aaron Zheng' }))
    const second = await json(
      await logRound({ result: 'win', opponentId: first.round.opponent.id, bestOf: 1 }),
    )

    expect(second.round).toMatchObject({
      roundNumber: 2,
      bestOf: 1,
      opponent: first.round.opponent,
    })
    expect(second.record.swiss).toEqual({ wins: 1, losses: 1, ties: 0 })
    expect(await json(await get(t.app, '/api/opponents', ash))).toHaveLength(1)
  })

  it('logs a Bye as a win with no Opponent', async () => {
    await setUp()
    const body = await json(await logRound({ bye: true }))
    expect(body.round).toMatchObject({ bye: true, result: 'win', opponent: null })
    expect(body.record.swiss.wins).toBe(1)
  })

  it('lets a Game score decide the result', async () => {
    await setUp()
    const body = await json(
      await logRound({ result: 'win', gameScore: { won: 1, lost: 2 }, newOpponentName: 'X' }),
    )
    expect(body.round).toMatchObject({ result: 'loss', gameScore: { won: 1, lost: 2 } })
  })

  it('logs Top cut Rounds by stage and suggests a Placement after a loss', async () => {
    await setUp()
    await logRound({ result: 'win', newOpponentName: 'A' })
    const top8 = await json(
      await logRound({ phase: 'top-cut', stage: 'top-8', result: 'win', newOpponentName: 'B' }),
    )
    expect(top8.round).toMatchObject({ phase: 'top-cut', stage: 'top-8', roundNumber: null })
    expect(top8.suggestedPlacement).toBeNull()

    const top4 = await json(
      await logRound({
        phase: 'top-cut',
        stage: 'top-4',
        gameScore: { won: 0, lost: 2 },
        newOpponentName: 'C',
      }),
    )
    expect(top4.record).toEqual({
      swiss: { wins: 1, losses: 0, ties: 0 },
      topCut: { wins: 1, losses: 1, ties: 0 },
    })
    expect(top4.suggestedPlacement).toBe(3)
  })

  it('stops suggesting a Placement once the Tournament has one', async () => {
    await setUp()
    await patch(t.app, `/api/tournaments/${tournamentId}`, { placement: 4 }, ash)
    const body = await json(
      await logRound({ phase: 'top-cut', stage: 'top-4', result: 'loss', newOpponentName: 'C' }),
    )
    expect(body.suggestedPlacement).toBeNull()
  })

  it.each([
    [{ result: 'win' }, 'opponent'],
    [{ bye: true, newOpponentName: 'X' }, 'opponent'],
    [{ newOpponentName: 'X' }, 'result'],
    [
      { result: 'win', newOpponentName: 'X', bestOf: 1, gameScore: { won: 1, lost: 0 } },
      'gameScore',
    ],
    [{ phase: 'top-cut', result: 'win', newOpponentName: 'X' }, 'stage'],
    [{ result: 'win', newOpponentName: '   ' }, 'newOpponentName'],
  ])('refuses an invalid Round (%j)', async (body, field) => {
    await setUp()
    const res = await logRound(body)
    expect(res.status).toBe(400)
    expect((await json(res)).fields).toHaveProperty([field])
    expect(await json(await get(t.app, '/api/opponents', ash))).toEqual([])
  })

  it('refuses a Swiss round number or Top cut stage that is already logged', async () => {
    await setUp()
    await logRound({ roundNumber: 3, result: 'win', newOpponentName: 'A' })
    await logRound({ phase: 'top-cut', stage: 'top-8', result: 'win', newOpponentName: 'B' })

    const number = await logRound({ roundNumber: 3, result: 'loss', newOpponentName: 'C' })
    expect(number.status).toBe(400)
    expect((await json(number)).fields).toHaveProperty('roundNumber')
    const stage = await logRound({
      phase: 'top-cut',
      stage: 'top-8',
      result: 'loss',
      newOpponentName: 'D',
    })
    expect(stage.status).toBe(400)
    expect((await json(stage)).fields).toHaveProperty('stage')
  })

  it('answers 400, not a server error, when the same Round is logged twice at once', async () => {
    await setUp()
    const results = await Promise.all([
      logRound({ roundNumber: 1, result: 'win', newOpponentName: 'A' }),
      logRound({ roundNumber: 1, result: 'win', newOpponentName: 'A' }),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([201, 400])
  })

  it('shows the Tournament’s Rounds in order with its Record', async () => {
    await setUp()
    await logRound({ phase: 'top-cut', stage: 'top-8', result: 'loss', newOpponentName: 'C' })
    await logRound({ roundNumber: 2, result: 'loss', newOpponentName: 'B' })
    await logRound({ roundNumber: 1, result: 'win', newOpponentName: 'A' })

    const body = await json(await get(t.app, `/api/tournaments/${tournamentId}`, ash))
    expect(
      body.rounds.map((r: { opponent: { displayName: string } }) => r.opponent.displayName),
    ).toEqual(['A', 'B', 'C'])
    expect(body.record).toEqual({
      swiss: { wins: 1, losses: 1, ties: 0 },
      topCut: { wins: 0, losses: 1, ties: 0 },
    })
    const list = await json(await get(t.app, '/api/tournaments', ash))
    expect(list[0].record.swiss).toEqual({ wins: 1, losses: 1, ties: 0 })
  })

  it('changes and deletes a Round', async () => {
    await setUp()
    const { round } = await json(await logRound({ result: 'win', newOpponentName: 'A' }))
    const url = `/api/tournaments/${tournamentId}/rounds/${round.id}`

    const changed = await patch(
      t.app,
      url,
      { roundNumber: 1, result: 'tie', opponentId: round.opponent.id, notes: 'Timed out' },
      ash,
    )
    expect(changed.status).toBe(200)
    expect((await json(changed)).round).toMatchObject({ result: 'tie', notes: 'Timed out' })

    expect((await del(t.app, url, ash)).status).toBe(200)
    expect((await json(await get(t.app, `/api/tournaments/${tournamentId}`, ash))).rounds).toEqual(
      [],
    )
  })

  it('keeps Rounds and Opponents private to their User', async () => {
    await setUp()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    const { round } = await json(await logRound({ result: 'win', newOpponentName: 'A' }))
    const url = `/api/tournaments/${tournamentId}/rounds/${round.id}`

    expect((await logRound({ result: 'win', newOpponentName: 'B' }, misty)).status).toBe(404)
    expect(
      (await patch(t.app, url, { roundNumber: 1, result: 'loss', newOpponentName: 'C' }, misty))
        .status,
    ).toBe(404)
    // A delete has nothing of Misty's to remove, so it is done, and Ash's Round stays.
    expect((await del(t.app, url, misty)).status).toBe(204)
    expect(
      (await json(await get(t.app, `/api/tournaments/${tournamentId}`, ash))).rounds,
    ).toHaveLength(1)
    expect(await json(await get(t.app, '/api/opponents', misty))).toEqual([])

    // Misty can't log a Round of her own against Ash's Opponent.
    const mistys = (await json(await post(t.app, '/api/tournaments', REGIONAL, misty))).id
    const res = await post(
      t.app,
      `/api/tournaments/${mistys}/rounds`,
      { result: 'win', opponentId: round.opponent.id },
      misty,
    )
    expect(res.status).toBe(400)
    expect((await json(res)).fields).toHaveProperty('opponentId')
  })

  it('deletes a Tournament’s Rounds with it, but keeps its Opponents', async () => {
    await setUp()
    await logRound({ result: 'win', newOpponentName: 'A' })
    expect((await del(t.app, `/api/tournaments/${tournamentId}`, ash)).status).toBe(204)
    expect(await json(await get(t.app, '/api/opponents', ash))).toHaveLength(1)
  })
})

describe('Finding Opponents', () => {
  let t: TestApp
  afterEach(async () => {
    await t?.client.close()
  })

  it('matches display names and Aliases, ignoring case, exact matches first', async () => {
    t = await createTestApp()
    const ash = (await signUp(t.app, 'ash@example.com')).cookie
    await post(t.app, '/api/opponents', { displayName: 'Wolfe Glick', aliases: ['wolfey'] }, ash)
    await post(t.app, '/api/opponents', { displayName: 'Wolf', aliases: [] }, ash)
    await post(t.app, '/api/opponents', { displayName: 'Aaron Zheng', aliases: ['Cybertron'] }, ash)

    const names = async (q: string) =>
      (await json(await get(t.app, `/api/opponents?q=${encodeURIComponent(q)}`, ash))).map(
        (o: { displayName: string }) => o.displayName,
      )
    expect(await names('wolf')).toEqual(['Wolf', 'Wolfe Glick'])
    expect(await names('WOLFEY')).toEqual(['Wolfe Glick'])
    expect(await names('cyber')).toEqual(['Aaron Zheng'])
    expect(await names('100%')).toEqual([])
  })

  it('returns only as many as asked for, so the Round form loads just its suggestions', async () => {
    t = await createTestApp()
    const ash = (await signUp(t.app, 'ash@example.com')).cookie
    for (const name of ['A', 'B', 'C'])
      await post(t.app, '/api/opponents', { displayName: name }, ash)
    expect(await json(await get(t.app, '/api/opponents?limit=2', ash))).toHaveLength(2)
    expect(await json(await get(t.app, '/api/opponents', ash))).toHaveLength(3)
  })
})

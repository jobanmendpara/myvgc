import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, del, get, json, patch, post, signUp } from './app'

const LOCAL = {
  name: 'Game Store Local',
  startDate: '2026-09-19',
  eventTier: 'local',
  defaultBestOf: 3,
}

describe('Opponent’s Age Divisions', () => {
  let t: TestApp
  let ash: string
  let tournamentId: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
    tournamentId = (await json(await post(t.app, '/api/tournaments', LOCAL, ash))).id
  }
  const rounds = () => `/api/tournaments/${tournamentId}/rounds`
  const logRound = (body: object) => post(t.app, rounds(), body, ash)
  const editRound = (id: string, body: object) => patch(t.app, `${rounds()}/${id}`, body, ash)
  const tournament = async () => json(await get(t.app, `/api/tournaments/${tournamentId}`, ash))

  it('is saved with a Round and shown on the Round, its Tournament and the Opponent', async () => {
    await setUp()
    const res = await logRound({
      result: 'win',
      newOpponentName: 'Wolfe Glick',
      opponentAgeDivision: 'Senior',
    })

    expect(res.status).toBe(201)
    const saved = await json(res)
    const opponentId = saved.round.opponent.id
    expect(saved.opponentAgeDivision).toBe('Senior')
    expect((await tournament()).opponentAgeDivisions).toEqual([
      { opponentId, ageDivision: 'Senior' },
    ])
    const list = await json(await get(t.app, '/api/tournaments', ash))
    expect(list[0].opponentAgeDivisions).toEqual([{ opponentId, ageDivision: 'Senior' }])
    const detail = await json(await get(t.app, `/api/opponents/${opponentId}`, ash))
    expect(detail.opponentAgeDivisions).toEqual([{ tournamentId, ageDivision: 'Senior' }])
  })

  it('stands without an Opponent’s Team', async () => {
    await setUp()
    const saved = await json(
      await logRound({
        result: 'win',
        newOpponentName: 'Wolfe Glick',
        opponentAgeDivision: 'Junior',
      }),
    )
    expect(saved.opponentTeam).toBeNull()
    expect(saved.opponentAgeDivision).toBe('Junior')
  })

  it('is shared by every Round against that Opponent, kept when left out and cleared by null', async () => {
    await setUp()
    const first = await json(
      await logRound({
        result: 'win',
        newOpponentName: 'Wolfe Glick',
        opponentAgeDivision: 'Junior',
      }),
    )
    const opponentId = first.round.opponent.id
    const second = await json(
      await logRound({ phase: 'top-cut', stage: 'top-8', result: 'loss', opponentId }),
    )
    expect(second.opponentAgeDivision).toBe('Junior')

    const changed = await json(
      await editRound(second.round.id, {
        phase: 'top-cut',
        stage: 'top-8',
        result: 'loss',
        opponentId,
        opponentAgeDivision: 'Senior',
      }),
    )
    expect(changed.opponentAgeDivision).toBe('Senior')
    expect((await tournament()).opponentAgeDivisions).toHaveLength(1)

    const cleared = await json(
      await editRound(first.round.id, { result: 'win', opponentId, opponentAgeDivision: null }),
    )
    expect(cleared.opponentAgeDivision).toBeNull()
    expect((await tournament()).opponentAgeDivisions).toEqual([])
  })

  it.each<[string, object]>([
    ['on a Bye', { bye: true, opponentAgeDivision: 'Junior' }],
    ['with no Opponent', { result: 'win', opponentAgeDivision: 'Junior' }],
    [
      'that isn’t an Age Division',
      { result: 'win', newOpponentName: 'X', opponentAgeDivision: 'Adult' },
    ],
  ])('is refused %s', async (_, body) => {
    await setUp()
    const res = await logRound(body)
    expect(res.status).toBe(400)
    expect(Object.keys((await json(res)).fields)).toContain('opponentAgeDivision')
  })

  it('goes once the last Round against that Opponent is deleted', async () => {
    await setUp()
    const first = await json(
      await logRound({
        result: 'win',
        newOpponentName: 'Wolfe Glick',
        opponentAgeDivision: 'Junior',
      }),
    )
    const opponentId = first.round.opponent.id
    const second = await json(
      await logRound({ phase: 'top-cut', stage: 'top-8', result: 'loss', opponentId }),
    )

    await del(t.app, `${rounds()}/${first.round.id}`, ash)
    expect((await tournament()).opponentAgeDivisions).toHaveLength(1)
    await del(t.app, `${rounds()}/${second.round.id}`, ash)
    expect((await tournament()).opponentAgeDivisions).toEqual([])
  })

  it('goes when its only Round changes Opponent', async () => {
    await setUp()
    const saved = await json(
      await logRound({
        result: 'win',
        newOpponentName: 'Wolfe Glick',
        opponentAgeDivision: 'Junior',
      }),
    )
    const edited = await json(
      await editRound(saved.round.id, { result: 'win', newOpponentName: 'Aaron Zheng' }),
    )
    expect(edited.opponentAgeDivision).toBeNull()
    expect((await tournament()).opponentAgeDivisions).toEqual([])
  })

  it('keeps the survivor’s in a merge, and moves the duplicate’s where the survivor has none', async () => {
    await setUp()
    const other = await json(
      await post(t.app, '/api/tournaments', { ...LOCAL, startDate: '2026-10-03' }, ash),
    )
    const wolfe = await json(
      await logRound({
        result: 'win',
        newOpponentName: 'Wolfe Glick',
        opponentAgeDivision: 'Senior',
      }),
    )
    const wolfey = await json(
      await logRound({
        phase: 'top-cut',
        stage: 'top-8',
        result: 'loss',
        newOpponentName: 'wolfey',
        opponentAgeDivision: 'Junior',
      }),
    )
    const duplicateId = wolfey.round.opponent.id
    await post(
      t.app,
      `/api/tournaments/${other.id}/rounds`,
      { result: 'win', opponentId: duplicateId, opponentAgeDivision: 'Masters' },
      ash,
    )
    const survivorId = wolfe.round.opponent.id
    const res = await post(t.app, `/api/opponents/${survivorId}/merge`, { duplicateId }, ash)
    expect(res.status).toBe(200)

    expect((await tournament()).opponentAgeDivisions).toEqual([
      { opponentId: survivorId, ageDivision: 'Senior' },
    ])
    const moved = await json(await get(t.app, `/api/tournaments/${other.id}`, ash))
    expect(moved.opponentAgeDivisions).toEqual([{ opponentId: survivorId, ageDivision: 'Masters' }])
  })
})

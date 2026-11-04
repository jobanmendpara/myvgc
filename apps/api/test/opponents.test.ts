import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, del, get, json, patch, post, signUp } from './app'

describe('Opponents', () => {
  let t: TestApp
  let ash: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
  }
  async function playedAt(name: string, startDate: string, rounds: object[]) {
    const { id } = await json(
      await post(t.app, '/api/tournaments', { name, startDate, eventTier: 'regional' }, ash),
    )
    for (const round of rounds) await post(t.app, `/api/tournaments/${id}/rounds`, round, ash)
    return id as string
  }

  it('adds an Opponent with Aliases, dropping repeats', async () => {
    await setUp()
    const res = await post(
      t.app,
      '/api/opponents',
      {
        displayName: ' Wolfe Glick ',
        aliases: ['wolfey', 'Wolfey', 'WolfeyVGC'],
        notes: 'Loves Trick Room',
      },
      ash,
    )
    expect(res.status).toBe(201)
    expect(await json(res)).toMatchObject({
      displayName: 'Wolfe Glick',
      aliases: ['wolfey', 'WolfeyVGC'],
      notes: 'Loves Trick Room',
      headToHead: { wins: 0, losses: 0, ties: 0 },
      roundCount: 0,
    })
  })

  it('shows an Opponent with their Head-to-head record and every Round against them, newest first', async () => {
    await setUp()
    const { id } = await json(
      await post(t.app, '/api/opponents', { displayName: 'Wolfe Glick' }, ash),
    )
    await playedAt('Older', '2026-05-01', [
      { result: 'win', opponentId: id, notes: 'Won the speed tie' },
    ])
    await playedAt('Newer', '2026-09-19', [
      { bye: true },
      { result: 'loss', opponentId: id },
      { phase: 'top-cut', stage: 'top-8', result: 'tie', opponentId: id },
    ])

    const res = await get(t.app, `/api/opponents/${id}`, ash)
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.headToHead).toEqual({ wins: 1, losses: 1, ties: 1 })
    expect(body.roundCount).toBe(3)
    expect(
      body.rounds.map((r: { tournament: { name: string }; result: string }) => [
        r.tournament.name,
        r.result,
      ]),
    ).toEqual([
      ['Newer', 'tie'],
      ['Newer', 'loss'],
      ['Older', 'win'],
    ])
    expect(body.rounds[2].notes).toBe('Won the speed tie')

    const list = await json(await get(t.app, '/api/opponents', ash))
    expect(list[0].headToHead).toEqual({ wins: 1, losses: 1, ties: 1 })
  })

  it('renames an Opponent and replaces their Aliases', async () => {
    await setUp()
    const { id } = await json(
      await post(t.app, '/api/opponents', { displayName: 'Wolf', aliases: ['a', 'b'] }, ash),
    )
    const res = await patch(
      t.app,
      `/api/opponents/${id}`,
      { displayName: 'Wolfe Glick', aliases: ['wolfey'] },
      ash,
    )
    expect(res.status).toBe(200)
    expect(await json(res)).toMatchObject({ displayName: 'Wolfe Glick', aliases: ['wolfey'] })

    const notesOnly = await json(
      await patch(t.app, `/api/opponents/${id}`, { notes: 'Scouted' }, ash),
    )
    expect(notesOnly).toMatchObject({
      displayName: 'Wolfe Glick',
      aliases: ['wolfey'],
      notes: 'Scouted',
    })
  })

  it('deletes an Opponent with no Rounds, but not one with Rounds', async () => {
    await setUp()
    const unplayed = await json(await post(t.app, '/api/opponents', { displayName: 'Typo' }, ash))
    expect((await del(t.app, `/api/opponents/${unplayed.id}`, ash)).status).toBe(204)
    expect((await get(t.app, `/api/opponents/${unplayed.id}`, ash)).status).toBe(404)

    const played = await json(await post(t.app, '/api/opponents', { displayName: 'Wolfe' }, ash))
    await playedAt('Locals', '2026-05-01', [{ result: 'win', opponentId: played.id }])
    const res = await del(t.app, `/api/opponents/${played.id}`, ash)
    expect(res.status).toBe(409)
    expect((await json(res)).error).toMatch(/Rename/)
  })

  it('refuses an Opponent with no name', async () => {
    await setUp()
    const res = await post(t.app, '/api/opponents', { displayName: '  ' }, ash)
    expect(res.status).toBe(400)
    expect((await json(res)).fields).toHaveProperty('displayName')
  })

  it('keeps Opponents private to their User', async () => {
    await setUp()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    const { id } = await json(await post(t.app, '/api/opponents', { displayName: 'Wolfe' }, ash))
    expect((await get(t.app, `/api/opponents/${id}`, misty)).status).toBe(404)
    expect(
      (await patch(t.app, `/api/opponents/${id}`, { displayName: 'Mine' }, misty)).status,
    ).toBe(404)
    expect((await del(t.app, `/api/opponents/${id}`, misty)).status).toBe(404)
  })
})

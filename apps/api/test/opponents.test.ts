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

  describe('merging', () => {
    const merge = (survivorId: string, duplicateId: unknown, cookie = ash) =>
      post(t.app, `/api/opponents/${survivorId}/merge`, { duplicateId }, cookie)

    it("moves the duplicate's Rounds to the survivor, combines Aliases and notes, and deletes the duplicate", async () => {
      await setUp()
      const survivor = await json(
        await post(
          t.app,
          '/api/opponents',
          { displayName: 'Wolfe Glick', aliases: ['wolfey'], notes: 'Leads Incineroar' },
          ash,
        ),
      )
      const duplicate = await json(
        await post(
          t.app,
          '/api/opponents',
          { displayName: 'WolfeyVGC', aliases: ['Wolfey', 'Wolfe G.'], notes: 'Loves Trick Room' },
          ash,
        ),
      )
      await playedAt('Locals', '2026-05-01', [
        { result: 'win', opponentId: survivor.id },
        { result: 'loss', opponentId: duplicate.id, notes: 'Lost to Trick Room' },
      ])

      const res = await merge(survivor.id, duplicate.id)
      expect(res.status).toBe(200)
      expect(await json(res)).toMatchObject({
        id: survivor.id,
        displayName: 'Wolfe Glick',
        aliases: ['Wolfe G.', 'wolfey', 'WolfeyVGC'],
        notes: 'Leads Incineroar\n\n---\n\n**From WolfeyVGC:**\n\nLoves Trick Room',
        headToHead: { wins: 1, losses: 1, ties: 0 },
        roundCount: 2,
      })

      const detail = await json(await get(t.app, `/api/opponents/${survivor.id}`, ash))
      expect(detail.rounds.map((r: { notes: string }) => r.notes)).toContain('Lost to Trick Room')
      expect((await get(t.app, `/api/opponents/${duplicate.id}`, ash)).status).toBe(404)
      const search = await json(await get(t.app, '/api/opponents?q=WolfeyVGC', ash))
      expect(search.map((o: { id: string }) => o.id)).toEqual([survivor.id])
    })

    it('refuses a merge that would leave too many Aliases, and changes nothing', async () => {
      await setUp()
      const many = (prefix: string) => Array.from({ length: 10 }, (_, i) => `${prefix}${i}`)
      const survivor = await json(
        await post(t.app, '/api/opponents', { displayName: 'A', aliases: many('a') }, ash),
      )
      const duplicate = await json(
        await post(t.app, '/api/opponents', { displayName: 'B', aliases: many('b') }, ash),
      )
      const res = await merge(survivor.id, duplicate.id)
      expect(res.status).toBe(409)
      expect((await json(res)).fields).toHaveProperty('aliases')
      expect((await get(t.app, `/api/opponents/${duplicate.id}`, ash)).status).toBe(200)
      expect((await json(await get(t.app, `/api/opponents/${survivor.id}`, ash))).aliases).toEqual(
        survivor.aliases,
      )
    })

    it('refuses to merge an Opponent into themselves, or one that is gone', async () => {
      await setUp()
      const survivor = await json(await post(t.app, '/api/opponents', { displayName: 'A' }, ash))
      const duplicate = await json(await post(t.app, '/api/opponents', { displayName: 'B' }, ash))

      const itself = await merge(survivor.id, survivor.id)
      expect(itself.status).toBe(400)
      expect((await json(itself)).fields).toHaveProperty('duplicateId')

      expect((await merge(survivor.id, duplicate.id)).status).toBe(200)
      // A replay finds the duplicate already gone.
      const replay = await merge(survivor.id, duplicate.id)
      expect(replay.status).toBe(400)
      expect((await json(replay)).fields).toHaveProperty('duplicateId')

      expect((await merge(survivor.id, 'not-an-id')).status).toBe(400)
    })

    it("can't merge another User's Opponents", async () => {
      await setUp()
      const misty = (await signUp(t.app, 'misty@example.com')).cookie
      const ashs = await json(await post(t.app, '/api/opponents', { displayName: 'A' }, ash))
      const mistys = await json(await post(t.app, '/api/opponents', { displayName: 'M' }, misty))

      expect((await merge(mistys.id, ashs.id, ash)).status).toBe(404)
      const res = await merge(ashs.id, mistys.id, ash)
      expect(res.status).toBe(400)
      expect((await json(res)).fields).toHaveProperty('duplicateId')
      expect((await get(t.app, `/api/opponents/${mistys.id}`, misty)).status).toBe(200)
    })
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
    // A delete has nothing of Misty's to remove, so it is done, and Ash's Opponent stays.
    expect((await del(t.app, `/api/opponents/${id}`, misty)).status).toBe(204)
    expect((await get(t.app, `/api/opponents/${id}`, ash)).status).toBe(200)
  })
})

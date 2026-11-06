import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, del, get, json, patch, post, signUp } from './app'

describe('Note entries', () => {
  let t: TestApp
  let ash: string
  let opponentId: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
    opponentId = (await json(await post(t.app, '/api/opponents', { displayName: 'Wolfe' }, ash))).id
  }
  const add = (entry: object, cookie = ash, to = opponentId) =>
    post(t.app, `/api/opponents/${to}/note-entries`, entry, cookie)
  const entriesOf = async (id = opponentId, cookie = ash) =>
    (await json(await get(t.app, `/api/opponents/${id}`, cookie))).noteEntries as {
      id: string
      date: string
      text: string
    }[]

  it('adds dated Note entries to an Opponent, shown newest first', async () => {
    await setUp()
    const res = await add({ date: '2026-05-01', text: ' Leads Incineroar ' })
    expect(res.status).toBe(201)
    expect(await json(res)).toMatchObject({ date: '2026-05-01', text: 'Leads Incineroar' })
    await add({ date: '2026-09-19', text: 'Swapped to Rain' })
    await add({ date: '2026-05-01', text: 'Friendly' })

    expect((await entriesOf()).map((e) => [e.date, e.text])).toEqual([
      ['2026-09-19', 'Swapped to Rain'],
      // On the same date, the one added later comes first.
      ['2026-05-01', 'Friendly'],
      ['2026-05-01', 'Leads Incineroar'],
    ])
  })

  it('answers a replayed add with the saved Note entry, adding nothing', async () => {
    await setUp()
    const id = crypto.randomUUID()
    expect((await add({ id, date: '2026-05-01', text: 'First send' })).status).toBe(201)
    const replay = await add({ id, date: '2026-05-01', text: 'Second send' })
    expect(replay.status).toBe(200)
    expect(await json(replay)).toMatchObject({ id, text: 'First send' })
    expect(await entriesOf()).toHaveLength(1)
  })

  it('refuses an ID already used on another Opponent or by another User', async () => {
    await setUp()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    const mistys = (await json(await post(t.app, '/api/opponents', { displayName: 'M' }, misty))).id
    const other = (await json(await post(t.app, '/api/opponents', { displayName: 'B' }, ash))).id
    const id = crypto.randomUUID()
    await add({ id, date: '2026-05-01', text: 'Scouted' })

    expect((await add({ id, date: '2026-05-01', text: 'Scouted' }, ash, other)).status).toBe(409)
    expect((await add({ id, date: '2026-05-01', text: 'Scouted' }, misty, mistys)).status).toBe(409)
    expect(await entriesOf(other)).toEqual([])
  })

  it("can't add to another User's Opponent", async () => {
    await setUp()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    expect((await add({ date: '2026-05-01', text: 'Mine now' }, misty)).status).toBe(404)
    expect(await entriesOf()).toEqual([])
  })

  it('refuses a Note entry with no text, naming the field', async () => {
    await setUp()
    const res = await add({ date: '2026-05-01', text: '  ' })
    expect(res.status).toBe(400)
    expect((await json(res)).fields).toHaveProperty('text')
  })

  it('changes the date or the text of a Note entry, and re-sorts it', async () => {
    await setUp()
    const first = await json(await add({ date: '2026-05-01', text: 'Leads Incineroar' }))
    await add({ date: '2026-06-01', text: 'Friendly' })
    const path = `/api/note-entries/${first.id}`

    const res = await patch(t.app, path, { date: '2026-07-01' }, ash)
    expect(res.status).toBe(200)
    expect(await json(res)).toMatchObject({ date: '2026-07-01', text: 'Leads Incineroar' })
    await patch(t.app, path, { text: 'Leads Amoonguss' }, ash)
    expect((await entriesOf()).map((e) => e.text)).toEqual(['Leads Amoonguss', 'Friendly'])

    expect((await json(await patch(t.app, path, { text: '' }, ash))).fields).toHaveProperty('text')
  })

  it("answers 404 for an edit of a Note entry that is gone or another User's", async () => {
    await setUp()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    const { id } = await json(await add({ date: '2026-05-01', text: 'Scouted' }))
    const path = `/api/note-entries/${id}`

    expect((await patch(t.app, path, { text: 'Mine now' }, misty)).status).toBe(404)
    expect((await entriesOf())[0]!.text).toBe('Scouted')
    await del(t.app, path, ash)
    expect((await patch(t.app, path, { text: 'Too late' }, ash)).status).toBe(404)
  })

  it("deletes a Note entry, answering as done when it is already gone or another User's", async () => {
    await setUp()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    const { id } = await json(await add({ date: '2026-05-01', text: 'Scouted' }))
    const path = `/api/note-entries/${id}`

    expect((await del(t.app, path, misty)).status).toBe(204)
    expect(await entriesOf()).toHaveLength(1)
    expect((await del(t.app, path, ash)).status).toBe(204)
    expect(await entriesOf()).toEqual([])
    expect((await del(t.app, path, ash)).status).toBe(204)
  })

  it('goes with its Opponent when the Opponent is deleted', async () => {
    await setUp()
    const { id } = await json(await add({ date: '2026-05-01', text: 'Scouted' }))
    expect((await del(t.app, `/api/opponents/${opponentId}`, ash)).status).toBe(204)
    // The ID is free again only if the Note entry itself is gone, not just hidden.
    const other = (await json(await post(t.app, '/api/opponents', { displayName: 'B' }, ash))).id
    expect((await add({ id, date: '2026-05-01', text: 'Scouted' }, ash, other)).status).toBe(201)
  })

  it('moves to the survivor when its Opponent is merged into another', async () => {
    await setUp()
    const survivor = (await json(await post(t.app, '/api/opponents', { displayName: 'W' }, ash))).id
    await add({ date: '2026-05-01', text: 'On the survivor' }, ash, survivor)
    await add({ date: '2026-09-19', text: 'On the duplicate' })

    const res = await post(
      t.app,
      `/api/opponents/${survivor}/merge`,
      { duplicateId: opponentId },
      ash,
    )
    expect(res.status).toBe(200)
    expect((await entriesOf(survivor)).map((e) => e.text)).toEqual([
      'On the duplicate',
      'On the survivor',
    ])

    // A change queued before the merge still finds the Note entry by its ID.
    const moved = (await entriesOf(survivor))[0]!
    expect(
      (await patch(t.app, `/api/note-entries/${moved.id}`, { text: 'Edited' }, ash)).status,
    ).toBe(200)
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, get, json, put, signUp } from './app'

const DEFAULTS = { tournaments: 'detailed', teams: 'detailed', opponents: 'compact' }

describe('List styles', () => {
  let t: TestApp
  let ash: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
  }
  const read = async (cookie = ash) => json(await get(t.app, '/api/account/list-styles', cookie))
  const save = (styles: object, cookie = ash) =>
    put(t.app, '/api/account/list-styles', styles, cookie)

  it('are the defaults until the User chooses some', async () => {
    await setUp()
    const res = await get(t.app, '/api/account/list-styles', ash)
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual(DEFAULTS)
  })

  it('saves List styles and reads them back', async () => {
    await setUp()
    const styles = { tournaments: 'grouped', teams: 'compact', opponents: 'detailed' }
    const res = await save(styles)
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual(styles)
    expect(await read()).toEqual(styles)
  })

  it('replaces them all on each save, so a list left out gets its default', async () => {
    await setUp()
    await save({ tournaments: 'grouped', teams: 'compact', opponents: 'grouped' })
    await save({ teams: 'grouped' })
    expect(await read()).toEqual({ ...DEFAULTS, teams: 'grouped' })
  })

  it("keeps each User's List styles to themselves", async () => {
    await setUp()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    await save({ tournaments: 'grouped' })
    await save({ tournaments: 'compact' }, misty)
    expect((await read()).tournaments).toBe('grouped')
    expect((await read(misty)).tournaments).toBe('compact')
  })

  it('refuses an unknown List style, naming the list, and keeps what was saved', async () => {
    await setUp()
    await save({ teams: 'grouped' })
    const res = await save({ teams: 'cards' })
    expect(res.status).toBe(400)
    expect(Object.keys((await json(res)).fields)).toEqual(['teams'])
    expect((await read()).teams).toBe('grouped')
  })

  it('need a session', async () => {
    await setUp()
    expect((await get(t.app, '/api/account/list-styles')).status).toBe(401)
    expect((await put(t.app, '/api/account/list-styles', { teams: 'grouped' })).status).toBe(401)
  })
})

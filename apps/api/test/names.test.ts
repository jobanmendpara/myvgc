import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, get, json, signUp } from './app'

describe('GET /api/names', () => {
  let t: TestApp
  afterEach(async () => {
    await t?.client.close()
  })

  it('returns the names list for pickers, keyed by Showdown ID', async () => {
    t = await createTestApp()
    const { cookie } = await signUp(t.app, 'ash@example.com')
    const res = await get(t.app, '/api/names', cookie)

    expect(res.status).toBe(200)
    const body = await json(res)
    expect(Object.keys(body).sort()).toEqual([
      'abilities',
      'abilitiesBySpecies',
      'items',
      'moves',
      'species',
    ])
    expect(body.species.floetteeternal).toBe('Floette-Eternal')
    expect(body.moves.moonblast).toBe('Moonblast')
    expect(body.items.floettite).toBe('Floettite')
    expect(body.abilities.flowerveil).toBe('Flower Veil')
    expect(body.abilitiesBySpecies.incineroar).toEqual(['blaze', 'intimidate'])
    expect(Object.keys(body.species)).toHaveLength(392)
  })

  it('needs a session', async () => {
    t = await createTestApp()
    expect((await get(t.app, '/api/names')).status).toBe(401)
  })
})

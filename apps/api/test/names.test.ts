import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, get, json, signUp } from './app'

describe('GET /api/names', () => {
  let t: TestApp
  afterEach(async () => {
    await t?.client.close()
  })

  it('returns the names list for pickers and base stats, keyed by Showdown ID', async () => {
    t = await createTestApp()
    const { cookie } = await signUp(t.app, 'ash@example.com')
    const res = await get(t.app, '/api/names', cookie)

    expect(res.status).toBe(200)
    const body = await json(res)
    expect(Object.keys(body).sort()).toEqual([
      'abilities',
      'abilitiesBySpecies',
      'baseStats',
      'items',
      'moves',
      'species',
    ])
    expect(body.species.floetteeternal).toBe('Floette-Eternal')
    expect(body.moves.moonblast).toBe('Moonblast')
    expect(body.items.floettite).toBe('Floettite')
    expect(body.abilities.flowerveil).toBe('Flower Veil')
    expect(body.abilitiesBySpecies.incineroar).toEqual(['blaze', 'intimidate'])
    expect(body.baseStats.incineroar).toEqual({
      hp: 95,
      atk: 115,
      def: 90,
      spa: 80,
      spd: 90,
      spe: 60,
    })
    expect(Object.keys(body.species)).toHaveLength(392)
  })

  it('needs a session', async () => {
    t = await createTestApp()
    expect((await get(t.app, '/api/names')).status).toBe(401)
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, get, json, signUp } from './app'

describe('GET /api/names', () => {
  let t: TestApp
  afterEach(async () => {
    await t?.client.close()
  })

  it('returns the names list for pickers, base stats, types, power and accuracy, keyed by Showdown ID', async () => {
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
      'moveTypes',
      'moves',
      'powerAndAccuracy',
      'species',
      'typesBySpecies',
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
    expect(body.typesBySpecies.garchomp).toEqual(['dragon', 'ground'])
    expect(body.typesBySpecies.charizardmegax).toEqual(['fire', 'dragon'])
    expect(body.moveTypes.hypervoice).toBe('normal')
    expect(body.powerAndAccuracy.moonblast).toEqual({ power: 95, accuracy: 100 })
    expect(body.powerAndAccuracy.kowtowcleave).toEqual({ power: 85, accuracy: null })
    expect(body.powerAndAccuracy.protect).toBeUndefined()
    expect(Object.keys(body.species)).toHaveLength(392)
  })

  it('needs a session', async () => {
    t = await createTestApp()
    expect((await get(t.app, '/api/names')).status).toBe(401)
  })
})

import { readPaste } from '@myvgc/core'
import { afterEach, describe, expect, it } from 'vitest'
import { team } from '../src/db/schema'
import { type TestApp, createTestApp, json, post, signUp } from './app'

const SUN = `Charizard @ Charizardite Y
Ability: Solar Power
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Heat Wave
- Solar Beam
- Protect

Venusaur (M) @ Focus Sash
Ability: Chlorophyll
EVs: 2 HP / 32 SpA / 32 Spe
Modest Nature
- Sludge Bomb
- Protect`

const RAIN = `Lucy (Basculegion-F) (F) @ Mystic Water
Ability: Adaptability
EVs: 4 HP / 23 Atk / 13 Def / 26 Spe
Adamant Nature
- Wave Crash
- Last Respects`

describe('Team library', () => {
  let t: TestApp
  let ash: string
  let misty: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
    misty = (await signUp(t.app, 'misty@example.com')).cookie
  }
  const create = async (cookie: string, name: string, paste: string) =>
    (await json(await post(t.app, '/api/teams', { name, paste }, cookie))).team
  const get = (path: string, cookie?: string) =>
    t.app.request(path, { headers: cookie ? { cookie } : {} })
  const del = (path: string, cookie?: string) =>
    t.app.request(path, {
      method: 'DELETE',
      headers: { origin: 'http://localhost:3000', ...(cookie ? { cookie } : {}) },
    })

  describe('GET /api/teams', () => {
    it("lists only the User's Teams, newest first", async () => {
      await setUp()
      const sun = await create(ash, 'Sun', SUN)
      await create(misty, "Misty's rain", RAIN)
      const rain = await create(ash, 'Rain', RAIN)

      const res = await get('/api/teams', ash)
      expect(res.status).toBe(200)
      const teams = await json(res)
      expect(teams.map((x: { name: string }) => x.name)).toEqual(['Rain', 'Sun'])
      expect(teams[0]).toEqual(rain)
      expect(teams[1].pokemon.map((p: { names: { species: string } }) => p.names.species)).toEqual([
        'Charizard',
        'Venusaur',
      ])
      expect(teams[1].id).toBe(sun.id)
    })

    it('is empty for a new User', async () => {
      await setUp()
      expect(await json(await get('/api/teams', misty))).toEqual([])
    })

    it('answers 401 without a session', async () => {
      await setUp()
      expect((await get('/api/teams')).status).toBe(401)
    })
  })

  describe('GET /api/teams/:id/paste', () => {
    it('returns a Champions paste that reads back into the same Team', async () => {
      await setUp()
      const created = await create(ash, 'Rain', RAIN)
      const res = await get(`/api/teams/${created.id}/paste`, ash)

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toMatch(/^text\/plain/)
      const paste = await res.text()
      expect(paste).toBe(
        [
          'Lucy (Basculegion-F) (F) @ Mystic Water',
          'Ability: Adaptability',
          'EVs: 4 HP / 23 Atk / 13 Def / 26 Spe',
          'Adamant Nature',
          '- Wave Crash',
          '- Last Respects',
          '',
        ].join('\n'),
      )
      const [stored] = await t.db.select().from(team)
      const read = readPaste(paste)
      expect(read.ok && read.pokemon).toEqual(stored!.pokemon)
    })

    it("answers 404 for another User's Team", async () => {
      await setUp()
      const created = await create(ash, 'Rain', RAIN)
      const res = await get(`/api/teams/${created.id}/paste`, misty)
      expect(res.status).toBe(404)
      expect(await json(res)).toEqual({ error: 'Not found' })
    })

    it('answers 404 for a missing Team and 401 without a session', async () => {
      await setUp()
      const created = await create(ash, 'Rain', RAIN)
      expect((await get('/api/teams/00000000-0000-4000-8000-000000000000/paste', ash)).status).toBe(
        404,
      )
      expect((await get('/api/teams/not-a-uuid/paste', ash)).status).toBe(404)
      expect((await get(`/api/teams/${created.id}/paste`)).status).toBe(401)
    })
  })

  describe('DELETE /api/teams/:id', () => {
    it('deletes the Team', async () => {
      await setUp()
      const created = await create(ash, 'Rain', RAIN)
      const kept = await create(ash, 'Sun', SUN)

      const res = await del(`/api/teams/${created.id}`, ash)
      expect(res.status).toBe(204)
      expect(await res.text()).toBe('')
      expect((await get(`/api/teams/${created.id}`, ash)).status).toBe(404)
      expect((await json(await get('/api/teams', ash))).map((x: { id: string }) => x.id)).toEqual([
        kept.id,
      ])
    })

    it("answers 404 for another User's Team and leaves it alone", async () => {
      await setUp()
      const created = await create(ash, 'Rain', RAIN)

      const res = await del(`/api/teams/${created.id}`, misty)
      expect(res.status).toBe(404)
      expect((await get(`/api/teams/${created.id}`, ash)).status).toBe(200)
    })

    it.each(['00000000-0000-4000-8000-000000000000', 'not-a-uuid'])(
      'answers 404 for %s',
      async (id) => {
        await setUp()
        expect((await del(`/api/teams/${id}`, ash)).status).toBe(404)
      },
    )

    it('answers 404 the second time', async () => {
      await setUp()
      const created = await create(ash, 'Rain', RAIN)
      expect((await del(`/api/teams/${created.id}`, ash)).status).toBe(204)
      expect((await del(`/api/teams/${created.id}`, ash)).status).toBe(404)
    })

    it('answers 401 without a session', async () => {
      await setUp()
      const created = await create(ash, 'Rain', RAIN)
      expect((await del(`/api/teams/${created.id}`)).status).toBe(401)
      expect((await get(`/api/teams/${created.id}`, ash)).status).toBe(200)
    })
  })
})

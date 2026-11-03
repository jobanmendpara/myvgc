import { teamPokemonSchema } from '@myvgc/core'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { team, user } from '../src/db/schema'
import { type TestApp, createTestApp, json, post, signUp } from './app'

const PASTE = `Floette-Eternal @ Floettite
Ability: Flower Veil
Shiny: Yes
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Moonblast
- Light of Ruin
- Protect

Lucy (Basculegion-F) (F) @ Mystic Water
Ability: Adaptability
EVs: 4 HP / 23 Atk / 13 Def / 26 Spe
Adamant Nature
- Wave Crash
- Last Respects
- Aqua Jet
- Protect
`

describe('POST /api/teams', () => {
  let t: TestApp | undefined
  afterEach(async () => {
    await t?.client.close()
    t = undefined
  })

  async function asUser(email = 'ash@example.com') {
    t = t ?? (await createTestApp())
    const { cookie } = await signUp(t.app, email)
    const [row] = await t.db.select({ id: user.id }).from(user).where(eq(user.email, email))
    return { cookie, userId: row!.id }
  }

  it('creates a Team owned by the User', async () => {
    const { cookie, userId } = await asUser()
    const res = await post(
      t!.app,
      '/api/teams',
      { name: 'Fairy rain', regulation: 'M-B', paste: PASTE, notes: 'Lead Floette + Basc.' },
      cookie,
    )

    expect(res.status).toBe(201)
    const body = await json(res)
    expect(body.team).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: 'Fairy rain',
      regulation: 'M-B',
      notes: 'Lead Floette + Basc.',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })
    expect(body.team.pokemon).toHaveLength(2)
    expect(body.team.pokemon[1]).toMatchObject({
      species: 'basculegionf',
      nickname: 'Lucy',
      gender: 'F',
      names: {
        species: 'Basculegion-F',
        item: 'Mystic Water',
        moves: ['Wave Crash', 'Last Respects', 'Aqua Jet', 'Protect'],
      },
    })
    expect(body.team).not.toHaveProperty('ownerId')

    const rows = await t!.db.select().from(team)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.ownerId).toBe(userId)
    expect(rows[0]!.id).toBe(body.team.id)
  })

  it('stores Pokémon that pass the core schema, without display names', async () => {
    const { cookie } = await asUser()
    await post(t!.app, '/api/teams', { name: 'Fairy rain', paste: PASTE }, cookie)

    const [row] = await t!.db.select().from(team)
    expect(teamPokemonSchema.parse(row!.pokemon)).toEqual(row!.pokemon)
    expect(row!.pokemon[0]).not.toHaveProperty('names')
  })

  it('defaults the Regulation to M-C and the notes to empty', async () => {
    const { cookie } = await asUser()
    const res = await post(t!.app, '/api/teams', { name: 'Fairy rain', paste: PASTE }, cookie)
    expect((await json(res)).team).toMatchObject({ regulation: 'M-C', notes: '' })
  })

  it('returns warnings with the new Team', async () => {
    const { cookie } = await asUser()
    const res = await post(t!.app, '/api/teams', { name: 'Fairy rain', paste: PASTE }, cookie)
    expect((await json(res)).warnings).toEqual([
      { line: 3, message: "MyVGC doesn't track shiny Pokémon, so the Shiny line was ignored." },
    ])
  })

  it('rejects a malformed paste with line errors and stores nothing', async () => {
    const { cookie } = await asUser()
    const paste = 'Incineroar @ Choice Specs\nLevel: 50\nEVs: 33 HP\n- Fake Out'
    const res = await post(t!.app, '/api/teams', { name: 'Broken', paste }, cookie)

    expect(res.status).toBe(422)
    expect(await json(res)).toEqual({
      errors: [
        { line: 1, message: '"Choice Specs" is not an item in Pokémon Champions.' },
        { line: 3, message: 'HP has 33 Stat Points; the most for one stat is 32.' },
      ],
      warnings: [
        {
          line: 2,
          message: 'Champions Pokémon are always level 50, so the Level line was ignored.',
        },
      ],
    })
    expect(await t!.db.select().from(team)).toEqual([])
  })

  it('rejects an empty paste', async () => {
    const { cookie } = await asUser()
    const res = await post(t!.app, '/api/teams', { name: 'Empty', paste: '' }, cookie)
    expect(res.status).toBe(422)
    expect((await json(res)).errors).toEqual([{ line: 1, message: 'The paste has no Pokémon.' }])
  })

  it.each([
    [{ paste: PASTE }, 'name'],
    [{ name: '  ', paste: PASTE }, 'name'],
    [{ name: 'Sun', regulation: 'H', paste: PASTE }, 'regulation'],
    [{ name: 'Sun' }, 'paste'],
  ])('rejects invalid fields %j with 400', async (body, field) => {
    const { cookie } = await asUser()
    const res = await post(t!.app, '/api/teams', body, cookie)
    expect(res.status).toBe(400)
    expect((await json(res)).fields).toHaveProperty(field)
    expect(await t!.db.select().from(team)).toEqual([])
  })

  it('rejects a body that is not JSON with 400', async () => {
    const { cookie } = await asUser()
    const res = await t!.app.request('/api/teams', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })

  it('answers 401 without a session and stores nothing', async () => {
    t = await createTestApp()
    const res = await post(t.app, '/api/teams', { name: 'Sneaky', paste: PASTE })
    expect(res.status).toBe(401)
    expect(await t.db.select().from(team)).toEqual([])
  })
})

describe('GET /api/teams/:id', () => {
  let t: TestApp | undefined
  afterEach(async () => {
    await t?.client.close()
    t = undefined
  })

  it("returns the User's Team, and 404 to everyone else", async () => {
    t = await createTestApp()
    const ash = await signUp(t.app, 'ash@example.com')
    const misty = await signUp(t.app, 'misty@example.com')
    const created = await json(
      await post(t.app, '/api/teams', { name: 'Fairy rain', paste: PASTE }, ash.cookie),
    )
    const path = `/api/teams/${created.team.id}`

    const own = await t.app.request(path, { headers: { cookie: ash.cookie } })
    expect(own.status).toBe(200)
    expect(await json(own)).toEqual(created.team)

    const other = await t.app.request(path, { headers: { cookie: misty.cookie } })
    expect(other.status).toBe(404)
    expect(await json(other)).toEqual({ error: 'Not found' })

    expect((await t.app.request(path)).status).toBe(401)
  })

  it.each(['00000000-0000-4000-8000-000000000000', 'not-a-uuid'])(
    'answers 404 for %s',
    async (id) => {
      t = await createTestApp()
      const { cookie } = await signUp(t.app, 'ash@example.com')
      const res = await t.app.request(`/api/teams/${id}`, { headers: { cookie } })
      expect(res.status).toBe(404)
    },
  )
})

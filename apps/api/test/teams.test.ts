import { type NamedPokemonBuild, pokemonBuildSchema, teamPokemonSchema } from '@myvgc/core'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { team, user } from '../src/db/schema'
import { type TestApp, createTestApp, get, json, post, put, signUp } from './app'

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

const NO_POINTS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
const INCINEROAR = {
  species: 'incineroar',
  ability: 'intimidate',
  moves: ['fakeout', 'protect'],
  statPoints: { ...NO_POINTS, hp: 32 },
}

describe('Teams from the Team builder', () => {
  let t: TestApp | undefined
  afterEach(async () => {
    await t?.client.close()
    t = undefined
  })

  async function asUser(email = 'ash@example.com') {
    t = t ?? (await createTestApp())
    const { cookie } = await signUp(t.app, email)
    return cookie
  }

  async function createTeam(cookie: string) {
    const res = await post(t!.app, '/api/teams', { name: 'Sun', pokemon: [INCINEROAR] }, cookie)
    return (await json(res)).team
  }

  const whole = { name: 'Rain', regulation: 'M-A', notes: 'Lead', pokemon: [INCINEROAR] }

  describe('POST /api/teams with Pokémon builds', () => {
    it('creates a Team, with display names and no warnings', async () => {
      const cookie = await asUser()
      const res = await post(t!.app, '/api/teams', { name: 'Sun', pokemon: [INCINEROAR] }, cookie)

      expect(res.status).toBe(201)
      const body = await json(res)
      expect(body.warnings).toEqual([])
      expect(body.team).toMatchObject({ name: 'Sun', regulation: 'M-C', notes: '' })
      expect(body.team.pokemon[0]).toMatchObject({
        ...INCINEROAR,
        names: { species: 'Incineroar', ability: 'Intimidate', moves: ['Fake Out', 'Protect'] },
      })
    })

    it('accepts a build with only a species', async () => {
      const cookie = await asUser()
      const pokemon = [{ species: 'pikachu', moves: [], statPoints: NO_POINTS }]
      const res = await post(t!.app, '/api/teams', { name: 'Seen', pokemon }, cookie)
      expect(res.status).toBe(201)
    })

    it('rejects a body with both a paste and Pokémon builds', async () => {
      const cookie = await asUser()
      const res = await post(
        t!.app,
        '/api/teams',
        { name: 'Sun', paste: 'Incineroar', pokemon: [INCINEROAR] },
        cookie,
      )
      expect(res.status).toBe(400)
    })

    it('rejects a name the Champions data does not recognize, by field', async () => {
      const cookie = await asUser()
      const pokemon = [{ ...INCINEROAR, moves: ['fakeout', 'notamove'] }]
      const res = await post(t!.app, '/api/teams', { name: 'Sun', pokemon }, cookie)

      expect(res.status).toBe(400)
      expect((await json(res)).fields).toEqual({
        'pokemon.0.moves.1': '"notamove" is not a move in Pokémon Champions.',
      })
    })
  })

  describe('PUT /api/teams/:id', () => {
    it('replaces the whole Team and answers with it', async () => {
      const cookie = await asUser()
      const { id, createdAt } = await createTeam(cookie)

      const pokemon = [INCINEROAR, { species: 'garchomp', moves: [], statPoints: NO_POINTS }]
      const res = await put(t!.app, `/api/teams/${id}`, { ...whole, pokemon }, cookie)

      expect(res.status).toBe(200)
      const body = await json(res)
      expect(body).toMatchObject({ id, createdAt, name: 'Rain', regulation: 'M-A', notes: 'Lead' })
      expect(body.pokemon[1].names.species).toBe('Garchomp')
      expect(await json(await get(t!.app, `/api/teams/${id}`, cookie))).toEqual(body)
    })

    it('changes what the paste says', async () => {
      const cookie = await asUser()
      const { id } = await createTeam(cookie)
      await put(
        t!.app,
        `/api/teams/${id}`,
        { ...whole, pokemon: [{ ...INCINEROAR, moves: ['flareblitz'] }] },
        cookie,
      )
      const paste = await (await get(t!.app, `/api/teams/${id}/paste`, cookie)).text()
      expect(paste).toContain('- Flare Blitz')
      expect(paste).not.toContain('- Fake Out')
    })

    it('edits a Team imported from a paste, keeping its nicknames and Stat Points', async () => {
      const cookie = await asUser()
      const created = await json(
        await post(t!.app, '/api/teams', { name: 'Pasted', paste: PASTE }, cookie),
      )
      const res = await put(
        t!.app,
        `/api/teams/${created.team.id}`,
        {
          ...whole,
          pokemon: created.team.pokemon.map((build: NamedPokemonBuild) =>
            pokemonBuildSchema.parse(build),
          ),
        },
        cookie,
      )
      expect(res.status).toBe(200)
      expect((await json(res)).pokemon).toEqual(created.team.pokemon)
    })

    it('leaves a Team snapshot as it was', async () => {
      const cookie = await asUser()
      const { id } = await createTeam(cookie)
      const tournament = await json(
        await post(
          t!.app,
          '/api/tournaments',
          { name: 'Worlds 2999', startDate: '2999-08-20', eventTier: 'worlds', regulation: 'M-C' },
          cookie,
        ),
      )
      const link = await put(
        t!.app,
        `/api/tournaments/${tournament.id}/team`,
        { teamId: id },
        cookie,
      )
      expect(link.status).toBe(200)

      await put(
        t!.app,
        `/api/teams/${id}`,
        { ...whole, pokemon: [{ ...INCINEROAR, moves: [] }] },
        cookie,
      )

      const after = await json(await get(t!.app, `/api/tournaments/${tournament.id}`, cookie))
      expect(after.team.pokemon[0].moves).toEqual(['fakeout', 'protect'])
    })

    it.each([
      ['an unknown name', { species: 'notapokemon' }, 'pokemon.0.species'],
      [
        'a stat over the limit',
        { statPoints: { ...NO_POINTS, atk: 33 } },
        'pokemon.0.statPoints.atk',
      ],
      [
        'a total over the limit',
        { statPoints: { ...NO_POINTS, hp: 32, atk: 32, def: 3 } },
        'pokemon.0.statPoints',
      ],
      ['too many moves', { moves: ['a', 'b', 'c', 'd', 'e'] }, 'pokemon.0.moves'],
      ['a repeated move', { moves: ['protect', 'protect'] }, 'pokemon.0.moves.1'],
    ])('rejects %s and changes nothing', async (_, change, field) => {
      const cookie = await asUser()
      const { id } = await createTeam(cookie)
      const res = await put(
        t!.app,
        `/api/teams/${id}`,
        { ...whole, pokemon: [{ ...INCINEROAR, ...change }] },
        cookie,
      )
      expect(res.status).toBe(400)
      expect(Object.keys((await json(res)).fields)).toEqual([field])
      expect((await json(await get(t!.app, `/api/teams/${id}`, cookie))).name).toBe('Sun')
    })

    it.each([
      ['no Pokémon', []],
      ['seven Pokémon', Array(7).fill(INCINEROAR)],
    ])('rejects %s', async (_, pokemon) => {
      const cookie = await asUser()
      const { id } = await createTeam(cookie)
      const res = await put(t!.app, `/api/teams/${id}`, { ...whole, pokemon }, cookie)
      expect(res.status).toBe(400)
      expect(Object.keys((await json(res)).fields)).toEqual(['pokemon'])
    })

    it("answers 404 for another User's Team and leaves it alone", async () => {
      const cookie = await asUser()
      const { id } = await createTeam(cookie)
      const other = await asUser('misty@example.com')

      expect((await put(t!.app, `/api/teams/${id}`, whole, other)).status).toBe(404)
      expect((await json(await get(t!.app, `/api/teams/${id}`, cookie))).name).toBe('Sun')
    })

    it('answers 404 for an ID that cannot exist', async () => {
      const cookie = await asUser()
      expect((await put(t!.app, '/api/teams/nope', whole, cookie)).status).toBe(404)
    })

    it('needs a session', async () => {
      t = await createTestApp()
      const res = await put(t.app, '/api/teams/00000000-0000-4000-8000-000000000000', whole)
      expect(res.status).toBe(401)
    })
  })
})

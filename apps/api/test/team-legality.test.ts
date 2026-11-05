import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, del, get, json, post, put, signUp } from './app'

const NO_POINTS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
const build = (species: string, rest: object = {}) => ({
  species,
  moves: [],
  statPoints: NO_POINTS,
  ...rest,
})

// Salamence is allowed in M-C but not M-B, and is in Champions either way.
const SALAMENCE_PASTE = `Salamence @ Sitrus Berry
Ability: Intimidate
Adamant Nature
- Protect`
const SALAMENCE_IN_M_B = {
  regulation: 'M-B',
  status: 'illegal',
  problems: [{ path: ['pokemon', 0, 'species'], message: "Salamence isn't allowed in Reg M-B." }],
}

describe('Team legality', () => {
  let t: TestApp
  let ash: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
  }

  const createFromPaste = async (regulation: string, paste = SALAMENCE_PASTE) =>
    post(t.app, '/api/teams', { name: 'Dragons', regulation, paste }, ash)

  it('saves an illegal Team from a paste and warns on what it returns', async () => {
    await setUp()
    const res = await createFromPaste('M-B')
    expect(res.status).toBe(201)
    const { team } = await json(res)
    expect(team.legality).toEqual(SALAMENCE_IN_M_B)

    expect((await json(await get(t.app, `/api/teams/${team.id}`, ash))).legality).toEqual(
      SALAMENCE_IN_M_B,
    )
    const [listed] = await json(await get(t.app, '/api/teams', ash))
    expect(listed.legality).toEqual(SALAMENCE_IN_M_B)
  })

  it('saves an illegal Team from the Team builder, on create and on edit', async () => {
    await setUp()
    const created = await post(
      t.app,
      '/api/teams',
      { name: 'Dragons', regulation: 'M-B', pokemon: [build('salamence')] },
      ash,
    )
    expect(created.status).toBe(201)
    const { team } = await json(created)
    expect(team.legality).toEqual(SALAMENCE_IN_M_B)

    const edited = await put(
      t.app,
      `/api/teams/${team.id}`,
      {
        name: 'Dragons',
        regulation: 'M-B',
        notes: '',
        pokemon: [build('incineroar', { item: 'rockyhelmet' }), build('salamence')],
      },
      ash,
    )
    expect(edited.status).toBe(200)
    expect((await json(edited)).legality.problems).toEqual([
      { path: ['pokemon', 0, 'item'], message: "Rocky Helmet isn't allowed in Reg M-B." },
      { path: ['pokemon', 1, 'species'], message: "Salamence isn't allowed in Reg M-B." },
    ])
  })

  it('warns about a move the species can not learn in a saved Team', async () => {
    await setUp()
    const { team } = await json(await createFromPaste('M-C', 'Incineroar\n- Fake Out\n- Psychic'))
    const problems = [
      { path: ['pokemon', 0, 'moves', 1], message: "Incineroar can't learn Psychic." },
    ]
    expect(team.legality.problems).toEqual(problems)
    expect((await json(await get(t.app, `/api/teams/${team.id}`, ash))).legality.problems).toEqual(
      problems,
    )
  })

  it('works legality out on each read, so changing the Regulation changes the answer', async () => {
    await setUp()
    const { team } = await json(await createFromPaste('M-B'))
    const res = await put(
      t.app,
      `/api/teams/${team.id}`,
      { name: team.name, regulation: 'M-C', notes: '', pokemon: team.pokemon },
      ash,
    )
    expect((await json(res)).legality).toEqual({
      regulation: 'M-C',
      status: 'legal',
      problems: [],
    })
  })

  it('still rejects a name that is in no Champions Regulation', async () => {
    await setUp()
    const fromBuilder = await post(
      t.app,
      '/api/teams',
      { name: 'Dragons', regulation: 'M-C', pokemon: [build('mew')] },
      ash,
    )
    expect(fromBuilder.status).toBe(400)
    const fromPaste = await createFromPaste('M-C', 'Mew\n- Protect')
    expect(fromPaste.status).toBe(422)
    expect((await json(fromPaste)).errors).toEqual([
      { line: 1, message: '"Mew" is not a Pokémon in Pokémon Champions.' },
    ])
  })

  it('leaves an M-A Team unchecked, never legal', async () => {
    await setUp()
    const { team } = await json(await createFromPaste('M-A'))
    expect(team.legality).toEqual({ regulation: 'M-A', status: 'unchecked', problems: [] })
  })

  describe('POST /api/teams/check', () => {
    const check = (body: unknown, cookie = ash) => post(t.app, '/api/teams/check', body, cookie)

    it('judges unsaved Pokémon builds and saves nothing', async () => {
      await setUp()
      const res = await check({
        regulation: 'M-C',
        pokemon: [
          { species: 'incineroar', ability: 'levitate' },
          { species: null },
          { species: 'rotomwash', item: 'leftovers' },
        ],
      })
      expect(res.status).toBe(200)
      expect(await json(res)).toEqual({
        regulation: 'M-C',
        status: 'illegal',
        problems: [{ path: ['pokemon', 0, 'ability'], message: "Incineroar can't have Levitate." }],
      })
      expect(await json(await get(t.app, '/api/teams', ash))).toEqual([])
    })

    it('judges the moves of unsaved Pokémon builds', async () => {
      await setUp()
      const res = await check({
        regulation: 'M-C',
        pokemon: [{ species: 'incineroar', moves: ['fakeout', 'dragonclaw'] }],
      })
      expect((await json(res)).problems).toEqual([
        { path: ['pokemon', 0, 'moves', 1], message: "Incineroar can't learn Dragon Claw." },
      ])
    })

    it('answers for a Regulation with no rules', async () => {
      await setUp()
      expect(await json(await check({ regulation: 'M-A', pokemon: [] }))).toEqual({
        regulation: 'M-A',
        status: 'unchecked',
        problems: [],
      })
    })

    it('needs a session and a well-formed body', async () => {
      await setUp()
      expect(
        (await post(t.app, '/api/teams/check', { regulation: 'M-C', pokemon: [] })).status,
      ).toBe(401)
      expect((await check({ regulation: 'M-Z', pokemon: [] })).status).toBe(400)
    })
  })

  describe('a Tournament’s Team snapshot', () => {
    async function tournamentWith(teamRegulation: string, tournamentRegulation: string) {
      const { team } = await json(await createFromPaste(teamRegulation))
      const { id } = await json(
        await post(
          t.app,
          '/api/tournaments',
          {
            name: 'Worlds 2999',
            startDate: '2999-08-20',
            eventTier: 'worlds',
            regulation: tournamentRegulation,
          },
          ash,
        ),
      )
      const url = `/api/tournaments/${id}`
      expect((await put(t.app, `${url}/team`, { teamId: team.id }, ash)).status).toBe(200)
      return url
    }

    it('is judged against the Tournament’s Regulation, not the Team’s', async () => {
      await setUp()
      const url = await tournamentWith('M-C', 'M-B')
      expect((await json(await get(t.app, url, ash))).team.legality).toEqual(SALAMENCE_IN_M_B)
    })

    it('is legal when the Tournament’s Regulation allows what the Team’s does not', async () => {
      await setUp()
      const url = await tournamentWith('M-B', 'M-C')
      expect((await json(await get(t.app, url, ash))).team.legality.status).toBe('legal')
    })

    it('is unchecked in a Tournament of a Regulation with no rules', async () => {
      await setUp()
      const url = await tournamentWith('M-C', 'M-A')
      expect((await json(await get(t.app, url, ash))).team.legality.status).toBe('unchecked')
      expect((await del(t.app, `${url}/team`, ash)).status).toBe(200)
      expect((await json(await get(t.app, url, ash))).team).toBeNull()
    })
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, del, get, json, patch, post, signUp } from './app'

const REGIONAL = {
  name: 'Toronto Regional',
  startDate: '2026-09-19',
  eventTier: 'regional',
  defaultBestOf: 3,
}

const NO_POINTS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
const mon = (species: string, more: object = {}) => ({
  species,
  moves: [],
  statPoints: NO_POINTS,
  ...more,
})

describe('Opponent’s Teams', () => {
  let t: TestApp
  let ash: string
  let tournamentId: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
    tournamentId = (await json(await post(t.app, '/api/tournaments', REGIONAL, ash))).id
  }
  const rounds = () => `/api/tournaments/${tournamentId}/rounds`
  const logRound = (body: object) => post(t.app, rounds(), body, ash)
  const editRound = (id: string, body: object) => patch(t.app, `${rounds()}/${id}`, body, ash)
  const tournament = async () => json(await get(t.app, `/api/tournaments/${tournamentId}`, ash))

  it('is saved with a Round and shown on the Round and its Tournament', async () => {
    await setUp()
    const res = await logRound({
      result: 'win',
      newOpponentName: 'Wolfe Glick',
      opponentTeam: [{ species: 'incineroar', item: 'sitrusberry' }, { species: 'rillaboom' }],
    })

    expect(res.status).toBe(201)
    const saved = await json(res)
    const team = {
      opponentId: saved.round.opponent.id,
      pokemon: [mon('incineroar', { item: 'sitrusberry' }), mon('rillaboom')],
    }
    expect(saved.opponentTeam).toEqual(team)
    expect((await tournament()).opponentTeams).toEqual([team])
    const list = await json(await get(t.app, '/api/tournaments', ash))
    expect(list[0].opponentTeams).toEqual([team])
  })
  it('is shared by every Round against that Opponent, and only replaced when sent', async () => {
    await setUp()
    const first = await json(
      await logRound({
        result: 'win',
        newOpponentName: 'Wolfe Glick',
        opponentTeam: [{ species: 'incineroar' }],
      }),
    )
    const opponentId = first.round.opponent.id
    const second = await json(
      await logRound({ phase: 'top-cut', stage: 'top-8', result: 'loss', opponentId }),
    )
    expect(second.opponentTeam).toEqual({ opponentId, pokemon: [mon('incineroar')] })

    const edited = await json(
      await editRound(second.round.id, {
        phase: 'top-cut',
        stage: 'top-8',
        result: 'loss',
        opponentId,
        opponentTeam: [{ species: 'incineroar' }, { species: 'kingambit' }],
      }),
    )
    expect(edited.opponentTeam.pokemon.map((p: { species: string }) => p.species)).toEqual([
      'incineroar',
      'kingambit',
    ])
    expect((await tournament()).opponentTeams).toHaveLength(1)
  })

  it('is deleted by sending an empty list', async () => {
    await setUp()
    const saved = await json(
      await logRound({
        result: 'win',
        newOpponentName: 'Wolfe Glick',
        opponentTeam: [{ species: 'incineroar' }],
      }),
    )
    const edited = await json(
      await editRound(saved.round.id, {
        result: 'win',
        opponentId: saved.round.opponent.id,
        opponentTeam: [],
      }),
    )
    expect(edited.opponentTeam).toBeNull()
    expect((await tournament()).opponentTeams).toEqual([])
  })

  it.each<[string, object, string]>([
    ['on a Bye', { bye: true, opponentTeam: [{ species: 'incineroar' }] }, 'opponentTeam'],
    [
      'with a species not in Champions',
      { result: 'win', newOpponentName: 'X', opponentTeam: [{ species: 'agumon' }] },
      'opponentTeam.0.species',
    ],
    [
      'with seven Pokémon',
      {
        result: 'win',
        newOpponentName: 'X',
        opponentTeam: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((species) => ({ species })),
      },
      'opponentTeam',
    ],
  ])('is refused %s', async (_, body, field) => {
    await setUp()
    const res = await logRound(body)
    expect(res.status).toBe(400)
    expect(Object.keys((await json(res)).fields)).toContain(field)
  })

  it('goes once the last Round against that Opponent is deleted', async () => {
    await setUp()
    const first = await json(
      await logRound({
        result: 'win',
        newOpponentName: 'Wolfe Glick',
        opponentTeam: [{ species: 'incineroar' }],
      }),
    )
    const opponentId = first.round.opponent.id
    const second = await json(
      await logRound({ phase: 'top-cut', stage: 'top-8', result: 'loss', opponentId }),
    )

    await del(t.app, `${rounds()}/${first.round.id}`, ash)
    expect((await tournament()).opponentTeams).toHaveLength(1)
    await del(t.app, `${rounds()}/${second.round.id}`, ash)
    expect((await tournament()).opponentTeams).toEqual([])
  })

  it('goes when its only Round changes Opponent, which clears their side of the Games', async () => {
    await setUp()
    const game = {
      number: 1,
      result: 'win',
      brought: ['rillaboom'],
      opponentBrought: ['incineroar', 'kingambit'],
      opponentLeads: ['incineroar'],
    }
    const saved = await json(
      await logRound({
        bestOf: 1,
        newOpponentName: 'Wolfe Glick',
        opponentTeam: [{ species: 'incineroar' }],
        games: [game],
      }),
    )
    const edited = await json(
      await editRound(saved.round.id, {
        bestOf: 1,
        newOpponentName: 'Aaron Zheng',
        games: [game],
      }),
    )

    expect(edited.round.games[0]).toMatchObject({
      brought: ['rillaboom'],
      opponentBrought: [],
      opponentLeads: [],
    })
    expect(edited.opponentTeam).toBeNull()
    expect((await tournament()).opponentTeams).toEqual([])
  })

  it('keeps the new Opponent’s side of the Games when it is sent with the change', async () => {
    await setUp()
    const saved = await json(
      await logRound({
        bestOf: 1,
        newOpponentName: 'Wolfe Glick',
        games: [{ number: 1, result: 'win', opponentBrought: ['incineroar'] }],
      }),
    )
    const edited = await json(
      await editRound(saved.round.id, {
        bestOf: 1,
        newOpponentName: 'Aaron Zheng',
        games: [{ number: 1, result: 'win', opponentBrought: ['kingambit'] }],
      }),
    )
    expect(edited.round.games[0].opponentBrought).toEqual(['kingambit'])
  })
  it('is combined with the duplicate’s when two Opponents who both have one there are merged', async () => {
    await setUp()
    const wolfe = await json(
      await logRound({
        result: 'win',
        newOpponentName: 'Wolfe Glick',
        opponentTeam: [{ species: 'incineroar' }, { species: 'rillaboom', moves: ['fakeout'] }],
      }),
    )
    const wolfey = await json(
      await logRound({
        phase: 'top-cut',
        stage: 'top-8',
        result: 'loss',
        newOpponentName: 'wolfey',
        opponentTeam: [
          { species: 'rillaboom', ability: 'grassysurge', moves: ['woodhammer'] },
          { species: 'kingambit' },
        ],
      }),
    )
    const survivorId = wolfe.round.opponent.id
    const res = await post(
      t.app,
      `/api/opponents/${survivorId}/merge`,
      { duplicateId: wolfey.round.opponent.id },
      ash,
    )
    expect(res.status).toBe(200)

    expect((await tournament()).opponentTeams).toEqual([
      {
        opponentId: survivorId,
        pokemon: [
          mon('incineroar'),
          mon('rillaboom', { ability: 'grassysurge', moves: ['fakeout'] }),
          mon('kingambit'),
        ],
      },
    ])
  })

  it('moves to the survivor of a merge when only the duplicate had one there', async () => {
    await setUp()
    const wolfe = await json(await logRound({ result: 'win', newOpponentName: 'Wolfe Glick' }))
    const wolfey = await json(
      await logRound({
        phase: 'top-cut',
        stage: 'top-8',
        result: 'loss',
        newOpponentName: 'wolfey',
        opponentTeam: [{ species: 'kingambit' }],
      }),
    )
    const survivorId = wolfe.round.opponent.id
    await post(
      t.app,
      `/api/opponents/${survivorId}/merge`,
      { duplicateId: wolfey.round.opponent.id },
      ash,
    )
    expect((await tournament()).opponentTeams).toEqual([
      { opponentId: survivorId, pokemon: [mon('kingambit')] },
    ])
  })
})

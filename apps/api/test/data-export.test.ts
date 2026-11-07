import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, get, json, patch, post, put, send, signUp } from './app'

const incineroar = {
  species: 'incineroar',
  item: 'sitrusberry',
  ability: 'intimidate',
  nature: 'careful',
  moves: ['fakeout', 'partingshot'],
  statPoints: { hp: 32, atk: 2, def: 0, spa: 0, spd: 32, spe: 0 },
}

describe('Data export and import', () => {
  const apps: TestApp[] = []
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((t) => t.client.close()))
  })

  /** A fresh install with one User signed up. */
  async function install(email = 'ash@example.com') {
    const t = await createTestApp()
    apps.push(t)
    return { t, cookie: (await signUp(t.app, email)).cookie }
  }

  /** Fills an account with one of everything, the way the web app would. */
  async function fill({ t, cookie }: Awaited<ReturnType<typeof install>>) {
    const call = async (res: Response | Promise<Response>) => {
      const answer = await res
      expect(answer.status, await answer.clone().text()).toBeLessThan(300)
      return json(answer)
    }
    const team = (
      await call(post(t.app, '/api/teams', { name: 'Rain', pokemon: [incineroar] }, cookie))
    ).team
    const opponent = await call(
      post(t.app, '/api/opponents', { displayName: 'Wolfe', aliases: ['wolfey'] }, cookie),
    )
    await call(
      post(
        t.app,
        `/api/opponents/${opponent.id}/note-entries`,
        { date: '2026-09-19', text: 'Leads Incineroar' },
        cookie,
      ),
    )
    const tournament = await call(
      post(
        t.app,
        '/api/tournaments',
        {
          name: 'Worlds',
          startDate: '2026-08-28',
          endDate: '2026-08-30',
          eventTier: 'worlds',
          defaultBestOf: 3,
          entryFee: { amount: 3500, currency: 'USD' },
          playerCount: 300,
        },
        cookie,
      ),
    )
    await call(put(t.app, `/api/tournaments/${tournament.id}/team`, { teamId: team.id }, cookie))
    const rounds = `/api/tournaments/${tournament.id}/rounds`
    await call(
      post(
        t.app,
        rounds,
        {
          opponentId: opponent.id,
          opponentTeam: [{ species: 'incineroar', item: 'sitrusberry' }, { species: 'rillaboom' }],
          games: [
            { number: 1, brought: ['incineroar'], leads: ['incineroar'], result: 'win' },
            { number: 2, result: 'win' },
          ],
        },
        cookie,
      ),
    )
    await call(post(t.app, rounds, { bye: true }, cookie))
    await call(
      post(
        t.app,
        rounds,
        { phase: 'top-cut', stage: 'top-8', newOpponentName: 'Lance', result: 'loss' },
        cookie,
      ),
    )
    await call(patch(t.app, `/api/tournaments/${tournament.id}`, { placement: 5 }, cookie))
    return { team, opponent, tournament }
  }

  const exportOf = async (t: TestApp, cookie: string) =>
    json(await get(t.app, '/api/export', cookie))
  const importInto = (t: TestApp, cookie: string, file: unknown) =>
    post(t.app, '/api/import', file, cookie)
  const withoutTime = ({ exportedAt: _, ...file }: { exportedAt: string }) => file

  it('downloads all of a User’s data as myvgc-<date>.json, and nothing about the account', async () => {
    const a = await install()
    await fill(a)
    const res = await get(a.t.app, '/api/export', a.cookie)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toMatch(
      /^attachment; filename="myvgc-\d{4}-\d{2}-\d{2}\.json"$/,
    )
    const text = await res.text()
    expect(text).not.toContain('ash@example.com')
    const file = JSON.parse(text)
    expect(file).toMatchObject({ format: 'myvgc-export', version: 2 })
    expect(file.teams).toHaveLength(1)
    expect(file.opponents.map((o: { displayName: string }) => o.displayName).sort()).toEqual([
      'Lance',
      'Wolfe',
    ])
    expect(file.tournaments[0].rounds).toHaveLength(3)
    expect(file.tournaments[0].team).toMatchObject({ name: 'Rain' })
    expect(file.tournaments[0].opponentTeams).toEqual([
      {
        id: expect.any(String),
        opponentId: file.tournaments[0].rounds[0].opponentId,
        pokemon: [
          expect.objectContaining({ species: 'incineroar', item: 'sitrusberry' }),
          expect.objectContaining({ species: 'rillaboom' }),
        ],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    ])
  })

  it('keeps an Opponent’s Team the User already has over the file’s', async () => {
    const a = await install()
    const { opponent, tournament } = await fill(a)
    const exported = await exportOf(a.t, a.cookie)
    const rounds = `/api/tournaments/${tournament.id}/rounds`
    const [first] = (await json(await get(a.t.app, `/api/tournaments/${tournament.id}`, a.cookie)))
      .rounds
    await patch(
      a.t.app,
      `${rounds}/${first.id}`,
      { opponentId: opponent.id, games: first.games, opponentTeam: [{ species: 'kingambit' }] },
      a.cookie,
    )

    expect((await importInto(a.t, a.cookie, exported)).status).toBe(200)
    const [team] = (await json(await get(a.t.app, `/api/tournaments/${tournament.id}`, a.cookie)))
      .opponentTeams
    expect(team.pokemon.map((p: { species: string }) => p.species)).toEqual(['kingambit'])
  })

  it('leaves out an Opponent’s Team for an Opponent the User no longer played there', async () => {
    const a = await install()
    const { opponent, tournament } = await fill(a)
    const exported = await exportOf(a.t, a.cookie)
    const [first] = (await json(await get(a.t.app, `/api/tournaments/${tournament.id}`, a.cookie)))
      .rounds
    // Their only Round there is now against someone else, which deletes their Team.
    await patch(
      a.t.app,
      `/api/tournaments/${tournament.id}/rounds/${first.id}`,
      { newOpponentName: 'Cynthia', games: first.games },
      a.cookie,
    )

    expect((await importInto(a.t, a.cookie, exported)).status).toBe(200)
    const after = await json(await get(a.t.app, `/api/tournaments/${tournament.id}`, a.cookie))
    expect(after.opponentTeams).toEqual([])
    expect(
      after.rounds.some((r: { opponent?: { id: string } }) => r.opponent?.id === opponent.id),
    ).toBe(false)
  })

  it('moves everything to a User on another install, ids and timestamps included', async () => {
    const a = await install()
    await fill(a)
    const exported = await exportOf(a.t, a.cookie)

    const b = await install('brock@example.com')
    const res = await importInto(b.t, b.cookie, exported)
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({
      teams: { added: 1, alreadyThere: 0 },
      opponents: { added: 2, alreadyThere: 0 },
      noteEntries: { added: 1, alreadyThere: 0 },
      tournaments: { added: 1, alreadyThere: 0 },
      rounds: { added: 3, alreadyThere: 0 },
    })
    expect(withoutTime(await exportOf(b.t, b.cookie))).toEqual(withoutTime(exported))

    // What was imported works like anything else the User saved.
    const [tournament] = await json(await get(b.t.app, '/api/tournaments', b.cookie))
    expect(tournament.record).toEqual({
      swiss: { wins: 2, losses: 0, ties: 0 },
      topCut: { wins: 0, losses: 1, ties: 0 },
    })
  })

  it('counts everything as already there when the same file is imported again', async () => {
    const a = await install()
    const { team } = await fill(a)
    const exported = await exportOf(a.t, a.cookie)
    // The record the User has wins over the file's.
    await put(a.t.app, `/api/teams/${team.id}`, { ...exported.teams[0], name: 'Sun' }, a.cookie)

    const res = await importInto(a.t, a.cookie, exported)
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({
      teams: { added: 0, alreadyThere: 1 },
      opponents: { added: 0, alreadyThere: 2 },
      noteEntries: { added: 0, alreadyThere: 1 },
      tournaments: { added: 0, alreadyThere: 1 },
      rounds: { added: 0, alreadyThere: 3 },
    })
    expect((await json(await get(a.t.app, `/api/teams/${team.id}`, a.cookie))).name).toBe('Sun')
  })

  it('adds new Rounds and Note entries to a Tournament and Opponent the User already has', async () => {
    const a = await install()
    const { opponent, tournament } = await fill(a)
    const file = await exportOf(a.t, a.cookie)
    file.opponents
      .find((o: { id: string }) => o.id === opponent.id)
      .noteEntries.push({
        ...file.opponents.find((o: { id: string }) => o.id === opponent.id).noteEntries[0],
        id: crypto.randomUUID(),
        text: 'Switched to Sun',
      })
    file.tournaments[0].rounds.push({
      ...file.tournaments[0].rounds[0],
      id: crypto.randomUUID(),
      roundNumber: 3,
    })

    const res = await importInto(a.t, a.cookie, file)
    expect(await json(res)).toMatchObject({
      noteEntries: { added: 1, alreadyThere: 1 },
      rounds: { added: 1, alreadyThere: 3 },
    })
    const saved = await json(await get(a.t.app, `/api/tournaments/${tournament.id}`, a.cookie))
    expect(saved.rounds.map((r: { roundNumber: number | null }) => r.roundNumber)).toEqual([
      1,
      2,
      3,
      null,
    ])
  })

  it('answers 409 for a Swiss round number already logged in that Tournament, writing nothing', async () => {
    const a = await install()
    await fill(a)
    const file = await exportOf(a.t, a.cookie)
    file.teams[0].id = crypto.randomUUID()
    file.tournaments[0].rounds.push({ ...file.tournaments[0].rounds[0], id: crypto.randomUUID() })
    file.tournaments[0].rounds.splice(0, 1)

    const res = await importInto(a.t, a.cookie, file)
    expect(res.status).toBe(409)
    expect((await json(res)).error).toMatch(/Tournament “Worlds”, Round 1: .*already logged/)
    expect(await json(await get(a.t.app, '/api/teams', a.cookie))).toHaveLength(1)
  })

  it('answers 409 for a Top cut stage already logged in that Tournament', async () => {
    const a = await install()
    await fill(a)
    const file = await exportOf(a.t, a.cookie)
    const top8 = file.tournaments[0].rounds.find((r: { stage: string }) => r.stage === 'top-8')
    file.tournaments[0].rounds = [{ ...top8, id: crypto.randomUUID() }]
    file.tournaments[0].opponentTeams = []

    const res = await importInto(a.t, a.cookie, file)
    expect(res.status).toBe(409)
    expect((await json(res)).error).toBe(
      'Tournament “Worlds”, Top 8: That Top cut stage is already logged.',
    )
  })

  it('judges new Rounds on a Tournament the User has by its saved settings, not the file’s', async () => {
    const a = await install()
    await fill(a)
    const file = await exportOf(a.t, a.cookie)
    // The saved Tournament is best of 3, so a Round with no best-of of its own is too.
    file.tournaments[0].defaultBestOf = 1
    const round = { ...file.tournaments[0].rounds[0], id: crypto.randomUUID(), roundNumber: 3 }
    delete round.bestOf
    file.tournaments[0].rounds = [round]

    const res = await importInto(a.t, a.cookie, file)
    expect(res.status, JSON.stringify(await json(res.clone()))).toBe(200)
    const [saved] = await json(await get(a.t.app, '/api/tournaments', a.cookie))
    expect(saved.defaultBestOf).toBe(3)
    expect(saved.rounds.find((r: { roundNumber: number }) => r.roundNumber === 3)).toMatchObject({
      bestOf: 3,
      gameScore: { won: 2, lost: 0 },
    })
  })

  it('answers 409 for an ID another User on this install holds, writing nothing', async () => {
    const a = await install()
    await fill(a)
    const file = await exportOf(a.t, a.cookie)
    const misty = (await signUp(a.t.app, 'misty@example.com')).cookie

    const res = await importInto(a.t, misty, file)
    expect(res.status).toBe(409)
    expect((await json(res)).error).toMatch(/^Team “Rain”: /)
    expect(await exportOf(a.t, misty)).toMatchObject({ teams: [], opponents: [], tournaments: [] })
  })

  it('refuses a file with one bad record, naming it and writing nothing', async () => {
    const { t, cookie } = await install()
    const a = await install('brock@example.com')
    await fill(a)
    const file = await exportOf(a.t, a.cookie)
    file.tournaments[0].rounds[2].opponentId = crypto.randomUUID()

    const res = await importInto(t, cookie, file)
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.error).toBe(
      'Tournament “Worlds”, Top 8: Its Opponent isn’t in the file or in your account.',
    )
    expect(body.problems).toHaveLength(1)
    expect(await exportOf(t, cookie)).toMatchObject({ teams: [], opponents: [], tournaments: [] })
  })

  it('refuses a species the install doesn’t know', async () => {
    const a = await install()
    await fill(a)
    const file = await exportOf(a.t, a.cookie)
    file.teams[0].id = crypto.randomUUID()
    file.teams[0].pokemon[0].species = 'agumon'
    const res = await importInto(a.t, a.cookie, file)
    expect(res.status).toBe(400)
    expect((await json(res)).problems[0]).toMatchObject({
      record: 'Team “Rain”',
      field: 'teams.0.pokemon.0.species',
    })
  })

  it('refuses a file from a newer version, asking to update the install', async () => {
    const a = await install()
    const file = await exportOf(a.t, a.cookie)
    const res = await importInto(a.t, a.cookie, { ...file, version: 99 })
    expect(res.status).toBe(400)
    expect((await json(res)).error).toMatch(/Update this install/)
  })

  it('keeps a Team snapshot whose Team is gone, without the link', async () => {
    const a = await install()
    await fill(a)
    const file = await exportOf(a.t, a.cookie)
    const b = await install('brock@example.com')
    file.teams = []

    expect((await importInto(b.t, b.cookie, file)).status).toBe(200)
    const [tournament] = (await exportOf(b.t, b.cookie)).tournaments
    expect(tournament.team).toMatchObject({ teamId: null, name: 'Rain' })
  })

  it('leaves out other Users’ data and needs a session', async () => {
    const a = await install()
    await fill(a)
    const misty = (await signUp(a.t.app, 'misty@example.com')).cookie
    expect(await exportOf(a.t, misty)).toMatchObject({ teams: [], opponents: [], tournaments: [] })
    expect((await get(a.t.app, '/api/export')).status).toBe(401)
    expect((await importInto(a.t, '', {})).status).toBe(401)
  })

  it('refuses a body over 10 MB', async () => {
    const a = await install()
    const res = await send(a.t.app, 'POST', '/api/import', {
      body: { padding: 'x'.repeat(10 * 1024 * 1024) },
      cookie: a.cookie,
    })
    expect(res.status).toBe(413)
  })
})

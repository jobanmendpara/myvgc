import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { team } from '../src/db/schema'
import { type TestApp, createTestApp, del, get, json, post, put, signUp } from './app'

const PASTE = `Floette-Eternal @ Floettite
Ability: Flower Veil
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Moonblast
- Protect`

// Far enough ahead that the Tournament is never over while these tests run.
const UPCOMING = {
  name: 'Worlds 2999',
  startDate: '2999-08-20',
  endDate: '2999-08-22',
  eventTier: 'worlds',
}

describe('A Tournament’s Team snapshot', () => {
  let t: TestApp
  let ash: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp(tournament: object = UPCOMING, regulation = 'M-C') {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
    const created = await json(
      await post(t.app, '/api/teams', { name: 'Fairy rain', regulation, paste: PASTE }, ash),
    )
    const { id } = await json(
      await post(t.app, '/api/tournaments', { ...tournament, regulation: 'M-C' }, ash),
    )
    return { teamId: created.team.id as string, tournamentId: id as string }
  }

  it('starts with no Team', async () => {
    const { tournamentId } = await setUp()
    expect(await json(await get(t.app, `/api/tournaments/${tournamentId}`, ash))).toMatchObject({
      team: null,
      warnings: [],
    })
  })

  it('saves a snapshot of the Team when it is linked', async () => {
    const { teamId, tournamentId } = await setUp()
    const res = await put(t.app, `/api/tournaments/${tournamentId}/team`, { teamId }, ash)

    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.team).toMatchObject({
      teamId,
      name: 'Fairy rain',
      regulation: 'M-C',
      snapshotAt: expect.any(String),
    })
    expect(body.team.pokemon[0]).toMatchObject({
      species: 'floetteeternal',
      names: { species: 'Floette-Eternal' },
    })
    expect(body.warnings).toEqual([])
  })

  it('keeps the snapshot as it was when the Team changes, until it is snapshotted again', async () => {
    const { teamId, tournamentId } = await setUp()
    await put(t.app, `/api/tournaments/${tournamentId}/team`, { teamId }, ash)
    // There is no way to edit a Team yet, so change it directly.
    await t.db.update(team).set({ name: 'Fairy rain v2' }).where(eq(team.id, teamId))

    const before = await json(await get(t.app, `/api/tournaments/${tournamentId}`, ash))
    expect(before.team.name).toBe('Fairy rain')

    const again = await json(
      await put(t.app, `/api/tournaments/${tournamentId}/team`, { teamId }, ash),
    )
    expect(again.team.name).toBe('Fairy rain v2')
  })

  it('keeps the snapshot when the Team is deleted', async () => {
    const { teamId, tournamentId } = await setUp()
    await put(t.app, `/api/tournaments/${tournamentId}/team`, { teamId }, ash)
    expect((await del(t.app, `/api/teams/${teamId}`, ash)).status).toBe(204)

    const body = await json(await get(t.app, `/api/tournaments/${tournamentId}`, ash))
    expect(body.team).toMatchObject({ teamId: null, name: 'Fairy rain' })
  })

  it('warns, without refusing, when the Team’s Regulation differs', async () => {
    const { teamId, tournamentId } = await setUp(UPCOMING, 'M-B')
    const res = await put(t.app, `/api/tournaments/${tournamentId}/team`, { teamId }, ash)
    expect(res.status).toBe(200)
    expect((await json(res)).warnings).toEqual([
      'The Team is tagged Reg M-B, but this Tournament is Reg M-C.',
    ])
    expect(
      (await json(await get(t.app, `/api/tournaments/${tournamentId}`, ash))).warnings,
    ).toHaveLength(1)
  })

  it('unlinks the Team', async () => {
    const { teamId, tournamentId } = await setUp()
    await put(t.app, `/api/tournaments/${tournamentId}/team`, { teamId }, ash)
    const res = await del(t.app, `/api/tournaments/${tournamentId}/team`, ash)
    expect(res.status).toBe(200)
    expect((await json(res)).team).toBeNull()
  })

  it('refuses a new snapshot once the Tournament is over', async () => {
    const { teamId, tournamentId } = await setUp({
      name: 'Old locals',
      startDate: '2026-05-01',
      eventTier: 'grassroots',
    })
    const res = await put(t.app, `/api/tournaments/${tournamentId}/team`, { teamId }, ash)
    expect(res.status).toBe(409)
    expect((await json(res)).error).toMatch(/over/)
  })

  it('only links the User’s own Teams to their own Tournaments', async () => {
    const { teamId, tournamentId } = await setUp()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie
    const mistysTeam = await json(
      await post(t.app, '/api/teams', { name: 'Water', paste: PASTE }, misty),
    )

    expect(
      (
        await put(
          t.app,
          `/api/tournaments/${tournamentId}/team`,
          { teamId: mistysTeam.team.id },
          ash,
        )
      ).status,
    ).toBe(404)
    expect(
      (await put(t.app, `/api/tournaments/${tournamentId}/team`, { teamId }, misty)).status,
    ).toBe(404)
    expect(
      (await put(t.app, `/api/tournaments/${tournamentId}/team`, { teamId: 'nope' }, ash)).status,
    ).toBe(400)
  })
})

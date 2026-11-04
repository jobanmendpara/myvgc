import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, createTestApp, del, get, json, patch, post, signUp } from './app'

const REGIONAL = { name: 'Toronto Regional', startDate: '2026-09-19', eventTier: 'regional' }

/**
 * A phone queues writes while offline and sends them again later (ADR 17), so creates take an ID
 * chosen by the client and sending the same write twice changes nothing.
 */
describe('Replayed writes', () => {
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
  const newTournament = async (cookie = ash) =>
    (await json(await post(t.app, '/api/tournaments', REGIONAL, cookie))).id as string
  const rounds = async (tournamentId: string) =>
    (await json(await get(t.app, `/api/tournaments/${tournamentId}`, ash))).rounds

  describe('Tournaments', () => {
    it('stores a Tournament under the ID the client chose', async () => {
      await setUp()
      const id = randomUUID()
      const res = await post(t.app, '/api/tournaments', { ...REGIONAL, id }, ash)

      expect(res.status).toBe(201)
      expect((await json(res)).id).toBe(id)
      expect((await json(await get(t.app, `/api/tournaments/${id}`, ash))).name).toBe(REGIONAL.name)
    })

    it('answers a replayed create with the saved Tournament, keeping the server’s version', async () => {
      await setUp()
      const id = randomUUID()
      await post(t.app, '/api/tournaments', { ...REGIONAL, id }, ash)
      await patch(t.app, `/api/tournaments/${id}`, { name: 'Renamed on the laptop' }, ash)

      const replay = await post(t.app, '/api/tournaments', { ...REGIONAL, id }, ash)
      expect(replay.status).toBe(200)
      expect((await json(replay)).name).toBe('Renamed on the laptop')
      expect(await json(await get(t.app, '/api/tournaments', ash))).toHaveLength(1)
    })

    it('refuses an ID another User already has, without touching their Tournament', async () => {
      await setUp()
      const id = randomUUID()
      await post(t.app, '/api/tournaments', { ...REGIONAL, id }, ash)

      const res = await post(t.app, '/api/tournaments', { ...REGIONAL, id, name: 'Mine' }, misty)
      expect(res.status).toBe(409)
      expect(await json(await get(t.app, '/api/tournaments', misty))).toEqual([])
      expect((await json(await get(t.app, `/api/tournaments/${id}`, ash))).name).toBe(REGIONAL.name)
    })

    it('refuses an ID that is not a UUID', async () => {
      await setUp()
      const res = await post(t.app, '/api/tournaments', { ...REGIONAL, id: 'abc' }, ash)
      expect(res.status).toBe(400)
      expect((await json(res)).fields).toHaveProperty('id')
    })

    it('answers a replayed delete as done', async () => {
      await setUp()
      const id = await newTournament()
      expect((await del(t.app, `/api/tournaments/${id}`, ash)).status).toBe(204)
      expect((await del(t.app, `/api/tournaments/${id}`, ash)).status).toBe(204)
    })

    it('deletes nothing when another User replays a delete of someone else’s Tournament', async () => {
      await setUp()
      const id = await newTournament()
      expect((await del(t.app, `/api/tournaments/${id}`, misty)).status).toBe(204)
      expect((await get(t.app, `/api/tournaments/${id}`, ash)).status).toBe(200)
    })
  })

  describe('Opponents', () => {
    it('stores an Opponent under the ID the client chose, and a replay adds nothing', async () => {
      await setUp()
      const id = randomUUID()
      const body = { id, displayName: 'Wolfe Glick', aliases: ['Wolfey'] }
      const first = await post(t.app, '/api/opponents', body, ash)
      expect(first.status).toBe(201)
      expect((await json(first)).id).toBe(id)

      const replay = await post(t.app, '/api/opponents', body, ash)
      expect(replay.status).toBe(200)
      expect(await json(replay)).toMatchObject({ id, aliases: ['Wolfey'] })
      expect(await json(await get(t.app, '/api/opponents', ash))).toHaveLength(1)
    })

    it('refuses an ID another User already has', async () => {
      await setUp()
      const id = randomUUID()
      await post(t.app, '/api/opponents', { id, displayName: 'Wolfe Glick' }, ash)

      const res = await post(t.app, '/api/opponents', { id, displayName: 'Someone' }, misty)
      expect(res.status).toBe(409)
      expect(await json(await get(t.app, '/api/opponents', misty))).toEqual([])
    })

    it('answers a replayed delete as done', async () => {
      await setUp()
      const { id } = await json(await post(t.app, '/api/opponents', { displayName: 'A' }, ash))
      expect((await del(t.app, `/api/opponents/${id}`, ash)).status).toBe(204)
      expect((await del(t.app, `/api/opponents/${id}`, ash)).status).toBe(204)
    })
  })

  describe('Rounds', () => {
    const logRound = (tournamentId: string, body: object, cookie = ash) =>
      post(t.app, `/api/tournaments/${tournamentId}/rounds`, body, cookie)

    it('stores a Round and its new Opponent under the IDs the client chose', async () => {
      await setUp()
      const tournamentId = await newTournament()
      const id = randomUUID()
      const newOpponentId = randomUUID()
      const res = await logRound(tournamentId, {
        id,
        result: 'win',
        newOpponentId,
        newOpponentName: 'Wolfe Glick',
      })

      expect(res.status).toBe(201)
      expect((await json(res)).round).toMatchObject({
        id,
        opponent: { id: newOpponentId, displayName: 'Wolfe Glick' },
      })
    })

    it('answers a replayed Round with the saved one, adding no second Round or Opponent', async () => {
      await setUp()
      const tournamentId = await newTournament()
      const body = { id: randomUUID(), roundNumber: 1, result: 'win', newOpponentName: 'Wolfe' }
      const first = await json(await logRound(tournamentId, body))

      const replay = await logRound(tournamentId, body)
      expect(replay.status).toBe(200)
      const replayed = await json(replay)
      expect(replayed.round).toEqual(first.round)
      expect(replayed.record.swiss).toEqual({ wins: 1, losses: 0, ties: 0 })
      expect(await rounds(tournamentId)).toHaveLength(1)
      expect(await json(await get(t.app, '/api/opponents', ash))).toHaveLength(1)
    })

    it('gives a replayed Round the next free number when the User didn’t type one', async () => {
      await setUp()
      const tournamentId = await newTournament()
      // The laptop logs Round 1 while the phone, offline, also logs what it thinks is Round 1.
      await logRound(tournamentId, { result: 'win', newOpponentName: 'Logged on the laptop' })

      const res = await logRound(tournamentId, {
        id: randomUUID(),
        result: 'loss',
        newOpponentName: 'Queued on the phone',
      })
      expect(res.status).toBe(201)
      expect((await json(res)).round.roundNumber).toBe(2)
    })

    it('refuses a replayed Round whose typed number is now taken, adding no Opponent', async () => {
      await setUp()
      const tournamentId = await newTournament()
      await logRound(tournamentId, { roundNumber: 3, result: 'win', newOpponentName: 'A' })

      const res = await logRound(tournamentId, {
        id: randomUUID(),
        roundNumber: 3,
        result: 'loss',
        newOpponentName: 'B',
      })
      expect(res.status).toBe(400)
      expect((await json(res)).fields.roundNumber).toBe('Round 3 is already logged.')
      expect(await json(await get(t.app, '/api/opponents', ash))).toHaveLength(1)
    })

    it('refuses a Round ID another User already has', async () => {
      await setUp()
      const id = randomUUID()
      await logRound(await newTournament(), { id, bye: true })

      const res = await logRound(await newTournament(misty), { id, bye: true }, misty)
      expect(res.status).toBe(409)
    })

    it('refuses a Round ID already used in another of the User’s Tournaments', async () => {
      await setUp()
      const id = randomUUID()
      await logRound(await newTournament(), { id, bye: true })

      const other = await newTournament()
      expect((await logRound(other, { id, bye: true })).status).toBe(409)
      expect(await rounds(other)).toEqual([])
    })

    it('keeps the Opponent added by a replayed edit instead of adding it twice', async () => {
      await setUp()
      const tournamentId = await newTournament()
      const { round } = await json(await logRound(tournamentId, { result: 'win', bye: true }))
      const edit = {
        roundNumber: 1,
        result: 'win',
        newOpponentId: randomUUID(),
        newOpponentName: 'Added while editing',
      }
      const path = `/api/tournaments/${tournamentId}/rounds/${round.id}`
      const first = await json(await patch(t.app, path, edit, ash))

      const replay = await patch(t.app, path, edit, ash)
      expect(replay.status).toBe(200)
      expect((await json(replay)).round.opponent).toEqual(first.round.opponent)
      expect(await json(await get(t.app, '/api/opponents', ash))).toHaveLength(1)
    })

    it('refuses a new Opponent ID another User already has', async () => {
      await setUp()
      const newOpponentId = randomUUID()
      await post(t.app, '/api/opponents', { id: newOpponentId, displayName: 'Ash’s' }, ash)

      const tournamentId = await newTournament(misty)
      const res = await logRound(
        tournamentId,
        { result: 'win', newOpponentId, newOpponentName: 'Misty’s' },
        misty,
      )
      expect(res.status).toBe(409)
      expect(await json(await get(t.app, '/api/opponents', misty))).toEqual([])
    })

    it('answers a replayed delete as done, even once its Tournament is gone', async () => {
      await setUp()
      const tournamentId = await newTournament()
      const { round } = await json(await logRound(tournamentId, { bye: true }))
      const path = `/api/tournaments/${tournamentId}/rounds/${round.id}`

      expect((await del(t.app, path, ash)).status).toBe(200)
      const again = await del(t.app, path, ash)
      expect(again.status).toBe(200)
      expect((await json(again)).record.swiss).toEqual({ wins: 0, losses: 0, ties: 0 })

      await del(t.app, `/api/tournaments/${tournamentId}`, ash)
      expect((await del(t.app, path, ash)).status).toBe(204)
    })
  })
})

import { readFile } from 'node:fs/promises'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { team, tournament } from '../src/db/schema'
import { APP_URL, type TestApp, createTestApp, json, post, signUp } from './app'

// The core reader's fixture: a teamsheet.gg download with made-up Player details.
const TEAMSHEET = new URL(
  '../../../packages/core/test/fixtures/teamsheet-gg-filled.pdf',
  import.meta.url,
)

const TOURNAMENT = { name: 'Lille Regional', startDate: '2026-03-14', eventTier: 'regional' }

describe('POST /api/tournaments/:id/teamsheet/read', () => {
  let t: TestApp
  let ash: string
  let tournamentId: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    ash = (await signUp(t.app, 'ash@example.com')).cookie
    tournamentId = (await json(await post(t.app, '/api/tournaments', TOURNAMENT, ash))).id
  }

  /** Stores a Teamsheet attachment the way the web app does. */
  async function attach(bytes: Uint8Array | Buffer) {
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: 'application/pdf' }), 'teamsheet.pdf')
    const res = await t.app.request(`/api/tournaments/${tournamentId}/teamsheet`, {
      method: 'PUT',
      headers: { origin: APP_URL, cookie: ash },
      body: form,
    })
    expect(res.status).toBe(200)
  }

  const read = (id = tournamentId, cookie = ash) =>
    post(t.app, `/api/tournaments/${id}/teamsheet/read`, undefined, cookie)

  it('reads the stored Teamsheet into a draft Team, and saves nothing', async () => {
    await setUp()
    await attach(await readFile(TEAMSHEET))
    const res = await read()

    expect(res.status).toBe(200)
    const body = await json(res)
    expect(Object.keys(body).sort()).toEqual(['flags', 'name', 'pokemon'])
    expect(body.name).toBe('9TCG84KWXK')
    expect(body.flags).toEqual([])
    expect(body.pokemon).toHaveLength(6)
    expect(body.pokemon[0]).toMatchObject({
      species: 'charizard',
      names: { species: 'Charizard', item: 'Charizardite Y' },
    })
    expect(await t.db.select().from(team)).toEqual([])
  })

  it('keeps the attachment after reading it', async () => {
    await setUp()
    await attach(await readFile(TEAMSHEET))
    await read()

    const [row] = await t.db.select().from(tournament).where(eq(tournament.id, tournamentId))
    expect(await t.storage.get(row!.teamsheetKey!)).toBeDefined()
  })

  it("answers 422 with the reader's message for a stored PDF it doesn't recognise", async () => {
    await setUp()
    await attach(new TextEncoder().encode('%PDF-1.7 a scan, not a form'))
    const res = await read()

    expect(res.status).toBe(422)
    expect(await json(res)).toEqual({ error: "This file isn't a PDF MyVGC can open." })
  })

  it('answers 404 when the Tournament has no Teamsheet attachment', async () => {
    await setUp()
    expect((await read()).status).toBe(404)
  })

  it('answers 404 when the stored file has gone missing', async () => {
    await setUp()
    await attach(await readFile(TEAMSHEET))
    const [row] = await t.db.select().from(tournament).where(eq(tournament.id, tournamentId))
    await t.storage.delete(row!.teamsheetKey!)

    expect((await read()).status).toBe(404)
  })

  it("can't read another User's Teamsheet", async () => {
    await setUp()
    await attach(await readFile(TEAMSHEET))
    const misty = (await signUp(t.app, 'misty@example.com')).cookie

    expect((await read(tournamentId, misty)).status).toBe(404)
  })

  it('answers 404 for a Tournament that does not exist', async () => {
    await setUp()
    expect((await read('not-an-id')).status).toBe(404)
    expect((await read('00000000-0000-4000-8000-000000000000')).status).toBe(404)
  })

  it('needs a session', async () => {
    await setUp()
    expect((await read(tournamentId, '')).status).toBe(401)
  })
})

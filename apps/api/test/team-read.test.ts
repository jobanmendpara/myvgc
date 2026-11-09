import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { team } from '../src/db/schema'
import { APP_URL, type TestApp, createTestApp, json, signUp } from './app'

// The core reader's fixture: a teamsheet.gg download with made-up Player details.
const TEAMSHEET = new URL(
  '../../../packages/core/test/fixtures/teamsheet-gg-filled.pdf',
  import.meta.url,
)

describe('POST /api/teams/read', () => {
  let t: TestApp
  let cookie: string
  afterEach(async () => {
    await t?.client.close()
  })

  async function setUp() {
    t = await createTestApp()
    cookie = (await signUp(t.app, 'ash@example.com')).cookie
  }

  /** Sends a file the way the web app does: one `file` field of a multipart form. */
  function upload(file?: Blob, name = 'teamsheet.pdf') {
    const form = new FormData()
    if (file) form.append('file', file, name)
    return t.app.request('/api/teams/read', {
      method: 'POST',
      headers: { origin: APP_URL, cookie },
      body: form,
    })
  }

  const pdf = async () => new Blob([await readFile(TEAMSHEET)], { type: 'application/pdf' })

  it('reads a teamsheet.gg PDF into a draft Team with display names, and saves nothing', async () => {
    await setUp()
    const res = await upload(await pdf())

    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.name).toBe('9TCG84KWXK')
    expect(body.flags).toEqual([])
    expect(body.pokemon).toHaveLength(6)
    expect(body.pokemon[0]).toMatchObject({
      species: 'charizard',
      item: 'charizarditey',
      statPoints: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
      names: {
        species: 'Charizard',
        item: 'Charizardite Y',
        ability: 'Solar Power',
        nature: 'Timid',
        moves: ['Heat Wave', 'Weather Ball', 'Solar Beam', 'Protect'],
      },
    })
    // Nothing on the sheet's header but the Battle Team name comes back.
    expect(Object.keys(body).sort()).toEqual(['flags', 'name', 'pokemon'])
    expect(await t.db.select().from(team)).toEqual([])
  })

  it("answers 422 with the reader's message for a PDF it doesn't recognise", async () => {
    await setUp()
    const res = await upload(new Blob(['not a pdf'], { type: 'application/pdf' }))

    expect(res.status).toBe(422)
    expect(await json(res)).toEqual({ error: "This file isn't a PDF MyVGC can open." })
  })

  it('answers 400 when no file is sent', async () => {
    await setUp()
    const res = await upload()

    expect(res.status).toBe(400)
    expect(await json(res)).toEqual({ error: 'Choose a Teamsheet PDF to read.' })
  })

  it('answers 413 for a file over 5 MB', async () => {
    await setUp()
    const res = await upload(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]))

    expect(res.status).toBe(413)
    expect(await json(res)).toEqual({ error: 'The file is larger than 5 MB.' })
  })

  it('needs a session', async () => {
    t = await createTestApp()
    cookie = ''
    expect((await upload(await pdf())).status).toBe(401)
  })
})

import { readFile } from 'node:fs/promises'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { tournament } from '../src/db/schema'
import { APP_URL, type TestApp, createTestApp, del, get, json, post, signUp } from './app'

// The core reader's fixture: a teamsheet.gg download with made-up Player details.
const TEAMSHEET = new URL(
  '../../../packages/core/test/fixtures/teamsheet-gg-filled.pdf',
  import.meta.url,
)

const TOURNAMENT = { name: 'Lille Regional', startDate: '2026-03-14', eventTier: 'regional' }

describe('A Tournament’s Teamsheet attachment', () => {
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

  /** Where the attachment's file is stored; only storage can say whether it's gone. */
  async function storedKey(id = tournamentId) {
    const [row] = await t.db.select().from(tournament).where(eq(tournament.id, id))
    return row?.teamsheetKey ?? null
  }

  const pdf = async () => new Blob([await readFile(TEAMSHEET)], { type: 'application/pdf' })
  const path = (id = tournamentId) => `/api/tournaments/${id}/teamsheet`

  /** Sends a file the way the web app does: one `file` field of a multipart form. */
  function upload(file?: Blob, name = 'teamsheet.pdf', options = { id: tournamentId, cookie: '' }) {
    const form = new FormData()
    if (file) form.append('file', file, name)
    return t.app.request(path(options.id), {
      method: 'PUT',
      headers: { origin: APP_URL, cookie: options.cookie || ash },
      body: form,
    })
  }

  it('starts with none', async () => {
    await setUp()
    expect((await json(await get(t.app, `/api/tournaments/${tournamentId}`, ash))).teamsheet).toBe(
      null,
    )
    expect((await get(t.app, path(), ash)).status).toBe(404)
  })

  it('keeps an uploaded PDF exactly as it was sent, and shows it on the Tournament', async () => {
    await setUp()
    const sent = await readFile(TEAMSHEET)
    const res = await upload(await pdf(), 'Lille sheet.pdf')

    expect(res.status).toBe(200)
    const attachment = await json(res)
    expect(attachment).toEqual({
      fileName: 'Lille sheet.pdf',
      size: sent.length,
      uploadedAt: expect.any(String),
    })
    const tournament = await json(await get(t.app, `/api/tournaments/${tournamentId}`, ash))
    expect(tournament.teamsheet).toEqual(attachment)

    const file = await get(t.app, path(), ash)
    expect(file.status).toBe(200)
    expect(file.headers.get('content-type')).toBe('application/pdf')
    expect(file.headers.get('content-disposition')).toBe(
      `inline; filename="Lille sheet.pdf"; filename*=UTF-8''Lille%20sheet.pdf`,
    )
    expect(file.headers.get('cache-control')).toBe('private, no-store')
    expect(file.headers.get('x-content-type-options')).toBe('nosniff')
    expect(file.headers.get('content-security-policy')).toBe('sandbox')
    expect(Buffer.from(await file.arrayBuffer()).equals(sent)).toBe(true)
  })

  it('replaces the file on a second upload, and deletes the old one', async () => {
    await setUp()
    await upload(await pdf(), 'first.pdf')
    const first = await storedKey()
    const res = await upload(new Blob(['%PDF-1.7 second']), 'second.pdf')

    expect(res.status).toBe(200)
    expect((await json(res)).fileName).toBe('second.pdf')
    expect(await t.storage.get(first!)).toBeUndefined()
    expect(await (await get(t.app, path(), ash)).text()).toBe('%PDF-1.7 second')
  })

  it('deletes the attachment and its file, and treats deleting it again as done', async () => {
    await setUp()
    await upload(await pdf())
    const key = await storedKey()

    expect((await del(t.app, path(), ash)).status).toBe(204)
    expect(await t.storage.get(key!)).toBeUndefined()
    expect((await json(await get(t.app, `/api/tournaments/${tournamentId}`, ash))).teamsheet).toBe(
      null,
    )
    expect((await get(t.app, path(), ash)).status).toBe(404)
    expect((await del(t.app, path(), ash)).status).toBe(204)
  })

  it('deletes the file with its Tournament', async () => {
    await setUp()
    await upload(await pdf())
    const key = await storedKey()

    expect((await del(t.app, `/api/tournaments/${tournamentId}`, ash)).status).toBe(204)
    expect(await t.storage.get(key!)).toBeUndefined()
  })

  it("can't reach another User's Tournament", async () => {
    await setUp()
    await upload(await pdf())
    const key = await storedKey()
    const misty = (await signUp(t.app, 'misty@example.com')).cookie

    expect((await upload(await pdf(), 'x.pdf', { id: tournamentId, cookie: misty })).status).toBe(
      404,
    )
    expect((await get(t.app, path(), misty)).status).toBe(404)
    expect((await del(t.app, path(), misty)).status).toBe(204)
    expect(await storedKey()).toBe(key)
    expect(await t.storage.get(key!)).toBeDefined()
  })

  it('answers 404 for a Tournament that does not exist', async () => {
    await setUp()
    const missing = '00000000-0000-4000-8000-000000000000'
    expect((await upload(await pdf(), 'x.pdf', { id: missing, cookie: ash })).status).toBe(404)
    expect((await upload(await pdf(), 'x.pdf', { id: 'nope', cookie: ash })).status).toBe(404)
  })

  it('refuses a file that is not a PDF, or no file at all', async () => {
    await setUp()
    const notPdf = await upload(new Blob(['hello']), 'notes.pdf')
    expect(notPdf.status).toBe(400)
    expect(await json(notPdf)).toEqual({ error: "This file isn't a PDF." })

    const none = await upload()
    expect(none.status).toBe(400)
    expect(await json(none)).toEqual({ error: 'Choose a Teamsheet PDF to upload.' })
    expect(await storedKey()).toBe(null)
  })

  it('answers 413 for a file over 5 MB', async () => {
    await setUp()
    const res = await upload(new Blob(['%PDF-', new Uint8Array(5 * 1024 * 1024)]))

    expect(res.status).toBe(413)
    expect(await json(res)).toEqual({ error: 'The file is larger than 5 MB.' })
  })

  it('keeps only the file name, without folders or control characters', async () => {
    await setUp()
    const res = await upload(await pdf(), 'C:\\Users\\ash\\Équipe "finale"\u0007.pdf')

    expect((await json(res)).fileName).toBe('Équipe "finale".pdf')
    expect((await get(t.app, path(), ash)).headers.get('content-disposition')).toBe(
      `inline; filename="_quipe _finale_.pdf"; filename*=UTF-8''%C3%89quipe%20%22finale%22.pdf`,
    )
  })

  it('cuts a long name to 200 characters without splitting one, and drops direction overrides', async () => {
    await setUp()
    const res = await upload(await pdf(), `${'a'.repeat(199)}🦊 tail.pdf`)
    expect((await json(res)).fileName).toBe(`${'a'.repeat(199)}🦊`)
    expect((await get(t.app, path(), ash)).status).toBe(200)

    const flipped = await upload(await pdf(), 'sheet‮fdp.exe')
    expect((await json(flipped)).fileName).toBe('sheetfdp.exe')
  })

  it('needs a session', async () => {
    await setUp()
    const res = await t.app.request(path(), { headers: { origin: APP_URL } })
    expect(res.status).toBe(401)
  })
})

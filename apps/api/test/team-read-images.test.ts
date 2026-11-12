import type { SeenTeam } from '@myvgc/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { imageReads, team } from '../src/db/schema'
import type { ImageReading } from '../src/routes/team-reading'
import { ImageReadFailed, type ImageTeamReader, type TeamImage } from '../src/team-reader'
import { APP_URL, type TestApp, createTestApp, get, json, signUp } from './app'

const noStats = { hp: null, atk: null, def: null, spa: null, spd: null, spe: null }

/** What the stubbed model provider "sees": no request ever leaves the test. */
const SEEN: SeenTeam = {
  name: '9TCG84KWXK',
  pokemon: [
    {
      species: 'Charizard',
      ability: 'Solar Power',
      item: 'Charizardite Y',
      statAlignment: 'Timid',
      moves: ['Heat Wave', 'Weather Ball', 'Solar Beam', 'Protect'],
      statValues: noStats,
      statPoints: { ...noStats, hp: 2, spa: 32, spe: 32 },
      unsure: [],
    },
    {
      species: 'Incineroar',
      ability: 'Intimidate',
      item: 'Sitrus Brry',
      statAlignment: null,
      moves: ['Fake Out'],
      statValues: noStats,
      statPoints: noStats,
      unsure: ['moves'],
    },
  ],
}

// The first bytes of each image type, which is all the API looks at before the reader.
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG = [0xff, 0xd8, 0xff, 0xe0]
const image = (start: number[], type = 'image/png', size = 64) => {
  const bytes = new Uint8Array(size)
  bytes.set(start)
  return new Blob([bytes], { type })
}

describe('image reading', () => {
  let t: TestApp
  let cookie: string
  let reader: ImageTeamReader & { read: ReturnType<typeof vi.fn> }
  afterEach(async () => {
    vi.restoreAllMocks()
    await t?.client.close()
  })

  async function setUp(
    options: { reader?: 'none' | (() => Promise<SeenTeam>); dailyLimit?: number } = {},
  ) {
    reader = {
      read: vi.fn(options.reader === 'none' ? undefined : (options.reader ?? (async () => SEEN))),
    }
    const imageReading: ImageReading | undefined =
      options.reader === 'none' ? undefined : { reader, dailyLimit: options.dailyLimit }
    t = await createTestApp({ imageReading })
    cookie = (await signUp(t.app, 'ash@example.com')).cookie
  }

  /** Sends images the way the web app does: one `image` field per image. */
  function upload(...images: Blob[]) {
    const form = new FormData()
    images.forEach((file, index) => form.append('image', file, `screenshot-${index}.png`))
    return t.app.request('/api/teams/read/images', {
      method: 'POST',
      headers: { origin: APP_URL, cookie },
      body: form,
    })
  }

  describe('GET /api/teams/read', () => {
    it('says images can be read when a reader is set up', async () => {
      await setUp()
      expect(await json(await get(t.app, '/api/teams/read', cookie))).toEqual({ images: true })
    })

    it("says images can't be read with no key, so the upload is hidden", async () => {
      await setUp({ reader: 'none' })
      expect(await json(await get(t.app, '/api/teams/read', cookie))).toEqual({ images: false })
    })
  })

  describe('POST /api/teams/read/images', () => {
    it('reads images into a draft Team with display names and flags, and saves nothing', async () => {
      await setUp()
      const res = await upload(image(PNG), image(JPEG, 'image/jpeg'))

      expect(res.status).toBe(200)
      const body = await json(res)
      expect(body.name).toBe('9TCG84KWXK')
      expect(body.pokemon).toHaveLength(2)
      expect(body.pokemon[0]).toMatchObject({
        species: 'charizard',
        statPoints: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
        names: { species: 'Charizard', item: 'Charizardite Y', nature: 'Timid' },
      })
      expect(body.flags).toEqual([
        { path: ['pokemon', 1, 'item'], message: 'Couldn\'t read "Sitrus Brry".' },
        {
          path: ['pokemon', 1, 'moves'],
          message: 'The moves were hard to make out, so check them.',
        },
      ])
      expect(await t.db.select().from(team)).toEqual([])

      // The reader gets every image, typed by its bytes.
      const sent: TeamImage[] = reader.read.mock.calls[0]![0]
      expect(sent.map((one) => one.type)).toEqual(['image/png', 'image/jpeg'])
    })

    it('types an image by its bytes, not what the browser said, and refuses other files', async () => {
      await setUp()
      const res = await upload(image(PNG), new Blob(['%PDF-1.7'], { type: 'image/png' }))

      expect(res.status).toBe(422)
      expect(await json(res)).toEqual({ error: 'Choose PNG, JPEG or WebP images.' })
      expect(reader.read).not.toHaveBeenCalled()
    })

    it('answers 400 for no images or more than six', async () => {
      await setUp()
      const none = await upload()
      expect(none.status).toBe(400)
      expect(await json(none)).toEqual({ error: 'Choose screenshots or photos of a Team to read.' })

      const seven = await upload(...Array.from({ length: 7 }, () => image(PNG)))
      expect(seven.status).toBe(400)
      expect(await json(seven)).toEqual({ error: 'Choose at most 6 images.' })
      expect(reader.read).not.toHaveBeenCalled()
    })

    it('answers 413 for an image over 10 MB', async () => {
      await setUp()
      const res = await upload(image(PNG, 'image/png', 10 * 1024 * 1024 + 1))

      expect(res.status).toBe(413)
      expect(await json(res)).toEqual({ error: 'Each image can be at most 10 MB.' })
    })

    it("answers 422 when the reader finds no Team's Pokémon", async () => {
      await setUp({ reader: async () => ({ name: '', pokemon: [] }) })
      const res = await upload(image(PNG))

      expect(res.status).toBe(422)
      expect(await json(res)).toEqual({
        error: "MyVGC couldn't find a Team's Pokémon on these images.",
      })
    })

    it('answers 502 when the model provider fails, logging no image data', async () => {
      await setUp({
        reader: async () => {
          throw new ImageReadFailed('InternalServerError 500')
        },
      })
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await upload(image(PNG))

      expect(res.status).toBe(502)
      expect(await json(res)).toEqual({
        error: "Couldn't read the images right now. Try again in a little while.",
      })
      expect(logged).toHaveBeenCalledWith('Image reading failed: InternalServerError 500')
    })

    it('answers 404 when no key is set', async () => {
      await setUp({ reader: 'none' })
      const res = await upload(image(PNG))

      expect(res.status).toBe(404)
      expect(await json(res)).toEqual({
        error: "Reading Teams from images isn't turned on for this install.",
      })
    })

    it('needs a session', async () => {
      await setUp()
      cookie = ''
      expect((await upload(image(PNG))).status).toBe(401)
    })
  })

  describe('the daily limit', () => {
    it("stops a User's reads for the day at the limit, without stopping other Users", async () => {
      await setUp({ dailyLimit: 2 })
      expect((await upload(image(PNG))).status).toBe(200)
      expect((await upload(image(PNG))).status).toBe(200)

      const third = await upload(image(PNG))
      expect(third.status).toBe(429)
      expect(await json(third)).toEqual({
        error: "You've read 2 Teams from images today, the most for one day. Try again tomorrow.",
      })
      expect(reader.read).toHaveBeenCalledTimes(2)

      cookie = (await signUp(t.app, 'misty@example.com')).cookie
      expect((await upload(image(PNG))).status).toBe(200)
    })

    it("doesn't count a read the model provider failed", async () => {
      let fail = true
      await setUp({
        dailyLimit: 1,
        reader: async () => {
          if (fail) throw new ImageReadFailed('APIConnectionError')
          return SEEN
        },
      })
      vi.spyOn(console, 'error').mockImplementation(() => {})

      expect((await upload(image(PNG))).status).toBe(502)
      fail = false
      expect((await upload(image(PNG))).status).toBe(200)
      expect((await upload(image(PNG))).status).toBe(429)
    })

    it("doesn't count reads, or keep anything, when there is no limit", async () => {
      await setUp()
      for (let read = 0; read < 3; read++) expect((await upload(image(PNG))).status).toBe(200)
      expect(await t.db.select().from(imageReads)).toEqual([])
    })
  })
})

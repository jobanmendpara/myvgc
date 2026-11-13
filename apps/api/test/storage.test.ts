import { chmod, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'
import {
  type FileStorage,
  type S3Options,
  memoryStorage,
  openDiskStorage,
  openS3Storage,
  openStorage,
} from '../src/storage'
import { FAKE_S3_ACCESS_KEY_ID, FAKE_S3_BUCKET, startFakeS3 } from './fake-s3'

const bytes = (text: string) => new TextEncoder().encode(text)

async function text(stream: ReadableStream<Uint8Array> | undefined) {
  return stream ? new Response(stream).text() : undefined
}

let s3: Awaited<ReturnType<typeof startFakeS3>>
beforeAll(async () => {
  s3 = await startFakeS3()
})
afterAll(() => s3.close())

const s3Options = (): S3Options => ({
  bucket: FAKE_S3_BUCKET,
  region: 'us-east-1',
  endpoint: s3.endpoint,
  accessKeyId: FAKE_S3_ACCESS_KEY_ID,
  secretAccessKey: 'test-secret',
  forcePathStyle: true,
})

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'myvgc-storage-'))
})
afterEach(async () => {
  await chmod(root, 0o700).catch(() => {})
  await rm(root, { recursive: true, force: true })
})

// Both drivers keep the same promises, so the routes can't tell them apart.
describe.each([
  ['disk', () => openDiskStorage(join(root, 'uploads'))],
  ['memory', async () => memoryStorage()],
  ['S3', () => openS3Storage(s3Options())],
])('%s storage', (_, open: () => Promise<FileStorage>) => {
  it('gives back what was put under a key', async () => {
    const storage = await open()
    await storage.put('teamsheets/u1/a.pdf', bytes('%PDF-1.7 one'))

    expect(await text(await storage.get('teamsheets/u1/a.pdf'))).toBe('%PDF-1.7 one')
  })

  it('replaces a file put again under the same key', async () => {
    const storage = await open()
    await storage.put('teamsheets/u1/a.pdf', bytes('first'))
    await storage.put('teamsheets/u1/a.pdf', bytes('second'))

    expect(await text(await storage.get('teamsheets/u1/a.pdf'))).toBe('second')
  })

  it('has nothing for a key never put, or deleted', async () => {
    const storage = await open()
    await storage.put('teamsheets/u1/a.pdf', bytes('one'))
    await storage.delete('teamsheets/u1/a.pdf')

    expect(await storage.get('teamsheets/u1/a.pdf')).toBeUndefined()
    expect(await storage.get('teamsheets/u1/never.pdf')).toBeUndefined()
  })

  it('treats deleting a missing file as done', async () => {
    const storage = await open()
    await expect(storage.delete('teamsheets/u1/never.pdf')).resolves.toBeUndefined()
    await expect(storage.deletePrefix('teamsheets/nobody/')).resolves.toBeUndefined()
  })

  it('deletes everything under a prefix and nothing else', async () => {
    const storage = await open()
    // More files than the fake S3 lists at once, so the driver must page through them.
    const doomed = ['a', 'b', 'c', 'd', 'e'].map((name) => `teamsheets/u1/${name}.pdf`)
    for (const key of doomed) await storage.put(key, bytes(key))
    await storage.put('teamsheets/u10/c.pdf', bytes('c'))
    await storage.deletePrefix('teamsheets/u1/')

    for (const key of doomed) expect(await storage.get(key), key).toBeUndefined()
    expect(await text(await storage.get('teamsheets/u10/c.pdf'))).toBe('c')
  })

  it('refuses keys that could reach outside the store', async () => {
    const storage = await open()
    for (const key of ['../escape.pdf', 'teamsheets/../../x', '/etc/passwd', 'a//b', ''])
      await expect(storage.put(key, bytes('x')), key).rejects.toThrow(/key/)
    await expect(storage.deletePrefix('teamsheets')).rejects.toThrow(/prefix/)
  })
})

describe('openDiskStorage', () => {
  it('creates its folder and leaves no temporary files behind', async () => {
    const storage = await openDiskStorage(join(root, 'new', 'uploads'))
    await storage.put('teamsheets/u1/a.pdf', bytes('one'))

    expect(await readdir(join(root, 'new', 'uploads', 'teamsheets', 'u1'))).toEqual(['a.pdf'])
  })

  it.skipIf(process.getuid?.() === 0)(
    "refuses to open a folder it can't write to, naming it",
    async () => {
      await chmod(root, 0o500)
      await expect(openDiskStorage(join(root, 'uploads'))).rejects.toThrow(
        `UPLOADS_DIR: can't write to ${join(root, 'uploads')}`,
      )
    },
  )
})

describe('openS3Storage', () => {
  it("refuses a bucket it can't reach, naming it", async () => {
    await expect(openS3Storage({ ...s3Options(), bucket: 'missing' })).rejects.toThrow(
      "S3_BUCKET: can't reach missing",
    )
  })

  it('refuses credentials the bucket rejects', async () => {
    await expect(openS3Storage({ ...s3Options(), accessKeyId: 'wrong' })).rejects.toThrow(
      `S3_BUCKET: can't reach ${FAKE_S3_BUCKET}`,
    )
  })

  it('keeps files in the bucket under their keys', async () => {
    const storage = await openS3Storage(s3Options())
    await storage.put('teamsheets/u2/kept.pdf', bytes('%PDF-1.7'))

    expect(s3.keys()).toContain('teamsheets/u2/kept.pdf')
  })
})

describe('openStorage', () => {
  const env = {
    DATABASE_URL: 'postgres://myvgc:pw@db:5432/myvgc',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    APP_URL: 'http://localhost:3000',
  }

  it('keeps files on disk when no bucket is configured', async () => {
    const storage = await openStorage(loadConfig({ ...env, UPLOADS_DIR: join(root, 'uploads') }))
    await storage.put('teamsheets/u3/a.pdf', bytes('one'))

    expect(await readdir(join(root, 'uploads', 'teamsheets', 'u3'))).toEqual(['a.pdf'])
    expect(s3.keys()).not.toContain('teamsheets/u3/a.pdf')
  })

  it('keeps files in S3 when a bucket is configured', async () => {
    const storage = await openStorage(
      loadConfig({
        ...env,
        UPLOADS_DIR: join(root, 'uploads'),
        S3_BUCKET: FAKE_S3_BUCKET,
        S3_ENDPOINT: s3.endpoint,
        S3_ACCESS_KEY_ID: FAKE_S3_ACCESS_KEY_ID,
        S3_SECRET_ACCESS_KEY: 'test-secret',
        S3_FORCE_PATH_STYLE: 'true',
      }),
    )
    await storage.put('teamsheets/u4/a.pdf', bytes('one'))

    expect(s3.keys()).toContain('teamsheets/u4/a.pdf')
    expect(await readdir(root)).not.toContain('uploads')
  })
})

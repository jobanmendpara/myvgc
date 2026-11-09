import { chmod, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type FileStorage, memoryStorage, openDiskStorage } from '../src/storage'

const bytes = (text: string) => new TextEncoder().encode(text)

async function text(stream: ReadableStream<Uint8Array> | undefined) {
  return stream ? new Response(stream).text() : undefined
}

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
    await storage.put('teamsheets/u1/a.pdf', bytes('a'))
    await storage.put('teamsheets/u1/b.pdf', bytes('b'))
    await storage.put('teamsheets/u10/c.pdf', bytes('c'))
    await storage.deletePrefix('teamsheets/u1/')

    expect(await storage.get('teamsheets/u1/a.pdf')).toBeUndefined()
    expect(await storage.get('teamsheets/u1/b.pdf')).toBeUndefined()
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

import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, constants, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'

/**
 * Where uploaded files live (ADR 27): a disk folder for self-hosting, and later S3-compatible
 * storage for the hosted service (DEV-71). Keys are paths such as `teamsheets/<userId>/<id>.pdf`.
 * Deleting something already gone counts as done.
 */
export interface FileStorage {
  /** Stores a file, replacing any file already under the key. */
  put(key: string, bytes: Uint8Array): Promise<void>
  /** The file under a key, or undefined when there is none. */
  get(key: string): Promise<ReadableStream<Uint8Array> | undefined>
  delete(key: string): Promise<void>
  /** Deletes every file whose key starts with the prefix, which ends in `/`. */
  deletePrefix(prefix: string): Promise<void>
}

// Segments of letters, digits, `.`, `_` and `-`, never `.` or `..` alone.
const SEGMENT = /^(?!\.{1,2}$)[\w.-]+$/

function checkKey(key: string) {
  if (!key.split('/').every((segment) => SEGMENT.test(segment)))
    throw new Error(`Not a storage key: ${JSON.stringify(key)}`)
}

function checkPrefix(prefix: string) {
  if (!prefix.endsWith('/')) throw new Error(`A storage prefix ends in "/": ${prefix}`)
  checkKey(prefix.slice(0, -1))
}

/** Files in a folder on disk. Creates the folder, and refuses one it can't write to. */
export async function openDiskStorage(dir: string): Promise<FileStorage> {
  const root = resolve(dir)
  try {
    await mkdir(root, { recursive: true })
    await access(root, constants.W_OK)
  } catch {
    throw new Error(`UPLOADS_DIR: can't write to ${root}`)
  }
  const pathOf = (key: string) => {
    checkKey(key)
    return join(root, key)
  }

  return {
    async put(key, bytes) {
      const path = pathOf(key)
      await mkdir(dirname(path), { recursive: true })
      // Written aside, then renamed, so a reader never sees half a file.
      const partial = `${path}.${randomUUID()}.partial`
      await writeFile(partial, bytes)
      await rename(partial, path)
    },
    async get(key) {
      const path = pathOf(key)
      const found = await stat(path).catch(() => undefined)
      if (!found?.isFile()) return undefined
      return Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>
    },
    async delete(key) {
      await rm(pathOf(key), { force: true })
    },
    async deletePrefix(prefix) {
      checkPrefix(prefix)
      await rm(join(root, prefix), { recursive: true, force: true })
    },
  }
}

/** Files kept in memory, for tests. */
export function memoryStorage(): FileStorage {
  const files = new Map<string, Uint8Array>()
  return {
    async put(key, bytes) {
      checkKey(key)
      files.set(key, bytes.slice())
    },
    async get(key) {
      checkKey(key)
      const bytes = files.get(key)
      return bytes ? new Response(bytes.slice()).body! : undefined
    },
    async delete(key) {
      checkKey(key)
      files.delete(key)
    },
    async deletePrefix(prefix) {
      checkPrefix(prefix)
      for (const key of files.keys()) if (key.startsWith(prefix)) files.delete(key)
    },
  }
}

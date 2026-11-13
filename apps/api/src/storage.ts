import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, constants, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  paginateListObjectsV2,
} from '@aws-sdk/client-s3'
import type { Config } from './config'

/**
 * Where uploaded files live (ADR 27): a disk folder for self-hosting, or S3-compatible storage
 * for the hosted service (DEV-71). Keys are paths such as `teamsheets/<userId>/<id>.pdf`.
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

/** Where an S3-compatible bucket is and how to sign in to it. */
export interface S3Options {
  bucket: string
  region: string
  /** For a provider other than AWS, such as `https://<account>.r2.cloudflarestorage.com`. */
  endpoint?: string
  /** Both or neither. Without them the AWS SDK looks for credentials itself (`AWS_*`, a role). */
  accessKeyId?: string
  secretAccessKey?: string
  /** `bucket` in the path rather than the host name, which MinIO and some others need. */
  forcePathStyle?: boolean
}

// A missing key only. A missing bucket (NoSuchBucket, also a 404) is a misconfiguration and
// should surface as an error, not as every attachment being gone.
const isNotFound = (error: unknown) =>
  error instanceof S3ServiceException && (error.name === 'NoSuchKey' || error.name === 'NotFound')

/** Deletes sent at once by deletePrefix, well inside the client's 50 connections. */
const DELETE_BATCH = 10

/**
 * Files in an S3-compatible bucket (DEV-71). Checks the bucket can be reached, and refuses to
 * open one it can't. Files are never given out by URL: the API streams them (ADR 27).
 */
export async function openS3Storage(options: S3Options): Promise<FileStorage> {
  const { bucket } = options
  const client = new S3Client({
    region: options.region,
    endpoint: options.endpoint,
    forcePathStyle: options.forcePathStyle,
    credentials:
      options.accessKeyId && options.secretAccessKey
        ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
        : undefined,
    // Only the checksums S3 insists on. The newer defaults break several S3-compatible providers.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch (error) {
    // S3's answer (NotFound, AccessDenied…) or the network's (ECONNREFUSED…).
    const { code, name, message } = error as Error & { code?: string }
    const reason = code ?? (name && name !== 'Error' ? name : message)
    throw new Error(`S3_BUCKET: can't reach ${bucket} (${reason})`, { cause: error })
  }

  return {
    async put(key, bytes) {
      checkKey(key)
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes }))
    },
    async get(key) {
      checkKey(key)
      try {
        const { Body } = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
        return Body?.transformToWebStream() as ReadableStream<Uint8Array> | undefined
      } catch (error) {
        if (isNotFound(error)) return undefined
        throw error
      }
    },
    async delete(key) {
      checkKey(key)
      // S3 answers a delete of a missing key with success.
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    },
    async deletePrefix(prefix) {
      checkPrefix(prefix)
      // One delete per key rather than DeleteObjects, which some providers lack. A prefix holds
      // one User's files, one per Tournament at most.
      for await (const page of paginateListObjectsV2(
        { client },
        { Bucket: bucket, Prefix: prefix },
      )) {
        const keys = (page.Contents ?? []).flatMap(({ Key }) => (Key ? [Key] : []))
        for (let start = 0; start < keys.length; start += DELETE_BATCH)
          await Promise.all(
            keys
              .slice(start, start + DELETE_BATCH)
              .map((Key) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key }))),
          )
      }
    },
  }
}

/** S3 when a bucket is configured, otherwise a disk folder, so self-hosting needs no setup. */
export function openStorage(
  config: Pick<
    Config,
    | 'UPLOADS_DIR'
    | 'S3_BUCKET'
    | 'S3_REGION'
    | 'S3_ENDPOINT'
    | 'S3_ACCESS_KEY_ID'
    | 'S3_SECRET_ACCESS_KEY'
    | 'S3_FORCE_PATH_STYLE'
  >,
): Promise<FileStorage> {
  if (!config.S3_BUCKET) return openDiskStorage(config.UPLOADS_DIR)
  return openS3Storage({
    bucket: config.S3_BUCKET,
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT,
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
  })
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

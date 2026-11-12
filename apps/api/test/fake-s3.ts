import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

export const FAKE_S3_BUCKET = 'myvgc-test'
export const FAKE_S3_ACCESS_KEY_ID = 'test-access-key'

/** Keys a list returns at most per page, kept small so callers must follow continuation tokens. */
const PAGE_SIZE = 2

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * A small S3-compatible server on a free local port, holding one bucket in memory. It speaks
 * path-style requests for the calls the S3 driver makes: HeadBucket, PutObject, GetObject,
 * DeleteObject and ListObjectsV2. It checks requests are signed with the test access key but
 * doesn't verify the signature.
 */
export async function startFakeS3() {
  const objects = new Map<string, Buffer>()

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const [, bucket = '', ...rest] = url.pathname.split('/')
    const key = rest.map(decodeURIComponent).join('/')
    const xml = (status: number, body: string) => {
      res.writeHead(status, { 'content-type': 'application/xml' })
      res.end(`<?xml version="1.0" encoding="UTF-8"?>${body}`)
    }
    const error = (status: number, code: string) =>
      xml(status, `<Error><Code>${code}</Code><Message>${code}</Message></Error>`)

    const authorization = req.headers.authorization ?? ''
    if (!authorization.startsWith(`AWS4-HMAC-SHA256 Credential=${FAKE_S3_ACCESS_KEY_ID}/`))
      return error(403, 'InvalidAccessKeyId')
    if (bucket !== FAKE_S3_BUCKET) {
      if (req.method === 'HEAD') return res.writeHead(404).end()
      return error(404, 'NoSuchBucket')
    }

    if (!key) {
      if (req.method === 'HEAD') return res.writeHead(200).end()
      if (req.method === 'GET' && url.searchParams.get('list-type') === '2') {
        const prefix = url.searchParams.get('prefix') ?? ''
        const after = url.searchParams.get('continuation-token') ?? ''
        const matching = [...objects.keys()]
          .filter((name) => name.startsWith(prefix) && name > after)
          .sort()
        const page = matching.slice(0, PAGE_SIZE)
        const truncated = matching.length > page.length
        const contents = page
          .map(
            (name) =>
              `<Contents><Key>${escapeXml(name)}</Key><Size>${objects.get(name)!.length}</Size></Contents>`,
          )
          .join('')
        const next = truncated
          ? `<NextContinuationToken>${escapeXml(page.at(-1)!)}</NextContinuationToken>`
          : ''
        return xml(
          200,
          `<ListBucketResult><Name>${bucket}</Name><Prefix>${escapeXml(prefix)}</Prefix><KeyCount>${page.length}</KeyCount><IsTruncated>${truncated}</IsTruncated>${contents}${next}</ListBucketResult>`,
        )
      }
      return error(405, 'MethodNotAllowed')
    }

    if (req.method === 'PUT') {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => {
        objects.set(key, Buffer.concat(chunks))
        res.writeHead(200, { etag: '"fake"' }).end()
      })
      return
    }
    if (req.method === 'GET') {
      const body = objects.get(key)
      if (!body) return error(404, 'NoSuchKey')
      return res
        .writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': body.length,
        })
        .end(body)
    }
    if (req.method === 'DELETE') {
      objects.delete(key)
      return res.writeHead(204).end()
    }
    return error(405, 'MethodNotAllowed')
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return {
    endpoint: `http://127.0.0.1:${port}`,
    /** The keys stored, sorted, to check what the driver left behind. */
    keys: () => [...objects.keys()].sort(),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
        // The SDK keeps connections alive, which would hold close() open.
        server.closeAllConnections()
      }),
  }
}

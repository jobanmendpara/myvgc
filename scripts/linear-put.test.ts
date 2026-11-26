// Tests scripts/linear-put.ts through its command line, against a stub server that stands in for
// the signed upload link. Run with `pnpm test:scripts`.
import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

const script = join(import.meta.dirname, 'linear-put.ts')

interface Received {
  path: string
  method: string
  headers: IncomingHttpHeaders
  body: Buffer
}

let server: Server
let base: string
let dir: string
let shot: string
let received: Received[]

// A path starting /status/<n> answers n; any other answers 200.
beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      received.push({
        path: req.url!,
        method: req.method!,
        headers: req.headers,
        body: Buffer.concat(chunks),
      })
      const status = Number(/^\/status\/(\d+)/.exec(req.url!)?.[1] ?? 200)
      res
        .writeHead(status)
        .end(status === 200 ? '' : '<Error><Code>SignatureDoesNotMatch</Code></Error>')
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  dir = mkdtempSync(join(tmpdir(), 'linear-put-'))
  shot = join(dir, 'shot.png')
  writeFileSync(shot, 'not really a png')
})

afterAll(() => {
  server.close()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  received = []
})

function run(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile('node', [script, ...args], (error, stdout, stderr) =>
      resolve({ code: error ? (error.code as number) : 0, stdout, stderr }),
    )
  })
}

// What prepare_attachment_upload returns, trimmed to the fields the script reads.
function prepared(path: string, size = 16) {
  return JSON.stringify({
    assetUrl: `https://uploads.linear.app${path}`,
    uploadRequest: {
      method: 'PUT',
      url: `${base}${path}?X-Goog-Signature=abc`,
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=31536000',
        'x-goog-content-length-range': `${size},${size}`,
        'Content-Disposition': 'attachment; filename="shot.png"',
      },
    },
  })
}

describe('linear-put', () => {
  test('sizes prints what the prepare tool asks for', async () => {
    const { code, stdout } = await run('sizes', shot)
    expect(code).toBe(0)
    expect(JSON.parse(stdout)).toEqual({ filename: 'shot.png', contentType: 'image/png', size: 16 })
  })

  test('PUTs the file with the prepare result’s headers, verbatim, and prints the assetUrl', async () => {
    const { code, stdout } = await run(shot, prepared('/a'))
    expect(code).toBe(0)
    expect(stdout).toContain('assetUrl: https://uploads.linear.app/a')
    expect(received).toHaveLength(1)
    const [put] = received
    expect(put!.method).toBe('PUT')
    expect(put!.path).toBe('/a?X-Goog-Signature=abc')
    expect(put!.body.toString()).toBe('not really a png')
    expect(put!.headers).toMatchObject({
      'content-type': 'image/png',
      'cache-control': 'public, max-age=31536000',
      'x-goog-content-length-range': '16,16',
      'content-disposition': 'attachment; filename="shot.png"',
    })
  })

  test('takes several files, each with its prepare result', async () => {
    const { code } = await run(shot, prepared('/a'), shot, prepared('/b'))
    expect(code).toBe(0)
    expect(received.map((r) => r.path)).toEqual([
      '/a?X-Goog-Signature=abc',
      '/b?X-Goog-Signature=abc',
    ])
  })

  test('takes a signed URL and headers instead', async () => {
    const { code } = await run(
      shot,
      `${base}/c`,
      'content-type: image/png',
      'cache-control: no-cache',
    )
    expect(code).toBe(0)
    expect(received[0]!.headers).toMatchObject({
      'content-type': 'image/png',
      'cache-control': 'no-cache',
    })
  })

  test('fails loudly on a non-2xx answer, and still tries the other files', async () => {
    const { code, stdout, stderr } = await run(shot, prepared('/status/403'), shot, prepared('/d'))
    expect(code).toBe(1)
    expect(stderr).toContain('PUT answered 403')
    expect(stderr).toContain('SignatureDoesNotMatch')
    expect(stderr).toContain('prepare this file again')
    expect(stderr).toContain('1 of 2 uploads failed')
    expect(stdout).toContain('assetUrl: https://uploads.linear.app/d')
  })

  test('refuses a file whose size differs from the one prepared, without a PUT', async () => {
    const { code, stderr } = await run(shot, prepared('/e', 99))
    expect(code).toBe(1)
    expect(stderr).toContain('is 16 bytes, but the link was prepared for 99-99 bytes')
    expect(received).toHaveLength(0)
  })

  test('refuses an argument that is neither JSON nor a URL', async () => {
    const { code, stderr } = await run(shot, 'nonsense')
    expect(code).toBe(1)
    expect(stderr).toContain("isn't JSON or a URL")
  })

  test('exits 2 with the usage when given too little', async () => {
    const { code, stderr } = await run(shot)
    expect(code).toBe(2)
    expect(stderr).toContain('Usage:')
  })
})

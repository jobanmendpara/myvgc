// Uploads files to the signed links that the Linear MCP's prepare_attachment_upload (or
// prepare_file_upload) returns, sending each link's signed headers verbatim. See
// docs/wiki/preview.md, "Screenshots in PRs".
//
//   node scripts/linear-put.ts sizes <file>...
//     Prints the filename, contentType and size to pass to the prepare tool, for each file.
//   node scripts/linear-put.ts <file> '<prepare result JSON>' [<file> '<JSON>']...
//     PUTs each file to its prepared link, then prints the assetUrl to pass to
//     create_attachment_from_upload (and the Markdown, when the prepare result has it).
//   node scripts/linear-put.ts <file> <signed-url> ['<name>: <value>']...
//     PUTs one file to a signed link with the headers given.
//
// Exits 1, naming the file, when a PUT gets a non-2xx answer, when a file's size differs from the
// size it was prepared for, or when the arguments can't be read; exits 2 on a usage error.
import { readFileSync, statSync } from 'node:fs'
import { basename, extname } from 'node:path'

const USAGE = `Usage:
  node scripts/linear-put.ts sizes <file>...
  node scripts/linear-put.ts <file> '<prepare result JSON>' [<file> '<JSON>']...
  node scripts/linear-put.ts <file> <signed-url> ['<name>: <value>']...`

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.json': 'application/json',
}

class Failure extends Error {
  readonly code: number
  constructor(message: string, code = 1) {
    super(message)
    this.code = code
  }
}

const usageError = (why?: string) => new Failure(why ? `${why}\n${USAGE}` : USAGE, 2)

interface Upload {
  file: string
  url: string
  headers: Record<string, string>
  assetUrl?: string
  markdown?: string
}

function contentType(file: string): string {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

interface PrepareResult {
  assetUrl?: string
  markdown?: string
  uploadRequest?: { url?: unknown; headers?: unknown }
}

function readHeaders(raw: unknown, file: string): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Failure(`${file}: the prepare result has no uploadRequest.headers`)
  }
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)]))
}

function fromPrepareResult(file: string, json: string): Upload {
  let result: PrepareResult
  try {
    result = JSON.parse(json)
  } catch {
    throw new Failure(`${file}: the argument after it isn't JSON or a URL: ${json.slice(0, 80)}`)
  }
  const request = result.uploadRequest ?? {}
  if (typeof request.url !== 'string') {
    throw new Failure(`${file}: the prepare result has no uploadRequest.url`)
  }
  return {
    file,
    url: request.url,
    headers: readHeaders(request.headers, file),
    assetUrl: result.assetUrl,
    markdown: result.markdown,
  }
}

function fromHeaderArgs(file: string, url: string, args: string[]): Upload {
  const headers: Record<string, string> = {}
  for (const arg of args) {
    const colon = arg.indexOf(':')
    if (colon < 1) throw new Failure(`not a '<name>: <value>' header: ${arg}`)
    headers[arg.slice(0, colon).trim()] = arg.slice(colon + 1).trim()
  }
  return { file, url, headers }
}

function parseArgs(args: string[]): Upload[] {
  if (args.length < 2) throw usageError()
  if (/^https?:\/\//.test(args[1]!)) return [fromHeaderArgs(args[0]!, args[1]!, args.slice(2))]
  if (args.length % 2 !== 0) throw usageError('each file needs its prepare result')
  const uploads: Upload[] = []
  for (let i = 0; i < args.length; i += 2) uploads.push(fromPrepareResult(args[i]!, args[i + 1]!))
  return uploads
}

function header(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name)
  return key === undefined ? undefined : headers[key]
}

async function put(upload: Upload): Promise<void> {
  let body: Buffer
  try {
    body = readFileSync(upload.file)
  } catch {
    throw new Failure(`${upload.file}: can't read the file`)
  }
  // The signed link holds the size it was prepared for, so a different file gets a bare 403.
  const range = header(upload.headers, 'x-goog-content-length-range')?.split(',')
  if (range && (body.length < Number(range[0]) || body.length > Number(range[1]))) {
    throw new Failure(
      `${upload.file}: is ${body.length} bytes, but the link was prepared for ${range.join('-')} bytes`,
    )
  }
  let response: Response
  try {
    response = await fetch(upload.url, {
      method: 'PUT',
      headers: upload.headers,
      body: new Uint8Array(body),
    })
  } catch (error) {
    throw new Failure(`${upload.file}: PUT failed: ${(error as Error).message}`)
  }
  if (!response.ok) {
    const text = (await response.text()).slice(0, 500)
    const expired = response.status === 400 || response.status === 403
    throw new Failure(
      `${upload.file}: PUT answered ${response.status} ${response.statusText}${text ? `\n${text}` : ''}` +
        (expired ? '\nSigned links last 60 seconds: prepare this file again, then rerun.' : ''),
    )
  }
}

async function main(args: string[]): Promise<number> {
  if (args[0] === '--help' || args[0] === '-h') {
    console.log(USAGE)
    return 0
  }
  if (args[0] === 'sizes') {
    if (args.length < 2) throw usageError()
    for (const file of args.slice(1)) {
      let size: number
      try {
        size = statSync(file).size
      } catch {
        throw new Failure(`${file}: can't read the file`)
      }
      console.log(
        JSON.stringify({ filename: basename(file), contentType: contentType(file), size }),
      )
    }
    return 0
  }
  const uploads = parseArgs(args)
  let failed = 0
  for (const upload of uploads) {
    try {
      await put(upload)
      console.log(`${upload.file}: uploaded`)
      if (upload.assetUrl) console.log(`  assetUrl: ${upload.assetUrl}`)
      if (upload.markdown) console.log(`  markdown: ${upload.markdown}`)
    } catch (error) {
      if (!(error instanceof Failure)) throw error
      console.error(error.message)
      failed++
    }
  }
  if (failed) console.error(`${failed} of ${uploads.length} uploads failed`)
  return failed ? 1 : 0
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      if (!(error instanceof Failure)) throw error
      console.error(error.message)
      process.exit(error.code)
    },
  )
}

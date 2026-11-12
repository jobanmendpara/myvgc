import type { SeenTeam } from '@myvgc/core'
import { describe, expect, it } from 'vitest'
import { DEFAULT_TEAM_READER_MODEL } from '../src/config'
import { ImageReadFailed, anthropicTeamReader } from '../src/team-reader'

// The Anthropic reader against a stubbed `fetch`: these tests check the request it builds and how
// it takes the answer, and never call Anthropic. DEV-102 checks it against the real model.

const SEEN: SeenTeam = { name: '', pokemon: [] }
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** A reader whose provider answers with `reply`, recording the requests it was sent. */
function stubbed(reply: { status?: number; body: unknown }) {
  const requests: { url: string; body: Record<string, unknown> }[] = []
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body)),
    })
    return new Response(JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof globalThis.fetch
  const reader = anthropicTeamReader({
    apiKey: 'test-key',
    model: DEFAULT_TEAM_READER_MODEL,
    fetch,
  })
  return { reader, requests }
}

const message = (overrides: Record<string, unknown> = {}) => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model: DEFAULT_TEAM_READER_MODEL,
  content: [{ type: 'text', text: JSON.stringify(SEEN) }],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1 },
  ...overrides,
})

describe('anthropicTeamReader', () => {
  it('sends the images with structured output and returns what the model saw', async () => {
    const { reader, requests } = stubbed({ body: message() })

    expect(await reader.read([{ type: 'image/png', bytes: PNG }])).toEqual(SEEN)

    const [request] = requests
    expect(request!.url).toMatch(/\/v1\/messages/)
    expect(request!.body).toMatchObject({
      model: 'claude-sonnet-5-5',
      fallbacks: 'default',
      output_config: { format: { type: 'json_schema' } },
    })
    const content = (request!.body.messages as { content: unknown[] }[])[0]!.content
    expect(content[0]).toEqual({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: Buffer.from(PNG).toString('base64'),
      },
    })
  })

  it('fails on a refusal', async () => {
    const { reader } = stubbed({ body: message({ stop_reason: 'refusal', content: [] }) })
    await expect(reader.read([{ type: 'image/png', bytes: PNG }])).rejects.toEqual(
      new ImageReadFailed('refusal'),
    )
  })

  it('fails with only the status when the API answers an error', async () => {
    const { reader } = stubbed({
      status: 400,
      body: { type: 'error', error: { type: 'invalid_request_error', message: 'bad image' } },
    })
    await expect(reader.read([{ type: 'image/png', bytes: PNG }])).rejects.toEqual(
      new ImageReadFailed('BadRequestError 400'),
    )
  })
})

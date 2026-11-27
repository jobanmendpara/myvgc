// Tests `pnpm factory` through its command entry, factory(), with a fake Tracker and real temporary
// folders standing in for the repo (.sandcastle/.env) and ~/.config/myvgc-factory.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { factory } from '../src/factory.ts'
import type { Issue, Tracker } from '../src/ports.ts'

const SPEC = 'DEV-269'

/** What the temporary folders hold. */
interface Layout {
  appKey?: boolean
  config?: Record<string, string>
  sandcastleEnv?: Record<string, string> | null
}

const CONFIG = { GITHUB_APP_ID: '123', GITHUB_INSTALLATION_ID: '456', LINEAR_API_KEY: 'lin_api_x' }
const COMPLETE: Required<Layout> = {
  appKey: true,
  config: CONFIG,
  sandcastleEnv: { CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat-x' },
}

const folders: string[] = []
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

function envFile(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key}=${value}\n`)
    .join('')
}

/** Lays out the repo and config folders, runs factory() and records what it did. */
async function run(args: string[], issues: Issue[], layout: Layout = {}) {
  const { appKey, config, sandcastleEnv } = { ...COMPLETE, ...layout }
  const root = mkdtempSync(join(tmpdir(), 'factory-'))
  folders.push(root)
  const repoDir = join(root, 'repo')
  const configDir = join(root, 'config')
  mkdirSync(join(repoDir, '.sandcastle'), { recursive: true })
  mkdirSync(configDir)
  if (appKey) writeFileSync(join(configDir, 'app.pem'), '-----BEGIN RSA PRIVATE KEY-----\n')
  if (Object.keys(config).length > 0) writeFileSync(join(configDir, 'config.env'), envFile(config))
  if (sandcastleEnv) writeFileSync(join(repoDir, '.sandcastle', '.env'), envFile(sandcastleEnv))

  const trackerCalls: string[] = []
  // Records every call, including to methods later tickets add to the Tracker (claiming, comments,
  // statuses), so "reads the spec and nothing else" keeps meaning something as the port grows.
  const tracker = new Proxy({} as Tracker, {
    get:
      (_, method: string) =>
      async (...callArgs: unknown[]) => {
        trackerCalls.push(`${method} ${callArgs.join(' ')}`)
        if (method === 'getIssue') return issues.find((issue) => issue.id === callArgs[0]) ?? null
      },
  })
  const lines: string[] = []
  const code = await factory(args, {
    repoDir,
    configDir,
    tracker: () => tracker,
    print: (line) => lines.push(line),
  })
  return { code, output: lines.join('\n'), trackerCalls }
}

const signedOff: Issue = {
  id: SPEC,
  title: 'Factory spec',
  labels: ['spec', 'signed-off', 'Chore'],
}

describe('pnpm factory', () => {
  test('starts on a signed-off spec once everything is set up', async () => {
    const result = await run([SPEC], [signedOff])
    expect(result.code).toBe(0)
    expect(result.trackerCalls).toEqual([`getIssue ${SPEC}`])
  })

  test('refuses a spec without signed-off, reading it and nothing else', async () => {
    const result = await run([SPEC], [{ ...signedOff, labels: ['spec', 'Chore'] }])
    expect(result.code).toBe(1)
    expect(result.output).toContain('`signed-off`')
    expect(result.trackerCalls).toEqual([`getIssue ${SPEC}`])
  })

  test('refuses an issue that is not a spec', async () => {
    const result = await run([SPEC], [{ ...signedOff, labels: ['signed-off', 'Chore'] }])
    expect(result.code).toBe(1)
    expect(result.output).toContain(`${SPEC} isn't a spec`)
    expect(result.trackerCalls).toEqual([`getIssue ${SPEC}`])
  })

  test('refuses an issue Linear does not have', async () => {
    const result = await run([SPEC], [])
    expect(result.code).toBe(1)
    expect(result.output).toContain(`${SPEC} wasn't found`)
  })

  test('refuses CLAUDE_CODE_EFFORT_LEVEL in .sandcastle/.env before asking Linear', async () => {
    const result = await run([SPEC], [signedOff], {
      sandcastleEnv: { ...COMPLETE.sandcastleEnv, CLAUDE_CODE_EFFORT_LEVEL: 'high' },
    })
    expect(result.code).toBe(1)
    expect(result.output).toContain('CLAUDE_CODE_EFFORT_LEVEL')
    expect(result.trackerCalls).toEqual([])
  })

  test('takes an ANTHROPIC_API_KEY in place of the subscription token', async () => {
    const result = await run([SPEC], [signedOff], {
      sandcastleEnv: { ANTHROPIC_API_KEY: 'sk-ant-api-x' },
    })
    expect(result.code).toBe(0)
  })

  const { LINEAR_API_KEY, GITHUB_APP_ID, GITHUB_INSTALLATION_ID } = CONFIG
  test.each<[string, Layout, string[]]>([
    ['the App key', { appKey: false }, ['GitHub App private key', 'app.pem']],
    [
      'the App ID',
      { config: { GITHUB_INSTALLATION_ID, LINEAR_API_KEY } },
      ['GITHUB_APP_ID', 'config.env'],
    ],
    [
      'the installation ID',
      { config: { GITHUB_APP_ID, LINEAR_API_KEY } },
      ['GITHUB_INSTALLATION_ID', 'config.env'],
    ],
    [
      'the Linear API key',
      { config: { GITHUB_APP_ID, GITHUB_INSTALLATION_ID } },
      ['LINEAR_API_KEY', 'config.env'],
    ],
    [
      'the Claude credential',
      { sandcastleEnv: {} },
      ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', '.sandcastle/.env'],
    ],
    ['.sandcastle/.env', { sandcastleEnv: null }, ['CLAUDE_CODE_OAUTH_TOKEN', '.sandcastle/.env']],
  ])('names %s and where it belongs when it is missing', async (_, layout, named) => {
    const result = await run([SPEC], [signedOff], layout)
    expect(result.code).toBe(1)
    for (const text of named) expect(result.output).toContain(text)
    expect(result.trackerCalls).toEqual([])
  })

  test.each([[[SPEC]], [[SPEC, '--dry-run']]])(
    'names every missing item at once (%j)',
    async (args) => {
      const result = await run(args, [signedOff], {
        appKey: false,
        config: {},
        sandcastleEnv: null,
      })
      expect(result.code).toBe(1)
      for (const text of [
        'app.pem',
        'GITHUB_APP_ID',
        'GITHUB_INSTALLATION_ID',
        'LINEAR_API_KEY',
        'CLAUDE_CODE_OAUTH_TOKEN',
      ]) {
        expect(result.output).toContain(text)
      }
    },
  )

  test.each([[[]], [['DEV-269', 'DEV-270']], [['--frobnicate', SPEC]], [['not-an-issue']]])(
    'exits 64 with the usage for %j',
    async (args) => {
      const result = await run(args, [signedOff])
      expect(result.code).toBe(64)
      expect(result.output).toContain('Usage: pnpm factory')
      expect(result.trackerCalls).toEqual([])
    },
  )
})

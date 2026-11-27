// Tests `pnpm accuracy` before and after a change to an ADR 24 path (ADR 24, CLAUDE.md), through
// `pnpm factory <spec> --only DEV-M` with fake ports (test/harness.ts).
import { describe, expect, test } from 'vitest'
import {
  accuracyOutput,
  BASE_COMMIT,
  CONFIG,
  type Event,
  run,
  type Script,
  SPEC,
  signedOff,
  ticket,
} from './harness.ts'

const TICKET = ticket('DEV-2')
const KEY = 'sk-ant-api-accuracy-x'

function workDev2(script: Script = {}, config: Record<string, string> = withKey) {
  return run([SPEC, '--only', 'DEV-2'], [signedOff], {
    tickets: [TICKET],
    script,
    layout: { config },
  })
}
const withKey = { ...CONFIG, ANTHROPIC_API_KEY: KEY }

type Exec = Extract<Event, { method: 'exec' }>
const execs = (events: Event[]) =>
  events.filter((event): event is Exec => event.port === 'sandbox' && event.method === 'exec')
const accuracyRuns = (events: Event[]) =>
  execs(events).filter((event) => event.command === 'pnpm accuracy')
const prBodies = (events: Event[]) =>
  events.flatMap((event) =>
    event.port === 'forge' && event.method === 'openPr'
      ? [(event.args[0] as { body: string }).body]
      : [],
  )

/** The files ADR 24 names (its reader, schema, default model, image shrinking and accuracy check). */
const ADR_24_FILES = [
  'apps/api/src/team-reader.ts',
  'packages/core/src/seen-team.ts',
  'apps/api/src/config.ts',
  'apps/web/app/lib/shrink-image.ts',
  'apps/api/test/reading-fixtures/sun-charizard/expected.json',
  'apps/api/test/reading.accuracy.ts',
  'apps/api/scripts/accuracy.ts',
]

describe('a diff touching an ADR 24 path', () => {
  test('runs pnpm accuracy on the base commit, then on the branch, before the push', async () => {
    const { code, events } = await workDev2({
      changedFiles: ['apps/api/src/app.ts', 'packages/core/src/seen-team.ts'],
    })
    expect(code).toBe(0)
    const runs = accuracyRuns(events)
    expect(runs.map((event) => event.checkout)).toEqual([BASE_COMMIT, 'branch'])
    const push = events.findIndex((event) => event.port === 'forge' && event.method === 'push')
    const lastRun = events.lastIndexOf(runs.at(-1) as Event)
    expect(push).toBeGreaterThan(lastRun)
  })

  test('installs each checkout before its run, and ends back on the branch', async () => {
    const { events } = await workDev2({ changedFiles: ['packages/core/src/seen-team.ts'] })
    const steps = execs(events)
      .filter(
        (event) => event.command.includes('pnpm install') || event.command === 'pnpm accuracy',
      )
      .map(
        (event) =>
          `${event.command.includes('install') ? 'install' : 'accuracy'} on ${event.checkout}`,
      )
    // The first install is the sandbox's own, before the Implementer.
    expect(steps).toEqual([
      'install on branch',
      `install on ${BASE_COMMIT}`,
      `accuracy on ${BASE_COMMIT}`,
      'install on branch',
      'accuracy on branch',
    ])
    expect(execs(events).at(-1)?.checkout).toBe('branch')
  })

  test.each(['base', 'branch'] as const)(
    'parks the ticket when the %s checkout fails, and queues no merge',
    async (checkoutFails) => {
      const { code, events, lines } = await workDev2({
        changedFiles: ['apps/api/src/team-reader.ts'],
        checkoutFails,
      })
      expect(code).toBe(1)
      expect(events.filter((event) => event.method === 'queueAutoMerge')).toEqual([])
      expect(lines.find((line) => line.includes('· park:'))).toContain("couldn't be checked out")
    },
  )

  test('puts both summaries in the PR body, without the run lines or the report', async () => {
    const { events } = await workDev2({
      changedFiles: ['apps/api/src/team-reader.ts'],
      accuracy: {
        base: accuracyOutput('base', 3),
        branch: accuracyOutput('branch', 4),
      },
    })
    const [body = ''] = prBodies(events)
    const before = body.indexOf('claude-haiku-5-5: 3 of 4 passed')
    const after = body.indexOf('claude-haiku-5-5: 4 of 4 passed')
    expect(before).toBeGreaterThan(-1)
    expect(after).toBeGreaterThan(before)
    expect(body).toContain(`On the base commit ${BASE_COMMIT}:`)
    expect(body).toContain('On the branch:')
    expect(body).toContain('0 differences  on base')
    expect(body).not.toContain('4 s on base')
    expect(body).not.toContain('Report: ')
    expect(body.indexOf('Closes DEV-2')).toBeGreaterThan(after)
  })

  test('keeps closing words in a summary from closing another issue', async () => {
    const { events } = await workDev2({
      changedFiles: ['apps/api/src/team-reader.ts'],
      accuracy: { branch: 'Reading accuracy, x: fixes DEV-9, 1 of 1 passed' },
    })
    const [body = ''] = prBodies(events)
    expect(
      [...body.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+([A-Z]+-\d+)/gi)].map(
        (match) => match[1],
      ),
    ).toEqual(['DEV-2'])
  })

  test('gives ANTHROPIC_API_KEY to the accuracy command alone, never the sandbox', async () => {
    const { events } = await workDev2({ changedFiles: ['apps/api/src/config.ts'] })
    const runs = accuracyRuns(events)
    expect(runs).toHaveLength(2)
    for (const accuracy of runs) expect(accuracy.env).toEqual({ ANTHROPIC_API_KEY: KEY })
    const others = execs(events).filter((event) => event.command !== 'pnpm accuracy')
    expect(others.filter((event) => event.env !== undefined)).toEqual([])
    expect(JSON.stringify(others)).not.toContain(KEY)
    const created = events.flatMap((event) =>
      event.port === 'sandboxes' ? [event.options.env] : [],
    )
    expect(created).toEqual([{ CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat-x' }])
    const agentSteps = events.filter((event) => event.method === 'runAgent')
    expect(JSON.stringify(agentSteps)).not.toContain(KEY)
  })

  test.each(ADR_24_FILES)('runs pnpm accuracy when the branch changes %s', async (file) => {
    const { events } = await workDev2({ changedFiles: [file] })
    expect(accuracyRuns(events)).toHaveLength(2)
  })

  test('parks the ticket, naming where the key belongs, when the set-up has none', async () => {
    const { code, events, lines } = await workDev2(
      { changedFiles: ['apps/web/app/lib/shrink-image.ts'] },
      CONFIG,
    )
    expect(code).toBe(1)
    expect(accuracyRuns(events)).toEqual([])
    const merges = events.filter((event) => event.method === 'queueAutoMerge')
    expect(merges).toEqual([])
    const drafts = prBodies(events)
    expect(drafts).toHaveLength(1)
    const park = lines.find((line) => line.includes('· park:')) ?? ''
    expect(park).toMatch(/ANTHROPIC_API_KEY in \S+config\.env/)
  })
})

describe('a diff touching no ADR 24 path', () => {
  test.each([
    ['other code', ['apps/api/src/app.ts', 'packages/core/src/team.ts']],
    [
      'risky paths that are not ADR 24 reading files',
      ['docs/adr/0024-reading-teams-from-files.md', 'apps/api/drizzle/0001_x.sql'],
    ],
    ['a file beside the fixtures', ['apps/api/test/reading-fixtures.ts']],
    ['nothing', []],
  ])('runs no pnpm accuracy for %s, and needs no key', async (_, changedFiles) => {
    const { code, events } = await workDev2({ changedFiles }, CONFIG)
    expect(code).toBe(0)
    expect(accuracyRuns(events)).toEqual([])
    expect(
      execs(events).filter((event) => event.command.startsWith('git checkout --detach')),
    ).toEqual([])
    const [body = ''] = prBodies(events)
    expect(body).not.toContain('Reading accuracy')
  })
})

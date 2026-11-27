// Tests `pnpm factory`'s start-up checks and frontier through its command entry (test/harness.ts).
import { describe, expect, test } from 'vitest'
import {
  BACKLOG,
  CANCELED,
  COMPLETE,
  CONFIG,
  DONE,
  IN_PROGRESS,
  type Layout,
  listed,
  run,
  SPEC,
  signedOff,
  ticket,
} from './harness.ts'
import type { Ticket } from '../src/ports.ts'

describe('pnpm factory', () => {
  test('starts on a signed-off spec once everything is set up', async () => {
    const result = await run([SPEC, '--dry-run'], [signedOff])
    expect(result.code).toBe(0)
    expect(result.trackerCalls).toEqual([`getIssue ${SPEC}`, `getSubIssues ${SPEC}`])
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
      layout: { sandcastleEnv: { ...COMPLETE.sandcastleEnv, CLAUDE_CODE_EFFORT_LEVEL: 'high' } },
    })
    expect(result.code).toBe(1)
    expect(result.output).toContain('CLAUDE_CODE_EFFORT_LEVEL')
    expect(result.trackerCalls).toEqual([])
  })

  test('takes an ANTHROPIC_API_KEY in place of the subscription token', async () => {
    const result = await run([SPEC, '--dry-run'], [signedOff], {
      layout: { sandcastleEnv: { ANTHROPIC_API_KEY: 'sk-ant-api-x' } },
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
    const result = await run([SPEC], [signedOff], { layout })
    expect(result.code).toBe(1)
    for (const text of named) expect(result.output).toContain(text)
    expect(result.trackerCalls).toEqual([])
  })

  test.each([[[SPEC]], [[SPEC, '--dry-run']]])(
    'names every missing item at once (%j)',
    async (args) => {
      const result = await run(args, [signedOff], {
        layout: { appKey: false, config: {}, sandcastleEnv: null },
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

  describe('the frontier', () => {
    test('holds only open, unblocked ready-for-agent tickets that nobody holds', async () => {
      const tickets = [
        ticket('DEV-1'),
        ticket('DEV-2', { blockedBy: [{ id: 'DEV-9', status: IN_PROGRESS }] }),
        ticket('DEV-3', { status: IN_PROGRESS }),
        ticket('DEV-4', { labels: ['needs-human', 'Chore'] }),
        ticket('DEV-5', { labels: ['ready-for-human', 'Chore'] }),
        ticket('DEV-6', { status: DONE }),
        ticket('DEV-7', { status: CANCELED }),
        ticket('DEV-8', { labels: ['Chore'] }),
      ]
      const result = await run([SPEC, '--dry-run'], [signedOff], { tickets })
      expect(result.code).toBe(0)
      expect(listed(result.output)).toEqual(['DEV-1'])
    })

    test("comes in Linear's manual order", async () => {
      const tickets = [
        ticket('DEV-1', { order: 3 }),
        ticket('DEV-2', { order: 1 }),
        ticket('DEV-3', { status: BACKLOG, order: 2 }),
      ]
      const result = await run([SPEC, '--dry-run'], [signedOff], { tickets })
      expect(listed(result.output)).toEqual(['DEV-2', 'DEV-3', 'DEV-1'])
    })

    test('takes a ticket blocked only by Done tickets, but not one blocked by a Canceled one', async () => {
      const tickets = [
        ticket('DEV-1', {
          blockedBy: [
            { id: 'DEV-8', status: DONE },
            { id: 'DEV-9', status: DONE },
          ],
        }),
        ticket('DEV-2', {
          blockedBy: [
            { id: 'DEV-8', status: DONE },
            { id: 'DEV-9', status: CANCELED },
          ],
        }),
      ]
      const result = await run([SPEC, '--dry-run'], [signedOff], { tickets })
      expect(listed(result.output)).toEqual(['DEV-1'])
    })

    test('--dry-run prints each ticket with its steps and models, and only reads Linear', async () => {
      const tickets = [ticket('DEV-1'), ticket('DEV-2')]
      const result = await run([SPEC, '--dry-run'], [signedOff], { tickets })
      expect(result.code).toBe(0)
      expect(result.output).toContain('Ticket DEV-1')
      expect(result.output).toContain('Ticket DEV-2')
      // Every step of How a factory Run works (DEV-253), in order, once per ticket.
      const plan = [
        'claim',
        'worktree and install',
        'Implementer (claude-sonnet-5-5, medium)',
        'host checks',
        'Reviewer (claude-opus-5-5, high)',
        'replay',
        'push gate',
        'pnpm accuracy before and after if an ADR 24 path changed',
        'push, PR, Reviewer comment and auto-merge',
        'close sandbox',
        'wait for checks',
      ].join(' → ')
      expect(result.output.split(plan)).toHaveLength(tickets.length + 1)
      for (const step of [
        'fix round 1 (claude-sonnet-5-5, high)',
        'fix round 2 (claude-opus-5-5, high)',
        'each back to host checks',
      ]) {
        expect(result.output.split(step)).toHaveLength(tickets.length + 1)
      }
      expect(result.output).toContain('nothing was changed')
      expect(result.trackerCalls).toEqual([`getIssue ${SPEC}`, `getSubIssues ${SPEC}`])
    })

    test('--dry-run says so when nothing is takeable', async () => {
      const result = await run([SPEC, '--dry-run'], [signedOff], {
        tickets: [ticket('DEV-1', { status: DONE })],
      })
      expect(result.code).toBe(0)
      expect(listed(result.output)).toEqual([])
      expect(result.output).toContain('Nothing on the frontier')
    })

    test('without --dry-run, it says working tickets is not built yet and changes nothing', async () => {
      const result = await run([SPEC], [signedOff], { tickets: [ticket('DEV-1')] })
      expect(result.code).toBe(1)
      expect(result.output).toContain("isn't built yet")
      expect(result.trackerCalls).toEqual([`getIssue ${SPEC}`, `getSubIssues ${SPEC}`])
    })
  })

  describe('--only', () => {
    test('plans just that ticket when it is takeable', async () => {
      const tickets = [ticket('DEV-1'), ticket('DEV-2')]
      const result = await run([SPEC, '--dry-run', '--only', 'DEV-2'], [signedOff], { tickets })
      expect(result.code).toBe(0)
      expect(listed(result.output)).toEqual(['DEV-2'])
    })

    test.each<[string, Partial<Ticket>, string[]]>([
      [
        'blocked by a ticket that is not Done',
        { blockedBy: [{ id: 'DEV-9', status: IN_PROGRESS }] },
        ['blocked by DEV-9', 'In Progress'],
      ],
      ['In Progress', { status: IN_PROGRESS }, ["it's In Progress"]],
      ['Done', { status: DONE }, ["it's Done"]],
      ['parked', { labels: ['needs-human'] }, ['`needs-human`']],
      ['not ready for an agent', { labels: ['ready-for-human'] }, ['`ready-for-agent`']],
    ])('refuses a ticket that is %s, naming why', async (_, changes, named) => {
      const tickets = [ticket('DEV-1'), ticket('DEV-2', changes)]
      const result = await run([SPEC, '--only', 'DEV-2'], [signedOff], { tickets })
      expect(result.code).toBe(1)
      expect(result.output).toContain("DEV-2 isn't takeable")
      for (const text of named) expect(result.output).toContain(text)
      expect(listed(result.output)).toEqual([])
      expect(result.trackerCalls).toEqual([`getIssue ${SPEC}`, `getSubIssues ${SPEC}`])
    })

    test('refuses a ticket that is not one of the spec', async () => {
      const result = await run([SPEC, '--only', 'DEV-99'], [signedOff], {
        tickets: [ticket('DEV-1')],
      })
      expect(result.code).toBe(1)
      expect(result.output).toContain(`DEV-99 isn't a ticket of ${SPEC}`)
    })
  })
})

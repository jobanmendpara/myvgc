// Tests `pnpm factory <spec> --only DEV-M` working one ticket from claim to a merged PR, through
// the command entry with fake ports (test/harness.ts).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import type { AgentStep } from '../src/ports.ts'
import {
  CRITERIA,
  type Event,
  review,
  RUN_ID,
  run,
  type Script,
  SPEC,
  signedOff,
  testCommandOf,
  ticket,
  WORKTREE,
} from './harness.ts'

const TICKET = ticket('DEV-2')

/** Works DEV-2 with `--only`, beside another takeable ticket. */
function workDev2(script: Script = {}, layout = {}) {
  return run([SPEC, '--only', 'DEV-2'], [signedOff], {
    tickets: [ticket('DEV-1'), TICKET],
    script,
    layout,
  })
}

const agentSteps = (events: Event[]): AgentStep[] =>
  events.flatMap((event) => (event.method === 'runAgent' && 'step' in event ? [event.step] : []))
const execs = (events: Event[]): string[] =>
  events.flatMap((event) => (event.method === 'exec' && 'command' in event ? [event.command] : []))
const forgeCalls = (events: Event[]) => events.filter((event) => event.port === 'forge')
const indexOf = (events: Event[], match: (event: Event) => boolean) => {
  const index = events.findIndex(match)
  expect(index).toBeGreaterThanOrEqual(0)
  return index
}
type ForgeEvent = Extract<Event, { port: 'forge' }>
const forgeEvent = (events: Event[], method: string) =>
  events.find((event): event is ForgeEvent => event.port === 'forge' && event.method === method)
const isForge = (method: string) => (event: Event) =>
  event.port === 'forge' && event.method === method
const isExec = (pattern: RegExp) => (event: Event) =>
  event.method === 'exec' && 'command' in event && pattern.test(event.command)

/** A passing review whose first row runs `command` as its test. */
function withTestCommand(command: string): string {
  const json = JSON.parse(/<review>(.*)<\/review>/s.exec(review())?.[1] ?? '{}')
  json.criteria[0].testCommand = command
  return `<review>${JSON.stringify(json)}</review>`
}

describe('pnpm factory --only', () => {
  test('works only that ticket, to a merged PR, and the Run ends after it', async () => {
    const result = await workDev2()
    expect(result.code).toBe(0)
    expect(result.trackerCalls.filter((call) => call.includes('DEV-1'))).toEqual([])
    expect(result.events.filter((event) => event.port === 'sandboxes')).toHaveLength(1)
    expect(result.output).toContain(`Run ${RUN_ID} done: DEV-2 merged`)
  })

  test('prints one line per finished step, with the ticket title and the result', async () => {
    const result = await workDev2()
    for (const step of [
      'claim: In Progress',
      'worktree and install: ',
      'Implementer: finished, 1 commit',
      'host checks: all passed',
      'Reviewer: pass',
      'replay: 2 of 2 confirmed',
      'push gate: passed',
      'push, PR and auto-merge: https://',
      'close sandbox: closed',
      'wait for checks: merged',
    ]) {
      expect(
        result.lines.filter((line) => line.startsWith(`DEV-2 Ticket DEV-2 · ${step}`)),
      ).toHaveLength(1)
    }
  })

  test('claims the ticket, In Progress with a comment, before any sandbox exists', async () => {
    const { events } = await workDev2()
    const claim = indexOf(
      events,
      (event) => event.port === 'tracker' && event.method === 'setStatus',
    )
    expect(events[claim]).toMatchObject({ args: ['DEV-2', 'In Progress'] })
    expect(events[claim + 1]).toMatchObject({
      port: 'tracker',
      method: 'comment',
      args: ['DEV-2', `🏭 Factory: Claimed by factory Run \`${RUN_ID}\`.`],
    })
    expect(claim + 1).toBeLessThan(indexOf(events, (event) => event.port === 'sandboxes'))
  })

  test('moves the ticket to In Review once the PR is open, and never to Done', async () => {
    const { events, trackerCalls } = await workDev2()
    const statuses = trackerCalls.filter((call) => call.startsWith('setStatus'))
    expect(statuses).toEqual(['setStatus DEV-2 In Progress', 'setStatus DEV-2 In Review'])
    const inReview = indexOf(
      events,
      (event) => event.port === 'tracker' && event.args[1] === 'In Review',
    )
    expect(inReview).toBeGreaterThan(indexOf(events, isForge('openPr')))
  })

  test('starts every comment it writes with "🏭 Factory"', async () => {
    const { events } = await workDev2()
    const comments = events.flatMap((event) =>
      (event.port === 'tracker' && event.method === 'comment') ||
      (event.port === 'forge' && event.method === 'commentOnPr')
        ? [String(event.args[1])]
        : [],
    )
    expect(comments.length).toBeGreaterThanOrEqual(2)
    for (const comment of comments) expect(comment.startsWith('🏭 Factory')).toBe(true)
  })

  test('closes the ticket only through "Closes DEV-2" in the PR body', async () => {
    const { events } = await workDev2()
    const open = forgeEvent(events, 'openPr')
    const body = (open?.args[0] as { body: string }).body
    expect(body).toContain('Closes DEV-2')
    const closing = [
      ...body.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+([A-Z]+-\d+)/gi),
    ]
    expect(closing.map((match) => match[1])).toEqual(['DEV-2'])
  })

  test("makes one sandbox on the ticket's branch off origin/main, installed with a store outside the worktree", async () => {
    const { events } = await workDev2()
    const created = events.filter((event) => event.port === 'sandboxes')
    expect(created).toEqual([
      expect.objectContaining({
        options: expect.objectContaining({ branch: TICKET.branch, base: 'origin/main' }),
      }),
    ])
    const install = execs(events).find((command) => command.includes('pnpm install'))
    const store = /--store-dir (\S+)/.exec(install ?? '')?.[1]
    expect(store).toBeTruthy()
    expect(store?.startsWith(WORKTREE)).toBe(false)
    expect(store?.startsWith('/')).toBe(true)
  })

  test('gives the Implementer the ticket, the full criteria it covers, the packages and the rules', async () => {
    const { events } = await workDev2()
    const implementer = agentSteps(events).find((step) => step.name === 'implementer')
    expect(implementer).toMatchObject({ model: 'claude-sonnet-5-5', effort: 'medium' })
    const prompt = implementer?.prompt ?? ''
    expect(prompt).toContain(TICKET.description)
    expect(prompt).toContain(`AC-1.1 (tested): ${CRITERIA['AC-1.1']}`)
    expect(prompt).toContain(`AC-1.2 (tested): ${CRITERIA['AC-1.2']}`)
    expect(prompt).not.toContain('AC-2.1')
    expect(prompt).toContain('- @myvgc/api depends on @myvgc/core')
    expect(prompt).toContain("Don't run the full `pnpm test`")
    expect(prompt).toContain('/home/agent/factory/mapping.md')
  })

  test('runs the full checks as host commands and saves their logs to the run log', async () => {
    const result = await workDev2({ checks: {} })
    const commands = execs(result.events)
    for (const check of ['test', 'typecheck', 'lint', 'format:check']) {
      expect(commands).toContain(`pnpm ${check}`)
      const log = join(
        result.repoDir,
        '.factory',
        'runs',
        RUN_ID,
        'DEV-2',
        'checks',
        `${check.replace(':', '-')}.log`,
      )
      expect(existsSync(log)).toBe(true)
      expect(readFileSync(log, 'utf8')).toContain(`pnpm ${check} output`)
    }
    const implementer = indexOf(result.events, (event) => event.method === 'runAgent')
    expect(indexOf(result.events, isExec(/^pnpm test$/))).toBeGreaterThan(implementer)
  })

  test('runs a fresh Reviewer, told the host check results, after the checks', async () => {
    const { events } = await workDev2({ checks: { lint: 0 } })
    const steps = agentSteps(events)
    expect(steps.map((step) => step.name)).toEqual(['implementer', 'reviewer'])
    const reviewer = steps[1]
    expect(reviewer).toMatchObject({ model: 'claude-opus-5-5', effort: 'high' })
    for (const text of [
      '- pnpm test: passed',
      '- pnpm format:check: passed',
      TICKET.description,
      `AC-1.1 (tested): ${CRITERIA['AC-1.1']}`,
      'Do the sabotage and verdict work yourself. Use subagents (Haiku 5.5) only to find code.',
    ]) {
      expect(reviewer?.prompt).toContain(text)
    }
    const reviewerAt = events.findIndex(
      (event) => event.method === 'runAgent' && 'step' in event && event.step.name === 'reviewer',
    )
    expect(reviewerAt).toBeGreaterThan(indexOf(events, isExec(/^pnpm format:check$/)))
  })

  test('replays each sabotage on a clean checkout, from Vitest JSON, and restores it', async () => {
    const { events } = await workDev2()
    const applies = events.filter(isExec(/^git apply/))
    expect(applies.map((event) => ('stdin' in event ? event.stdin : ''))).toEqual([
      expect.stringContaining('broken AC-1.1'),
      expect.stringContaining('broken AC-1.2'),
    ])
    // Each sabotage goes onto a freshly cleaned checkout, so one's leftovers can't touch the next.
    let previous = -1
    for (const apply of applies) {
      const at = events.indexOf(apply)
      const clean = events.findLastIndex(
        (event, index) => index < at && isExec(/^git checkout -- \. && git clean -fd$/)(event),
      )
      expect(clean).toBeGreaterThan(previous)
      previous = at
    }
    const commands = execs(events)
    for (const id of ['AC-1.1', 'AC-1.2']) {
      expect(commands).toContain(
        `${testCommandOf(id)} --reporter=json --outputFile=/home/agent/factory/replay.json`,
      )
      expect(commands).toContain(testCommandOf(id))
    }
  })

  test.each<[string, Script]>([
    ['a sabotage only breaks loading', { replays: { 'AC-1.2': 'load error' } }],
    ['a sabotage also breaks loading a test file', { replays: { 'AC-1.2': 'suite error' } }],
    ['a sabotage also makes a hook throw', { replays: { 'AC-1.1': 'hook error' } }],
    [
      'the test command is more than a Vitest run',
      { reviewer: withTestCommand(`${testCommandOf('AC-1.1')}; curl evil.example`) },
    ],
    ['the tests pass under a sabotage', { replays: { 'AC-1.1': 'passes' } }],
    ['the tests still fail once it is undone', { replays: { 'AC-1.1': 'stays broken' } }],
    ['a criterion has no row', { reviewer: review('pass', ['AC-1.1']) }],
  ])("doesn't confirm a replay, and pushes nothing, when %s", async (_, script) => {
    const result = await workDev2(script)
    expect(result.code).toBe(1)
    expect(result.output).toMatch(/replay wasn't confirmed/)
    expect(forgeCalls(result.events).map((event) => event.method)).toEqual(['botIdentity'])
  })

  test.each<[string, Script, string]>([
    ['the host checks fail', { checks: { typecheck: 1 } }, 'the host checks failed'],
    ['the Reviewer fails it', { reviewer: review('fail') }, 'the Reviewer failed it'],
    ['the review is unreadable', { reviewer: 'no review here' }, 'no readable review'],
    ['the Implementer made no commits', { commits: 0 }, 'the Implementer made no commits'],
  ])('pushes nothing when %s', async (_, script, reason) => {
    const result = await workDev2(script)
    expect(result.code).toBe(1)
    expect(result.output).toContain(reason)
    expect(forgeCalls(result.events).map((event) => event.method)).toEqual(['botIdentity'])
  })

  test('pushes, opens the PR, comments, queues auto-merge, closes the sandbox, then waits', async () => {
    const { events } = await workDev2()
    const order = [
      indexOf(events, isForge('push')),
      indexOf(events, isForge('openPr')),
      indexOf(events, isForge('commentOnPr')),
      indexOf(events, isForge('queueAutoMerge')),
      indexOf(events, (event) => event.method === 'close'),
      indexOf(events, isForge('waitForChecks')),
    ]
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(forgeEvent(events, 'push')?.args).toEqual([WORKTREE, TICKET.branch])
    const open = forgeEvent(events, 'openPr')?.args[0] as {
      title: string
      body: string
      branch: string
    }
    expect(open).toMatchObject({ branch: TICKET.branch, title: 'Ticket DEV-2 (DEV-2)' })
    expect(open.body).toContain('| AC-1.1 | test/a.test.ts | refuses |')
    const comment = String(forgeEvent(events, 'commentOnPr')?.args[1])
    expect(comment).toContain('| AC-1.1 | test/AC-1.1.test.ts › AC-1.1 | confirmed |')
  })

  test('has commits authored by the bot, set for the sandbox, ending with Co-Authored-By', async () => {
    const { events } = await workDev2()
    const created = events.find((event) => event.port === 'sandboxes')
    expect(created && 'options' in created ? created.options.author : null).toEqual({
      name: 'myvgc-factory[bot]',
      email: '999+myvgc-factory[bot]@users.noreply.github.com',
    })
    // Never `git config`: in a worktree it writes the config the maintainer's checkout shares.
    expect(execs(events).filter((command) => command.includes('git config'))).toEqual([])
    const implementer = agentSteps(events)[0]
    expect(implementer?.prompt).toContain(
      'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>',
    )
  })

  test('waits again while the checks are pending or gh errs', async () => {
    const result = await workDev2({ waits: [2, 3, 2, 0] })
    expect(result.code).toBe(0)
    expect(
      forgeCalls(result.events).filter((event) => event.method === 'waitForChecks'),
    ).toHaveLength(4)
  })

  test.each([
    [{ CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat-x' }],
    [{ ANTHROPIC_API_KEY: 'sk-ant-api-x', CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat-x' }],
  ])('gives the sandbox only the Claude credential (%j)', async (sandcastleEnv) => {
    const { events } = await workDev2({}, { sandcastleEnv })
    const created = events.find((event) => event.port === 'sandboxes')
    const env = created && 'options' in created ? created.options.env : {}
    expect(Object.keys(env)).toHaveLength(1)
    expect(['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY']).toContain(Object.keys(env)[0])
    if ('ANTHROPIC_API_KEY' in sandcastleEnv)
      expect(env).toEqual({ ANTHROPIC_API_KEY: 'sk-ant-api-x' })
    for (const value of Object.values(env)) expect(value).not.toMatch(/PRIVATE KEY|ghs_|lin_api/)
  })

  test('refuses, before claiming anything, a ticket covering a criterion the spec lacks', async () => {
    const odd = ticket('DEV-2', { description: '**Covers:** AC-1.1, AC-9.9' })
    const result = await run([SPEC, '--only', 'DEV-2'], [signedOff], { tickets: [odd] })
    expect(result.code).toBe(1)
    expect(result.output).toContain(`covers AC-9.9, which ${SPEC} doesn't have`)
    expect(result.trackerCalls).toEqual([`getIssue ${SPEC}`, `getSubIssues ${SPEC}`])
    expect(result.events.filter((event) => event.port !== 'tracker')).toEqual([])
  })

  test("asks GitHub for the bot, minting the App's token, before claiming anything", async () => {
    const { events } = await workDev2()
    const bot = indexOf(events, isForge('botIdentity'))
    expect(bot).toBeLessThan(
      indexOf(events, (event) => event.port === 'tracker' && event.method === 'setStatus'),
    )
  })

  test('saves the host check results beside their logs', async () => {
    const result = await workDev2({ checks: { lint: 1 } })
    const results = join(
      result.repoDir,
      '.factory',
      'runs',
      RUN_ID,
      'DEV-2',
      'checks',
      'results.md',
    )
    expect(existsSync(results)).toBe(true)
    expect(readFileSync(results, 'utf8')).toContain('- pnpm lint: failed')
    expect(readFileSync(results, 'utf8')).toContain('- pnpm test: passed')
  })

  test('turns closing keywords in the mapping table into "Related to"', async () => {
    const { events } = await workDev2({
      mapping: '| AC-1.1 | a.test.ts | fixes DEV-5 and Closes DEV-6 |',
    })
    const body = (forgeEvent(events, 'openPr')?.args[0] as { body: string }).body
    const closing = [
      ...body.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+([A-Z]+-\d+)/gi),
    ]
    expect(closing.map((match) => match[1])).toEqual(['DEV-2'])
    expect(body).toContain('Related to DEV-5')
  })
})

// Tests fix rounds: when the push gate fails, the Implementer's own session is resumed on rising
// models before the ticket parks, and per-Run flags override a step's model. Through
// `pnpm factory <spec> --only DEV-M` with fake ports (test/harness.ts).
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import type { AgentStep } from '../src/ports.ts'
import {
  type Event,
  listed,
  review,
  RUN_ID,
  run,
  type Script,
  SPEC,
  signedOff,
  ticket,
} from './harness.ts'

const TICKET = ticket('DEV-2')

function workDev2(script: Script = {}, flags: string[] = []) {
  return run([SPEC, '--only', 'DEV-2', ...flags], [signedOff], { tickets: [TICKET], script })
}

const agentSteps = (events: Event[]): AgentStep[] =>
  events.flatMap((event) => (event.method === 'runAgent' && 'step' in event ? [event.step] : []))
const stepNamed = (events: Event[], name: string) =>
  agentSteps(events).filter((step) => step.name === name)
const isForge = (method: string) => (event: Event) =>
  event.port === 'forge' && event.method === method
const prsReadyToMerge = (events: Event[]) =>
  events.filter(
    (event) =>
      event.port === 'forge' &&
      event.method === 'openPr' &&
      !(event.args[0] as { draft: boolean }).draft,
  )
const hostTestRuns = (events: Event[]) =>
  events.filter(
    (event) => event.method === 'exec' && 'command' in event && event.command === 'pnpm test',
  )
const parked = (events: Event[]) =>
  events.some(
    (event) =>
      event.port === 'tracker' &&
      event.method === 'setAgentLabel' &&
      event.args[1] === 'needs-human',
  )

const FAILED = review(
  'fail',
  ['AC-1.1', 'AC-1.2'],
  [{ severity: 'hard', file: 'src/a.ts', summary: 'AC-1.2 refuses with the wrong exit code.' }],
)
const PASSED = review()

describe('fix rounds', () => {
  test('give every step its model and explicit effort from the settings table', async () => {
    const { events } = await workDev2({ reviewer: [FAILED, FAILED, PASSED] })
    const steps = agentSteps(events).map(({ name, model, effort }) => ({ name, model, effort }))
    expect(steps).toEqual([
      { name: 'implementer', model: 'claude-sonnet-5-5', effort: 'medium' },
      { name: 'reviewer', model: 'claude-opus-5-5', effort: 'high' },
      { name: 'fix-round-1', model: 'claude-sonnet-5-5', effort: 'high' },
      { name: 'reviewer', model: 'claude-opus-5-5', effort: 'high' },
      { name: 'fix-round-2', model: 'claude-opus-5-5', effort: 'high' },
      { name: 'reviewer', model: 'claude-opus-5-5', effort: 'high' },
    ])
  })

  test("resume the Implementer's own session, round 1 with the failed rows and findings", async () => {
    const result = await workDev2({ reviewer: FAILED, replays: { 'AC-1.2': 'passes' } })
    const [round1] = stepNamed(result.events, 'fix-round-1')
    expect(round1?.resumeSession).toBe('implementer-session')
    for (const text of [
      'the Reviewer failed it',
      "AC-1.2's replay wasn't confirmed",
      '| AC-1.2 | test/AC-1.2.test.ts › AC-1.2 | not confirmed |',
      '- hard, src/a.ts: AC-1.2 refuses with the wrong exit code.',
    ]) {
      expect(round1?.prompt).toContain(text)
    }
  })

  test('stop at round 1 once its work passes the push gate, and merge', async () => {
    const result = await workDev2({ reviewer: [FAILED, PASSED] })
    expect(result.code).toBe(0)
    expect(stepNamed(result.events, 'fix-round-1')).toHaveLength(1)
    expect(stepNamed(result.events, 'fix-round-2')).toEqual([])
  })

  test('resume the same session on Opus for round 2, when round 1 fails too', async () => {
    const { events } = await workDev2({ reviewer: [FAILED, FAILED, PASSED] })
    const [round2] = stepNamed(events, 'fix-round-2')
    expect(round2).toMatchObject({
      model: 'claude-opus-5-5',
      effort: 'high',
      resumeSession: 'implementer-session',
    })
  })

  test('go back to the host checks after each round', async () => {
    const { events } = await workDev2({ reviewer: [FAILED, FAILED, PASSED] })
    expect(hostTestRuns(events)).toHaveLength(3)
    const round1 = events.findIndex(
      (event) =>
        event.method === 'runAgent' && 'step' in event && event.step.name === 'fix-round-1',
    )
    const testsAfter = events.findIndex(
      (event, index) => index > round1 && hostTestRuns([event]).length === 1,
    )
    const reviewerAfter = events.findIndex(
      (event, index) =>
        index > round1 &&
        event.method === 'runAgent' &&
        'step' in event &&
        event.step.name === 'reviewer',
    )
    expect(testsAfter).toBeGreaterThan(round1)
    expect(reviewerAfter).toBeGreaterThan(testsAfter)
  })

  test.each<[string, Script]>([
    ['the host checks fail', { checks: { lint: 1 }, reviewer: PASSED }],
    ['the Reviewer fails it', { reviewer: FAILED }],
    ['a sabotage only breaks loading', { replays: { 'AC-1.1': 'load error' } }],
    ['the tests pass under a sabotage', { replays: { 'AC-1.1': 'passes' } }],
    ['the tests still fail once a sabotage is undone', { replays: { 'AC-1.1': 'stays broken' } }],
  ])('start when %s, and push nothing to merge', async (_, script) => {
    const result = await workDev2(script)
    expect(stepNamed(result.events, 'fix-round-1')).toHaveLength(1)
    expect(prsReadyToMerge(result.events)).toEqual([])
    expect(result.events.filter(isForge('queueAutoMerge'))).toEqual([])
  })

  test('park the ticket when round 2 fails the push gate too', async () => {
    const result = await workDev2({ reviewer: FAILED })
    expect(result.code).toBe(1)
    expect(stepNamed(result.events, 'fix-round-1')).toHaveLength(1)
    expect(stepNamed(result.events, 'fix-round-2')).toHaveLength(1)
    expect(stepNamed(result.events, 'fix-round-3')).toEqual([])
    expect(parked(result.events)).toBe(true)
    expect(result.output).toContain('after 2 fix rounds')
    expect(result.output).toContain(`Run ${RUN_ID} done: 0 merged, 1 parked`)
    expect(result.output).toContain('- DEV-2 Ticket DEV-2: parked')
  })

  test('park the ticket on a park signal from a fix round', async () => {
    const result = await workDev2({
      reviewer: FAILED,
      fixRounds: ['<park>AC-1.2 needs a decision from the maintainer.</park>'],
    })
    expect(parked(result.events)).toBe(true)
    expect(stepNamed(result.events, 'fix-round-2')).toEqual([])
    expect(result.output).toContain('AC-1.2 needs a decision from the maintainer.')
  })
})

describe('fix rounds, more closely', () => {
  test('push nothing before round 1 starts', async () => {
    const { events } = await workDev2({ reviewer: [FAILED, PASSED] })
    const round1 = events.findIndex(
      (event) =>
        event.method === 'runAgent' && 'step' in event && event.step.name === 'fix-round-1',
    )
    expect(round1).toBeGreaterThan(0)
    expect(events.slice(0, round1).filter(isForge('push'))).toEqual([])
  })

  test('tell round 2 what failed after round 1', async () => {
    const result = await workDev2({ reviewer: [FAILED, FAILED, PASSED] })
    const [round2] = stepNamed(result.events, 'fix-round-2')
    expect(round2?.prompt).toContain('Fix round 2 of 2.')
    expect(round2?.prompt).toContain('- hard, src/a.ts: AC-1.2 refuses with the wrong exit code.')
    expect(round2?.prompt).toContain('| AC-1.1 | test/AC-1.1.test.ts › AC-1.1 | confirmed |')
  })

  test("keep each round's host check logs", async () => {
    const result = await workDev2({ reviewer: [FAILED, FAILED, PASSED] })
    const ticketLog = join(result.repoDir, '.factory', 'runs', RUN_ID, 'DEV-2')
    for (const folder of ['', 'fix-round-1', 'fix-round-2']) {
      expect(existsSync(join(ticketLog, folder, 'checks', 'results.md'))).toBe(true)
    }
  })

  test('start a round afresh, told the ticket, when no session was captured', async () => {
    const { events } = await workDev2({ reviewer: [FAILED, PASSED], noSession: true })
    const [round1] = stepNamed(events, 'fix-round-1')
    expect(round1?.resumeSession).toBeUndefined()
    expect(round1?.prompt).toContain(TICKET.description)
    expect(round1?.prompt).toContain('Fix round 1 of 2.')
  })

  test('report the last review when a fix round parks the ticket', async () => {
    const result = await workDev2({
      reviewer: FAILED,
      fixRounds: ['<park>AC-1.2 needs a decision from the maintainer.</park>'],
    })
    const comments = result.events.flatMap((event) =>
      event.port === 'tracker' && event.method === 'comment' ? [String(event.args[1])] : [],
    )
    const park = comments.at(-1) ?? ''
    expect(park).toContain('fix round 1 parked it')
    expect(park).toContain('Last verdict: **fail**')
  })
})

describe('an unreadable review', () => {
  test('runs one more fresh Reviewer, and goes on when that one is readable', async () => {
    const result = await workDev2({ reviewer: ['no review here', PASSED] })
    expect(result.code).toBe(0)
    const reviewers = stepNamed(result.events, 'reviewer')
    expect(reviewers).toHaveLength(2)
    expect(reviewers.map((step) => step.resumeSession)).toEqual([undefined, undefined])
    expect(stepNamed(result.events, 'fix-round-1')).toEqual([])
  })

  test('parks the ticket when the second one is unreadable too', async () => {
    const result = await workDev2({ reviewer: ['no review here', 'still none'] })
    expect(result.code).toBe(1)
    expect(stepNamed(result.events, 'reviewer')).toHaveLength(2)
    expect(stepNamed(result.events, 'fix-round-1')).toEqual([])
    expect(parked(result.events)).toBe(true)
  })
})

describe('per-Run model flags', () => {
  test('--implementer opus-5-5 changes only the Implementer', async () => {
    const { events } = await workDev2({ reviewer: [FAILED, PASSED] }, ['--implementer', 'opus-5-5'])
    expect(stepNamed(events, 'implementer')[0]).toMatchObject({
      model: 'claude-opus-5-5',
      effort: 'medium',
    })
    expect(stepNamed(events, 'fix-round-1')[0]).toMatchObject({
      model: 'claude-sonnet-5-5',
      effort: 'high',
    })
    expect(stepNamed(events, 'reviewer')[0]).toMatchObject({
      model: 'claude-opus-5-5',
      effort: 'high',
    })
    expect(stepNamed(events, 'implementer')[0]?.prompt).toContain(
      'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>',
    )
  })

  test.each([
    ['--reviewer', 'reviewer', 'claude-sonnet-5-5'],
    ['--fix-round-1', 'fix-round-1', 'claude-opus-5-5'],
    ['--fix-round-2', 'fix-round-2', 'claude-sonnet-5-5'],
  ])('%s overrides its own step', async (flag, step, model) => {
    const { events } = await workDev2({ reviewer: [FAILED, FAILED, PASSED] }, [flag, model])
    expect(stepNamed(events, step)[0]?.model).toBe(model)
    expect(stepNamed(events, 'implementer')[0]?.model).toBe('claude-sonnet-5-5')
  })

  test('--dry-run plans with the overrides', async () => {
    const result = await run([SPEC, '--dry-run', '--implementer', 'opus-5-5'], [signedOff], {
      tickets: [TICKET],
    })
    expect(listed(result.output)).toEqual(['DEV-2'])
    expect(result.output).toContain('Implementer (claude-opus-5-5, medium)')
  })

  test.each([
    ['--implementer', 'gpt-4'],
    ['--reviewer', '--dry-run'],
  ])('refuses %s %s with the usage', async (flag, model) => {
    const result = await run([SPEC, '--only', 'DEV-2', flag, model], [signedOff], {
      tickets: [TICKET],
    })
    expect(result.code).toBe(64)
    expect(result.output).toContain('Usage: pnpm factory')
  })
})

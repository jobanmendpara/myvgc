// Tests what a Run survives: sessions kept in the Run's folder, the usage limit waited out, an agent
// the idle timeout killed, the host dying, and the installation token expiring. Through
// `pnpm factory <spec> --only DEV-M` with fake ports and a fake clock (test/harness.ts).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import type { AgentStep } from '../src/ports.ts'
import type { PauseRecord } from '../src/runlog.ts'
import {
  type Event,
  IN_PROGRESS,
  NOW,
  review,
  RUN_ID,
  run,
  type Script,
  SPEC,
  signedOff,
  ticket,
} from './harness.ts'

const TICKET = ticket('DEV-2')
/** The ticket as Linear shows it once a Run has claimed it. */
const CLAIMED = { ...TICKET, status: IN_PROGRESS }

function workDev2(script: Script = {}) {
  return run([SPEC, '--only', 'DEV-2'], [signedOff], { tickets: [TICKET], script })
}

type AgentRun = Extract<Event, { method: 'runAgent' }>
const agentRuns = (events: Event[]): AgentRun[] =>
  events.filter((event): event is AgentRun => event.method === 'runAgent')
const agentSteps = (events: Event[]): AgentStep[] => agentRuns(events).map((event) => event.step)
const stepNames = (events: Event[]) => agentSteps(events).map((step) => step.name)
const execs = (events: Event[]) =>
  events.flatMap((event) => (event.method === 'exec' && 'command' in event ? [event] : []))
const commands = (events: Event[]) => execs(events).map((event) => event.command)
type Called = Extract<Event, { port: 'tracker' | 'forge' }>
const calls = (events: Event[], port: 'tracker' | 'forge', method: string) =>
  events.filter((event): event is Called => event.port === port && event.method === method)
const linearComments = (events: Event[]) =>
  calls(events, 'tracker', 'comment').map((event) => String(event.args[1]))
const claimComments = (events: Event[]) =>
  linearComments(events).filter((body) => body.includes('Claimed by factory Run'))
const sleeps = (events: Event[]) =>
  events.flatMap((event) => (event.port === 'clock' ? [event] : []))
const runJson = (runDir: string) => JSON.parse(readFileSync(join(runDir, 'run.json'), 'utf8'))
const merged = (result: { code: number | null; output: string }) =>
  result.code === 0 && result.output.includes('wait for checks: merged')

const FAILED = review('fail')
const PASSED = review()
const MINUTE = 60_000

/** A 429 as Claude Code reports it on the subscription, with the reset time in Unix seconds. */
const RESET = new Date(NOW.getTime() + 2 * 60 * MINUTE)
const LIMITED = `claude exited with code 1:\nClaude AI usage limit reached|${RESET.getTime() / 1000}`
const limit = (message = LIMITED) => ({ kind: 'error' as const, message })

describe("each agent's Claude session", () => {
  test("is mounted from the Run's folder, in every sandbox the ticket gets", async () => {
    // CI fails once, so the fix round gets a sandbox of its own.
    const result = await workDev2({ waits: [1, 0] })
    const made = result.events.flatMap((event) =>
      event.port === 'sandboxes' ? [event.options.sessions] : [],
    )
    expect(made).toEqual([
      join(result.runDir, 'DEV-2', 'sessions'),
      join(result.runDir, 'DEV-2', 'sessions'),
    ])
  })

  test("is the Implementer's in every fix round, even after it continued past a usage limit", async () => {
    const result = await workDev2({
      reviewer: [FAILED, FAILED, PASSED],
      stops: { implementer: [limit()] },
    })
    const steps = agentSteps(result.events)
    expect(
      steps.filter((step) => step.name.startsWith('fix-round-')).map((step) => step.resumeSession),
    ).toEqual(['implementer-session', 'implementer-session'])
  })

  test.each([
    { diesAt: 'the fix round', crashAt: 'fix-round-1' },
    { diesAt: 'the host checks', crashAt: 'pnpm test' },
  ])(
    "is the Implementer's in a fix round after the host died in $diesAt, read back from run.json",
    async ({ crashAt }) => {
      const first = await workDev2({ reviewer: FAILED, crashAt })
      expect(first.crashed).toBe(true)
      const second = await first.again({
        tickets: [CLAIMED],
        script: { reviewer: [FAILED, PASSED] },
      })
      const [round1] = agentSteps(second.events).filter((step) => step.name === 'fix-round-1')
      expect(round1?.resumeSession).toBe('implementer-session')
      expect(stepNames(second.events)).not.toContain('implementer')
    },
  )
})

describe('a usage limit', () => {
  test("starts no agent step until the reset time the 429 gives, then continues the step's session", async () => {
    const result = await workDev2({ stops: { implementer: [limit()] } })
    const runs = agentRuns(result.events)
    expect(runs.map((event) => event.step.name)).toEqual(['implementer', 'implementer', 'reviewer'])
    const [stopped, continued] = runs
    expect(continued?.at.getTime()).toBeGreaterThanOrEqual(RESET.getTime())
    expect(continued?.step.prompt).toBe('continue')
    expect(continued?.step.resumeSession).toBe('implementer-session')
    // It waited, not failed: the time between is spent asleep.
    expect(stopped && continued && continued.at.getTime() - stopped.at.getTime()).toBeGreaterThan(
      110 * MINUTE,
    )
    expect(merged(result)).toBe(true)
  })

  test('holds back a Reviewer the same way, which then answers in its own session', async () => {
    const result = await workDev2({ stops: { reviewer: [limit()] } })
    const reviewers = agentRuns(result.events).filter((event) => event.step.name === 'reviewer')
    expect(reviewers).toHaveLength(2)
    expect(reviewers[1]?.at.getTime()).toBeGreaterThanOrEqual(RESET.getTime())
    expect(reviewers[1]?.step).toMatchObject({
      prompt: 'continue',
      resumeSession: 'reviewer-session',
    })
    expect(merged(result)).toBe(true)
  })

  test('reads an ISO 8601 reset time too', async () => {
    // Three hours on, written in UTC, whatever zone the host is in.
    const at = new Date(NOW.getTime() + 3 * 60 * MINUTE).toISOString().replace('.000Z', 'Z')
    const result = await workDev2({
      stops: { implementer: [limit(`Rate limited (429): resets at ${at}`)] },
    })
    expect(stepNames(result.events)).toEqual(['implementer', 'implementer', 'reviewer'])
    const continued = agentRuns(result.events)[1]?.at.getTime() ?? 0
    expect(continued).toBeGreaterThanOrEqual(Date.parse(at))
    expect(continued).toBeLessThan(Date.parse(at) + MINUTE)
  })

  test('reads a reset time given as a time of day in a time zone', async () => {
    const result = await workDev2({
      stops: { implementer: [limit("You've hit your limit · resets 11pm (Asia/Tokyo)")] },
    })
    expect(stepNames(result.events)).toEqual(['implementer', 'implementer', 'reviewer'])
    const [stopped, continued] = agentRuns(result.events)
    const wall = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
    })
    expect(continued && wall.format(continued.at)).toBe('23:00')
    expect(stopped && continued && continued.at.getTime() - stopped.at.getTime()).toBeLessThan(
      24 * 60 * MINUTE,
    )
  })

  test('checks again every 15 minutes when the 429 gives no reset time', async () => {
    const untimed = limit('claude reported an error:\nAPI Error: 429 rate_limit_error')
    const result = await workDev2({ stops: { implementer: [untimed, untimed] } })
    const runs = agentRuns(result.events).filter((event) => event.step.name === 'implementer')
    expect(runs).toHaveLength(3)
    const gaps = runs
      .slice(1)
      .map((event, index) => event.at.getTime() - (runs[index]?.at.getTime() ?? 0))
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(15 * MINUTE)
      expect(gap).toBeLessThan(16 * MINUTE)
    }
    expect(runs.slice(1).every((event) => event.step.prompt === 'continue')).toBe(true)
  })

  test('is logged in run.json as a pause', async () => {
    const untimed = 'API Error: 429 rate_limit_error'
    const result = await workDev2({ stops: { implementer: [limit(), limit(untimed)] } })
    const pauses: PauseRecord[] = runJson(result.runDir).pauses
    expect(pauses).toEqual([
      expect.objectContaining({
        ticket: 'DEV-2',
        step: 'implementer',
        until: RESET.toISOString(),
        resetGiven: true,
        message: LIMITED,
      }),
      expect.objectContaining({
        ticket: 'DEV-2',
        step: 'implementer',
        resetGiven: false,
        message: untimed,
      }),
    ])
    const [timed, other] = pauses
    expect(timed && Date.parse(timed.at)).toBeLessThan(RESET.getTime())
    expect(other && Date.parse(other.until) - Date.parse(other.at)).toBe(15 * MINUTE)
  })

  test("doesn't interrupt the maintainer: no comment, no label, no @mention, and the Run goes on", async () => {
    const result = await workDev2({ stops: { implementer: [limit(), limit()] } })
    expect(merged(result)).toBe(true)
    expect(linearComments(result.events)).toEqual([
      expect.stringContaining('Claimed by factory Run'),
    ])
    expect(calls(result.events, 'tracker', 'setAgentLabel')).toEqual([])
    const prComments = calls(result.events, 'forge', 'commentOnPr').map((event) =>
      String(event.args[1]),
    )
    expect(prComments.some((body) => body.includes('@'))).toBe(false)
    expect(sleeps(result.events).length).toBeGreaterThan(0)
  })

  test("sends no notification: the Run's end is the only one, as with no pause", async () => {
    const paused = await workDev2({ stops: { implementer: [limit(), limit()] } })
    const unpaused = await workDev2()
    expect(unpaused.notifications).toEqual([
      expect.objectContaining({ text: expect.stringMatching(/^🏭 Run \S+ done: 1 merged/) }),
    ])
    // Each Run has its own temporary checkout, so the run-log link differs by that alone.
    const told = ({ notifications, repoDir }: typeof paused) =>
      notifications.map(({ text, link }) => ({ text, link: link?.replace(repoDir, '<repo>') }))
    expect(told(paused)).toEqual(told(unpaused))
  })

  test('that is any other agent error stops the ticket instead of waiting', async () => {
    const result = await workDev2({
      stops: { implementer: [limit('claude exited with code 1:\nInvalid model')] },
    })
    expect(result.code).toBeNull()
    expect(String(result.thrown)).toContain('Invalid model')
    expect(sleeps(result.events)).toEqual([])
  })
})

describe('an agent the idle timeout killed', () => {
  test('has its work committed by the host, which carries on to the host checks', async () => {
    const result = await workDev2({ stops: { implementer: [{ kind: 'idle timeout' }] } })
    const all = execs(result.events)
    const commit = all.findIndex(
      (event) => event.command === 'git add -A && git commit --no-verify -F -',
    )
    const hostTest = all.findIndex((event) => event.command === 'pnpm test')
    expect(commit).toBeGreaterThan(-1)
    expect(commit).toBeLessThan(hostTest)
    const message = all[commit]?.stdin ?? ''
    expect(message).toContain('DEV-2')
    expect(message).toMatch(/Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\n$/)
    expect(stepNames(result.events)).toEqual(['implementer', 'reviewer'])
    expect(merged(result)).toBe(true)
  })

  test('in a fix round is committed the same way, and the fix round goes back to the host checks', async () => {
    const result = await workDev2({
      reviewer: [FAILED, PASSED],
      stops: { 'fix-round-1': [{ kind: 'idle timeout' }] },
    })
    const all = commands(result.events)
    const fixRound = result.events.findIndex(
      (event) =>
        event.method === 'runAgent' && 'step' in event && event.step.name === 'fix-round-1',
    )
    const after = execs(result.events.slice(fixRound)).map((event) => event.command)
    expect(after.indexOf('git add -A && git commit --no-verify -F -')).toBeGreaterThan(-1)
    expect(after.indexOf('git add -A && git commit --no-verify -F -')).toBeLessThan(
      after.indexOf('pnpm test'),
    )
    expect(all.filter((command) => command === 'pnpm test')).toHaveLength(2)
    expect(merged(result)).toBe(true)
  })
})

describe('after the host died', () => {
  test('the same command adopts the ticket the dead Run claimed, with no second claim', async () => {
    const first = await workDev2({ crashAt: 'pnpm test' })
    expect(first.crashed).toBe(true)
    const second = await first.again({ tickets: [CLAIMED] })
    expect(merged(second)).toBe(true)
    expect(claimComments([...first.events, ...second.events])).toHaveLength(1)
    expect(
      calls(second.events, 'tracker', 'setStatus').map((event) => event.args[1]),
    ).not.toContain('In Progress')
    // The same Run, taken up again.
    const record = runJson(first.runDir)
    expect(record.runId).toBe(RUN_ID)
    expect(record.resumedAt).toHaveLength(1)
    expect(record.tickets).toEqual([expect.objectContaining({ id: 'DEV-2', outcome: 'merged' })])
  })

  test.each([
    {
      diesAt: 'the Implementer',
      crashAt: 'implementer',
      steps: ['implementer', 'reviewer'],
      checks: true,
      pushed: true,
    },
    {
      diesAt: 'the host checks after the Implementer',
      crashAt: 'pnpm test',
      steps: ['reviewer'],
      checks: true,
      pushed: true,
    },
    {
      diesAt: 'the replays after the review',
      crashAt: 'git apply --whitespace=nowarn -',
      steps: [],
      checks: false,
      pushed: true,
    },
    {
      diesAt: 'the wait for checks',
      crashAt: 'waitForChecks',
      steps: [],
      checks: false,
      pushed: false,
    },
  ])(
    'resumes from the last finished step when it died in $diesAt',
    async ({ crashAt, steps, checks, pushed }) => {
      const first = await workDev2({ crashAt })
      expect(first.crashed).toBe(true)
      const second = await first.again({ tickets: [CLAIMED] })
      expect(merged(second)).toBe(true)
      expect(stepNames(second.events)).toEqual(steps)
      expect(commands(second.events).includes('pnpm test')).toBe(checks)
      expect(calls(second.events, 'forge', 'push').length > 0).toBe(pushed)
      expect(calls(second.events, 'forge', 'waitForChecks')).toHaveLength(1)
      expect(claimComments(second.events)).toEqual([])
    },
  )

  test('replays the review it had, and fixes on in the same round count', async () => {
    const first = await workDev2({ reviewer: FAILED, crashAt: 'git apply --whitespace=nowarn -' })
    const second = await first.again({ tickets: [CLAIMED], script: { reviewer: [FAILED, PASSED] } })
    // The adopted review failed the gate: fix round 1, then round 2, as if the host never died.
    expect(stepNames(second.events)).toEqual(['fix-round-1', 'reviewer', 'fix-round-2', 'reviewer'])
    expect(merged(second)).toBe(true)
  })

  test('leaves alone the ticket of a Run whose host is still running', async () => {
    const first = await workDev2({ crashAt: 'pnpm test' })
    const second = await first.again({ tickets: [CLAIMED], earlierAlive: true })
    expect(second.code).toBe(1)
    expect(second.output).toContain("DEV-2 isn't takeable")
    expect(second.events.filter((event) => event.port === 'sandboxes')).toEqual([])
  })

  test.each([
    { diesAt: 'after the claim comment', crashAt: 'comment', claimsAgain: false },
    { diesAt: 'before the claim comment', crashAt: 'setStatus', claimsAgain: true },
  ])(
    'makes the claim comment once in all when it died $diesAt',
    async ({ crashAt, claimsAgain }) => {
      const first = await workDev2({ crashAt })
      expect(first.crashed).toBe(true)
      const second = await first.again({ tickets: [CLAIMED] })
      expect(merged(second)).toBe(true)
      expect(claimComments([...first.events, ...second.events])).toHaveLength(1)
      expect(claimComments(second.events)).toHaveLength(claimsAgain ? 1 : 0)
    },
  )

  test('adopts every ticket of the frontier the dead Run had in flight, each from its own step', async () => {
    const dev3 = ticket('DEV-3')
    // Both are in flight when the first host checks start, and the host dies there.
    const first = await run([SPEC], [signedOff], {
      tickets: [TICKET, dev3],
      script: { crashAt: 'pnpm test' },
    })
    expect(first.crashed).toBe(true)
    expect(claimComments(first.events)).toHaveLength(2)
    const second = await first.again({
      tickets: [CLAIMED, { ...dev3, status: IN_PROGRESS }],
    })
    expect(second.code).toBe(0)
    expect(claimComments(second.events)).toEqual([])
    const record = runJson(first.runDir)
    expect(
      record.tickets.map((each: { id: string; outcome: string }) => [each.id, each.outcome]),
    ).toEqual([
      ['DEV-2', 'merged'],
      ['DEV-3', 'merged'],
    ])
    // Both had finished their Implementer, so neither runs it again: each goes on to its review.
    expect(second.output).toContain(
      'adopting DEV-2 Ticket DEV-2, from its last finished step (implemented)',
    )
    expect(second.output).toContain(
      'adopting DEV-3 Ticket DEV-3, from its last finished step (implemented)',
    )
    expect(stepNames(second.events)).toEqual(['reviewer', 'reviewer'])
  })
})

describe('the installation token', () => {
  const tokensUsed = (events: Event[]) =>
    events.flatMap((event) => (event.port === 'forge' && event.token ? [event.token] : []))
  const mints = (events: Event[]) => events.filter((event) => event.port === 'github')

  test('is minted when the Run starts, before it claims anything', async () => {
    const { events } = await workDev2()
    const minted = events.findIndex((event) => event.port === 'github')
    const claimed = events.findIndex(
      (event) => event.port === 'tracker' && event.method === 'setStatus',
    )
    expect(minted).toBeGreaterThan(-1)
    expect(minted).toBeLessThan(claimed)
    expect(new Set(tokensUsed(events))).toEqual(new Set(['token-1000-1']))
  })

  test('is minted again before the next GitHub call once it is within 10 minutes of its expiry', async () => {
    // The Implementer takes 51 minutes: the hour's token has less than 10 minutes left.
    const { events } = await workDev2({ minutes: { implementer: 51 } })
    expect(mints(events)).toHaveLength(2)
    const forge = events.filter((event) => event.port === 'forge')
    expect(forge.map((event) => [event.method, event.token])).toEqual([
      ['botIdentity', undefined],
      ['push', 'token-1000-2'],
      ['openPr', 'token-1000-2'],
      ['commentOnPr', 'token-1000-2'],
      ['queueAutoMerge', 'token-1000-2'],
      ['waitForChecks', 'token-1000-2'],
    ])
  })

  test('is kept while more than 10 minutes are left', async () => {
    const { events } = await workDev2({ minutes: { implementer: 49 } })
    expect(mints(events)).toHaveLength(1)
    expect(new Set(tokensUsed(events))).toEqual(new Set(['token-1000-1']))
  })
})

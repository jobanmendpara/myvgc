// Tests what the factory does after the push, on what scripts/wait-for-checks.sh reports: a fix
// round when CI fails, a rebase when the PR conflicts with main, leaving a PR that waits on
// `approved` with the maintainer, and parking a PR that gets no answer for an hour or keeps
// conflicting. Through `pnpm factory <spec> --only DEV-M` with fake ports
// (test/harness.ts).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import type { AgentStep } from '../src/ports.ts'
import {
  type Event,
  listed,
  PUSHED_HEAD,
  review,
  run,
  RUN_ID,
  type Script,
  SPEC,
  signedOff,
  ticket,
  WORKTREE,
} from './harness.ts'

const TICKET = ticket('DEV-2')
const CI_LOG =
  'check: FAIL packages/core/test/team.test.ts > reads a paste\nAssertionError: expected 3 to be 4'

function workDev2(script: Script = {}) {
  return run([SPEC, '--only', 'DEV-2'], [signedOff], { tickets: [TICKET], script })
}

type Called = Extract<Event, { port: 'tracker' | 'forge' }>
const calls = (events: Event[], port: 'tracker' | 'forge', method: string) =>
  events.filter((event): event is Called => event.port === port && event.method === method)
const indexOf = (events: Event[], found: (event: Event) => boolean, from = 0) =>
  events.findIndex((event, index) => index >= from && found(event))
const isForge = (method: string) => (event: Event) =>
  event.port === 'forge' && event.method === method
const isCreate = (event: Event) => event.port === 'sandboxes'
const isExec = (command: string) => (event: Event) =>
  event.method === 'exec' && 'command' in event && event.command === command
const isInstall = (event: Event) =>
  event.method === 'exec' && 'command' in event && event.command.includes('pnpm install')
const isStep = (name: string) => (event: Event) =>
  event.method === 'runAgent' && 'step' in event && event.step.name === name
const agentSteps = (events: Event[]): AgentStep[] =>
  events.flatMap((event) => (event.method === 'runAgent' && 'step' in event ? [event.step] : []))
const stepNamed = (events: Event[], name: string) =>
  agentSteps(events).filter((step) => step.name === name)
const sandboxesMade = (events: Event[]) =>
  events.flatMap((event) => (event.port === 'sandboxes' ? [event.options] : []))
const statuses = (events: Event[]) => calls(events, 'tracker', 'setStatus').map((e) => e.args[1])
const labels = (events: Event[]) => calls(events, 'tracker', 'setAgentLabel').map((e) => e.args)
const linearComments = (events: Event[]) =>
  calls(events, 'tracker', 'comment').map((event) => String(event.args[1]))
const openedPrs = (events: Event[]) =>
  calls(events, 'forge', 'openPr').map((event) => event.args[0] as { draft: boolean })

const FAILED = review('fail')

/** wait-for-checks.sh's exit code `code`, `count` times over. */
const times = (code: number, count: number) => Array<number>(count).fill(code)
const sleeps = (events: Event[]) =>
  events.flatMap((event) => (event.port === 'clock' ? [event.ms] : []))

describe('when CI fails after the push', () => {
  test("starts a fix round in a new sandbox on the pushed branch, resuming the Implementer's session with the CI log", async () => {
    const result = await workDev2({ waits: [1, 0], ciLog: CI_LOG })
    const { events } = result
    const made = sandboxesMade(events)
    expect(made).toHaveLength(2)
    expect(made[1]?.branch).toBe(TICKET.branch)
    const waited = indexOf(events, isForge('waitForChecks'))
    const second = indexOf(events, isCreate, waited)
    expect(second).toBeGreaterThan(waited)
    // The new sandbox installs before the round runs in it.
    const install = indexOf(events, isInstall, second)
    expect(install).toBeGreaterThan(second)
    expect(indexOf(events, isStep('fix-round-1'))).toBeGreaterThan(install)
    const [round] = stepNamed(events, 'fix-round-1')
    expect(round).toMatchObject({ model: 'claude-sonnet-5-5', effort: 'high' })
    expect(round?.resumeSession).toBe('implementer-session')
    expect(round?.prompt).toContain(CI_LOG)
    expect(result.code).toBe(0)
  })

  test('runs the steps again from the host checks, then pushes to the same PR and waits again', async () => {
    const { events, output } = await workDev2({ waits: [1, 0] })
    const round = indexOf(events, isStep('fix-round-1'))
    const checks = indexOf(events, isExec('pnpm test'), round)
    const reviewer = indexOf(events, isStep('reviewer'), checks)
    const replay = indexOf(events, isExec('git apply --whitespace=nowarn -'), reviewer)
    const push = indexOf(events, isForge('push'), replay)
    const wait = indexOf(events, isForge('waitForChecks'), push)
    expect([checks, reviewer, replay, push, wait].every((at) => at > round)).toBe(true)
    expect([round, checks, reviewer, replay, push, wait]).toEqual(
      [round, checks, reviewer, replay, push, wait].sort((a, b) => a - b),
    )
    expect(calls(events, 'forge', 'push').map((event) => event.args)).toEqual([
      [WORKTREE, TICKET.branch],
      [WORKTREE, TICKET.branch],
    ])
    const waitedOn = calls(events, 'forge', 'waitForChecks').map((event) => event.args[0])
    expect(waitedOn).toEqual([42, 42])
    expect(output).toContain(`Run ${RUN_ID} done: 1 merged, 0 parked`)
    expect(output).toContain('- DEV-2 Ticket DEV-2: merged')
  })

  test('saves the CI log in the run log, beside the round', async () => {
    const result = await workDev2({ waits: [1, 0], ciLog: CI_LOG })
    const saved = join(result.repoDir, '.factory', 'runs', RUN_ID, 'DEV-2', 'fix-round-1', 'ci.log')
    expect(existsSync(saved)).toBe(true)
    expect(readFileSync(saved, 'utf8')).toBe(CI_LOG)
  })

  test('counts towards the two fix rounds: round 2 runs on Opus when CI fails again', async () => {
    const { events } = await workDev2({ reviewer: [FAILED, review(), review()], waits: [1, 0] })
    expect(stepNamed(events, 'fix-round-1')).toHaveLength(1)
    const [round2] = stepNamed(events, 'fix-round-2')
    expect(round2).toMatchObject({ model: 'claude-opus-5-5', resumeSession: 'implementer-session' })
    expect(round2?.prompt).toContain('CI failed')
  })

  test('parks the ticket when CI fails after both fix rounds, turning its PR into a draft', async () => {
    const result = await workDev2({ waits: [1, 1, 1] })
    const { events } = result
    expect(stepNamed(events, 'fix-round-1')).toHaveLength(1)
    expect(stepNamed(events, 'fix-round-2')).toHaveLength(1)
    expect(stepNamed(events, 'fix-round-3')).toEqual([])
    expect(sandboxesMade(events)).toHaveLength(3)
    expect(result.code).toBe(1)
    expect(statuses(events).at(-1)).toBe('Todo')
    expect(labels(events)).toEqual([['DEV-2', 'needs-human']])
    expect(openedPrs(events).at(-1)?.draft).toBe(true)
    expect(linearComments(events).at(-1)).toContain(
      'CI failed, and the ticket has had its 2 fix rounds',
    )
  })
})

describe('when the PR conflicts with main', () => {
  test('rebases the pushed branch onto origin/main, force-pushes it with a lease, and waits again', async () => {
    const result = await workDev2({ waits: [4, 0] })
    const { events } = result
    const conflict = indexOf(events, isForge('waitForChecks'))
    const rebase = indexOf(events, isExec('git rebase origin/main'), conflict)
    expect(rebase).toBeGreaterThan(conflict)
    expect(sandboxesMade(events)[1]?.branch).toBe(TICKET.branch)
    const pushes = calls(events, 'forge', 'push').map((event) => event.args)
    expect(pushes.at(-1)).toEqual([WORKTREE, TICKET.branch, { forceWithLease: PUSHED_HEAD }])
    expect(indexOf(events, isForge('push'), rebase)).toBeGreaterThan(rebase)
    expect(indexOf(events, isForge('waitForChecks'), rebase)).toBeGreaterThan(rebase)
    // A rebase is no fix round: no agent runs again.
    expect(agentSteps(events).map((step) => step.name)).toEqual(['implementer', 'reviewer'])
    expect(result.code).toBe(0)
  })

  test('parks the ticket when the rebase stops on conflicts, pushing nothing', async () => {
    const result = await workDev2({ waits: [4, 0], rebase: 'conflicts' })
    const { events } = result
    const rebase = indexOf(events, isExec('git rebase origin/main'))
    expect(indexOf(events, isExec('git rebase --abort'), rebase)).toBeGreaterThan(rebase)
    expect(indexOf(events, isForge('push'), rebase)).toBe(-1)
    expect(calls(events, 'forge', 'waitForChecks')).toHaveLength(1)
    expect(result.code).toBe(1)
    expect(statuses(events).at(-1)).toBe('Todo')
    expect(labels(events)).toEqual([['DEV-2', 'needs-human']])
    expect(openedPrs(events).at(-1)?.draft).toBe(true)
    expect(linearComments(events).at(-1)).toContain('conflicts with main')
  })
})

describe('when the PR waits on `approved`', () => {
  test('keeps the ticket In Review with `needs-human` and a comment, and moves on', async () => {
    const result = await workDev2({ waits: [5, 0] })
    const { events } = result
    expect(calls(events, 'forge', 'waitForChecks')).toHaveLength(1)
    expect(statuses(events).at(-1)).toBe('In Review')
    expect(labels(events)).toEqual([['DEV-2', 'needs-human']])
    const comment = linearComments(events).at(-1)
    expect(comment).toMatch(/^🏭 Factory: Waiting for approval/)
    expect(comment).toContain('`approved`')
    expect(comment).toContain('https://github.com/o/r/pull/42')
    expect(result.output).toContain(
      `Run ${RUN_ID} done: 0 merged, 0 parked, 1 waiting for approval, $0.00.`,
    )
    expect(result.output).toContain('- DEV-2 Ticket DEV-2: waiting for approval')
    // A hand-off to the maintainer, not a failure.
    expect(result.code).toBe(0)
  })

  test('leaves auto-merge queued: the PR stays ready, and nothing else is pushed', async () => {
    const { events } = await workDev2({ waits: [5, 0] })
    const waited = indexOf(events, isForge('waitForChecks'))
    expect(calls(events, 'forge', 'queueAutoMerge')).toHaveLength(1)
    expect(openedPrs(events).map((pr) => pr.draft)).toEqual([false])
    // Only the comment that @mentions the maintainer (test/notifications.test.ts).
    const after = events.slice(waited + 1).filter((event) => event.port === 'forge')
    expect(after.map((event) => event.method)).toEqual(['commentOnPr'])
  })

  test('keeps the tickets it blocks off the frontier until it merges', async () => {
    const waiting = ticket('DEV-2', {
      status: { name: 'In Review', type: 'started' },
      labels: ['needs-human', 'Chore'],
    })
    const blocked = ticket('DEV-3', { blockedBy: [{ id: 'DEV-2', status: waiting.status }] })
    const before = await run([SPEC, '--dry-run'], [signedOff], { tickets: [waiting, blocked] })
    expect(listed(before.output)).toEqual([])

    const merged = ticket('DEV-3', {
      blockedBy: [{ id: 'DEV-2', status: { name: 'Done', type: 'completed' } }],
    })
    const after = await run([SPEC, '--dry-run'], [signedOff], {
      tickets: [{ ...waiting, status: { name: 'Done', type: 'completed' } }, merged],
    })
    expect(listed(after.output)).toEqual(['DEV-3'])
  })
})

describe('when the wait gets no answer', () => {
  test('parks the ticket when the checks are still pending an hour after the push', async () => {
    // Each call waits 3 minutes, so the 20th ends the hour.
    const result = await workDev2({ waits: [...times(2, 40), 0], waitMinutes: 3 })
    const { events } = result
    expect(calls(events, 'forge', 'waitForChecks')).toHaveLength(20)
    expect(result.code).toBe(1)
    expect(statuses(events).at(-1)).toBe('Todo')
    expect(labels(events)).toEqual([['DEV-2', 'needs-human']])
    expect(openedPrs(events).at(-1)?.draft).toBe(true)
    expect(linearComments(events).at(-1)).toContain(
      "the PR's checks were still pending after an hour of waiting (wait-for-checks.sh exit 2)",
    )
  })

  test('merges a PR whose checks take just under the hour', async () => {
    const result = await workDev2({ waits: [...times(2, 19), 0], waitMinutes: 3 })
    expect(calls(result.events, 'forge', 'waitForChecks')).toHaveLength(20)
    expect(result.output).toContain(`Run ${RUN_ID} done: 1 merged, 0 parked`)
    expect(result.code).toBe(0)
  })

  test('waits 30 seconds after a `gh` error, and parks when `gh` still fails an hour on', async () => {
    const result = await workDev2({ waits: [...times(3, 200), 0] })
    const { events } = result
    // Each wait is the 30-second pause plus the harness clock's second for each reading of it,
    // so the hour ends on the 114th: 120 if the readings took no time.
    const waited = calls(events, 'forge', 'waitForChecks').length
    expect(waited).toBe(114)
    expect(sleeps(events).slice(0, waited - 1)).toEqual(times(30_000, waited - 1))
    expect(result.code).toBe(1)
    expect(statuses(events).at(-1)).toBe('Todo')
    expect(linearComments(events).at(-1)).toContain(
      '`gh` was still failing after an hour of waiting (wait-for-checks.sh exit 3)',
    )
  })

  test("starts the hour again after a CI fix round's push", async () => {
    // 45 minutes, CI fails, the fix round pushes, then 45 minutes more.
    const waits = [...times(2, 15), 1, ...times(2, 15), 0]
    const result = await workDev2({ waits, waitMinutes: 3 })
    expect(stepNamed(result.events, 'fix-round-1')).toHaveLength(1)
    expect(result.output).toContain(`Run ${RUN_ID} done: 1 merged, 0 parked`)
    expect(result.code).toBe(0)
  })

  test("starts the hour again after a rebase's force-push", async () => {
    // 45 minutes, a rebase and force-push, then 45 minutes more: 90 in all.
    const waits = [...times(2, 15), 4, ...times(2, 15), 0]
    const result = await workDev2({ waits, waitMinutes: 3 })
    expect(calls(result.events, 'forge', 'push')).toHaveLength(2)
    expect(result.output).toContain(`Run ${RUN_ID} done: 1 merged, 0 parked`)
    expect(result.code).toBe(0)
  })
})

describe('when the PR keeps conflicting with main', () => {
  test('parks the ticket when it conflicts again after 3 clean rebases', async () => {
    const result = await workDev2({ waits: [4, 4, 4, 4, 0] })
    const { events } = result
    expect(calls(events, 'forge', 'waitForChecks')).toHaveLength(4)
    expect(events.filter(isExec('git rebase origin/main'))).toHaveLength(3)
    expect(result.code).toBe(1)
    expect(statuses(events).at(-1)).toBe('Todo')
    expect(openedPrs(events).at(-1)?.draft).toBe(true)
    expect(linearComments(events).at(-1)).toContain('still conflicts with main after 3 rebases')
  })

  test('counts every rebase in the wait, with a CI fix round between them', async () => {
    const result = await workDev2({ waits: [4, 1, 4, 4, 4, 0] })
    const { events } = result
    expect(stepNamed(events, 'fix-round-1')).toHaveLength(1)
    expect(events.filter(isExec('git rebase origin/main'))).toHaveLength(3)
    expect(result.code).toBe(1)
    expect(linearComments(events).at(-1)).toContain('still conflicts with main after 3 rebases')
  })

  test('merges after a third clean rebase', async () => {
    const result = await workDev2({ waits: [4, 4, 4, 0] })
    expect(result.events.filter(isExec('git rebase origin/main'))).toHaveLength(3)
    expect(result.code).toBe(0)
  })
})

// Tests the Run's log folder, the cost of each agent step, the summary the Run ends with, and the
// follow-up issue of the Reviewer's judgement calls, through the command entry with fake ports
// (test/harness.ts).
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  review,
  RUN_ID,
  run,
  type Script,
  session,
  sessionLine,
  SPEC,
  signedOff,
  ticket,
} from './harness.ts'

function workDev2(script: Script = {}) {
  return run([SPEC, '--only', 'DEV-2'], [signedOff], { tickets: [ticket('DEV-2')], script })
}

interface AgentRecord {
  step: string
  model: string
  effort: string
  startedAt: string
  finishedAt: string
  stdout: string
  session: string | null
  cost: { usd: number; unpriced: string[] } | null
}

interface RunJson {
  runId: string
  specId: string
  startedAt: string
  finishedAt: string
  tickets: {
    id: string
    title: string
    outcome: string
    pr: string | null
    fixRounds: number
    cost: number
    steps: { step: string; result: string; startedAt: string; finishedAt: string }[]
    agents: AgentRecord[]
    reviews: {
      round: number
      attempt: number
      verdict: string
      findings: { severity: string }[]
    }[]
    replays: { round: number; criterion: string; confirmed: boolean }[]
  }[]
  summary: {
    merged: number
    parked: number
    waitingForApproval: number
    stopped: number
    cost: number
    unpriced: string[]
    followUp: string | null
  }
}

const runJson = (runDir: string) =>
  JSON.parse(readFileSync(join(runDir, 'run.json'), 'utf8')) as RunJson

const SONNET = 'claude-sonnet-5-5'
const OPUS = 'claude-opus-5-5'
const HAIKU = 'claude-haiku-5-5'

/**
 * The Implementer's session: message m1 is written as two lines (two content blocks), each with
 * the same usage. At Sonnet 5.5's prices (per million: $2 input, $10 output, $0.10 cache reads,
 * $2.50 five-minute cache writes) m1 costs 0.2 + 0.1 + 0.1 + 0.5 = $0.90, and m2 $0.01.
 */
const M1 = sessionLine('m1', SONNET, {
  input: 100_000,
  output: 10_000,
  cacheRead: 1_000_000,
  cacheWrite5m: 200_000,
})
const M2 = sessionLine('m2', SONNET, { output: 1_000 })
const IMPLEMENTER_SESSION = session(M1, M1, M2)
/**
 * The Reviewer's session, on Opus 5.5 ($20 output, $8 one-hour cache writes): $2.00 + $0.80. Its
 * Haiku 5.5 subagent ($0.10 input, $0.50 output) adds $0.005 + $0.005.
 */
const REVIEWER_SESSION = session(
  sessionLine('r1', OPUS, { output: 100_000, cacheWrite1h: 100_000 }),
  sessionLine('h1', HAIKU, { input: 50_000, output: 10_000 }),
)

describe('the run log', () => {
  test('holds run.json with each step and its times, the verdicts, the replays and the summary', async () => {
    const result = await workDev2()
    const log = runJson(result.runDir)
    expect(log.runId).toBe(RUN_ID)
    expect(log.specId).toBe(SPEC)
    const [dev2] = log.tickets
    expect(dev2).toMatchObject({ id: 'DEV-2', title: 'Ticket DEV-2', outcome: 'merged' })
    expect(dev2?.pr).toBe('https://github.com/o/r/pull/42')
    expect(dev2?.fixRounds).toBe(0)
    expect(dev2?.steps.map((step) => `${step.step}: ${step.result}`)).toEqual([
      'claim: In Progress',
      'worktree and install: jobanmendpara/dev-2-the-refusals, installed',
      'Implementer: finished, 1 commit',
      'host checks: all passed',
      'Reviewer: pass',
      'replay: 2 of 2 confirmed',
      'push gate: passed',
      'push, PR and auto-merge: https://github.com/o/r/pull/42',
      'close sandbox: closed',
      'wait for checks: merged',
    ])
    // Each step starts when the one before it finished, and takes time on the Run's clock.
    const steps = dev2?.steps ?? []
    for (const [index, step] of steps.entries()) {
      expect(Date.parse(step.finishedAt)).toBeGreaterThan(Date.parse(step.startedAt))
      if (index > 0) expect(step.startedAt).toBe(steps[index - 1]?.finishedAt)
    }
    expect(Date.parse(log.finishedAt)).toBeGreaterThan(Date.parse(log.startedAt))
    expect(dev2?.reviews).toEqual([{ round: 0, attempt: 1, verdict: 'pass', findings: [] }])
    expect(dev2?.replays).toEqual([
      { round: 0, criterion: 'AC-1.1', confirmed: true },
      { round: 0, criterion: 'AC-1.2', confirmed: true },
    ])
    expect(log.summary).toEqual({
      merged: 1,
      parked: 0,
      waitingForApproval: 0,
      stopped: 0,
      cost: 0,
      unpriced: [],
      followUp: null,
    })
  })

  test("saves each agent's stdout and session JSONL, and the host check logs", async () => {
    const result = await workDev2({
      implementer: 'Implemented it.',
      sessions: { implementer: IMPLEMENTER_SESSION, reviewer: REVIEWER_SESSION },
    })
    const agents = runJson(result.runDir).tickets[0]?.agents ?? []
    expect(agents.map((agent) => [agent.step, agent.model, agent.effort])).toEqual([
      ['implementer', SONNET, 'medium'],
      ['reviewer', OPUS, 'high'],
    ])
    const [implementer, reviewer] = agents
    const read = (path: string | null | undefined) => {
      expect(path).toEqual(expect.any(String))
      const file = join(result.runDir, path ?? '')
      expect(existsSync(file)).toBe(true)
      return readFileSync(file, 'utf8')
    }
    expect(read(implementer?.stdout)).toBe('Implemented it.')
    expect(read(implementer?.session)).toBe(IMPLEMENTER_SESSION)
    expect(read(reviewer?.stdout)).toContain('<review>')
    expect(read(reviewer?.session)).toBe(REVIEWER_SESSION)
    for (const check of ['test', 'typecheck', 'lint', 'format-check']) {
      expect(existsSync(join(result.runDir, 'DEV-2', 'checks', `${check}.log`))).toBe(true)
    }
  })

  test('records a step that captured no session, with no cost', async () => {
    const result = await workDev2({ implementer: 'Done.' })
    const [implementer] = runJson(result.runDir).tickets[0]?.agents ?? []
    expect(implementer?.session).toBeNull()
    expect(implementer?.cost).toBeNull()
  })

  test("records a Reviewer's answer that couldn't be read", async () => {
    const result = await workDev2({ reviewer: ['No review here.', review()] })
    expect(runJson(result.runDir).tickets[0]?.reviews).toEqual([
      { round: 0, attempt: 1, verdict: 'unreadable', findings: [] },
      { round: 0, attempt: 2, verdict: 'pass', findings: [] },
    ])
  })

  test('shows nothing under .factory/ in git status', async () => {
    const result = await workDev2({ sessions: { implementer: IMPLEMENTER_SESSION } })
    expect(readdirSync(result.runDir).length).toBeGreaterThan(0)
    execFileSync('git', ['init', '-q'], { cwd: result.repoDir })
    const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: result.repoDir,
      encoding: 'utf8',
    })
    expect(status).not.toContain('.factory')
    expect(status).toContain('pnpm-workspace.yaml')
  })
})

describe("an agent step's cost", () => {
  test('sums every message in its session JSONL by model and token type, at API prices', async () => {
    const result = await workDev2({
      sessions: { implementer: IMPLEMENTER_SESSION, reviewer: REVIEWER_SESSION },
    })
    const log = runJson(result.runDir)
    const [implementer, reviewer] = log.tickets[0]?.agents ?? []
    // Not $0.01, Sandcastle's usage of the last message alone, and not $1.81, m1 counted twice.
    expect(implementer?.cost?.usd).toBeCloseTo(0.91, 6)
    expect(reviewer?.cost?.usd).toBeCloseTo(2.81, 6)
    expect(log.tickets[0]?.cost).toBeCloseTo(3.72, 6)
    expect(log.summary.cost).toBeCloseTo(3.72, 6)
  })

  test('counts a resumed session only for the messages it added', async () => {
    const result = await workDev2({
      reviewer: [review('fail'), review()],
      sessions: {
        implementer: IMPLEMENTER_SESSION,
        // Resuming the Implementer's session: its JSONL holds m1 and m2 again, then m3 ($0.50).
        'fix-round-1': session(M1, M1, M2, sessionLine('m3', SONNET, { output: 50_000 })),
      },
    })
    const agents = runJson(result.runDir).tickets[0]?.agents ?? []
    const round = agents.find((agent) => agent.step === 'fix-round-1')
    expect(round?.cost?.usd).toBeCloseTo(0.5, 6)
    expect(runJson(result.runDir).tickets[0]?.fixRounds).toBe(1)
  })

  test("prices Haiku 5.5's prompts over 100K tokens at its higher rate", async () => {
    // Over 100K tokens of prompt, Haiku 5.5 is $0.50 input and $2.50 output per million.
    const result = await workDev2({
      sessions: {
        reviewer: session(sessionLine('h1', HAIKU, { input: 150_000, output: 100_000 })),
      },
    })
    const reviewer = runJson(result.runDir).tickets[0]?.agents.find((a) => a.step === 'reviewer')
    expect(reviewer?.cost?.usd).toBeCloseTo(0.075 + 0.25, 6)
  })

  test('names a model it has no price for, and leaves it out of the cost', async () => {
    const result = await workDev2({
      sessions: {
        implementer: session(sessionLine('x1', 'claude-unknown-9', { output: 1_000_000 }), M2),
      },
    })
    const log = runJson(result.runDir)
    const [implementer] = log.tickets[0]?.agents ?? []
    expect(implementer?.cost).toMatchObject({
      usd: expect.closeTo(0.01, 6),
      unpriced: ['claude-unknown-9'],
    })
    expect(log.summary).toMatchObject({ unpriced: ['claude-unknown-9'] })
    expect(result.output).toContain("claude-unknown-9's tokens aren't in the cost")
  })
})

describe('the summary', () => {
  test('prints the merged, parked and waiting-for-approval counts and the cost', async () => {
    const result = await workDev2({
      sessions: { implementer: IMPLEMENTER_SESSION, reviewer: REVIEWER_SESSION },
    })
    expect(result.output).toContain(
      `Run ${RUN_ID} done: 1 merged, 0 parked, 0 waiting for approval, $3.72.`,
    )
    expect(result.output).toContain('- DEV-2 Ticket DEV-2: merged, $3.72')
    expect(result.output).toContain(`Run log: ${result.runDir}`)
  })

  test("still prints when a ticket's turn throws, with the ticket unfinished", async () => {
    const result = await workDev2({ trackerThrows: 'setStatus' })
    expect(result.code).toBeNull()
    expect(String(result.thrown)).toContain('Linear answered 500 to setStatus')
    expect(result.output).toContain(
      `Run ${RUN_ID} done: 0 merged, 0 parked, 0 waiting for approval, $0.00.`,
    )
    expect(result.output).toContain('- DEV-2 Ticket DEV-2: unfinished, $0.00')
    const log = runJson(result.runDir)
    expect(log.tickets[0]?.outcome).toBeNull()
    expect(log.summary).toMatchObject({ merged: 0, parked: 0 })
  })

  test('counts a parked ticket', async () => {
    const result = await workDev2({ install: 1 })
    expect(result.output).toContain(
      `Run ${RUN_ID} done: 0 merged, 1 parked, 0 waiting for approval, $0.00.`,
    )
    expect(runJson(result.runDir).summary).toMatchObject({ merged: 0, parked: 1 })
  })
})

describe('the follow-up issue of judgement calls', () => {
  const findings = [
    { severity: 'hard', file: 'src/hard.ts', summary: 'Breaks the build.' },
    { severity: 'judgement', file: 'src/a.ts', summary: 'The name could be clearer; fixes DEV-9.' },
    { severity: 'judgement', file: 'src/b.ts', summary: 'Two helpers could be one.' },
  ]
  const created = (result: Awaited<ReturnType<typeof workDev2>>) =>
    result.events.filter((event) => event.port === 'tracker' && event.method === 'createIssue')

  test('is created once at the end, labelled Improvement and related to the spec', async () => {
    const result = await workDev2({ reviewer: review('pass', undefined, findings) })
    const calls = created(result)
    expect(calls).toHaveLength(1)
    const [issue] = (calls[0] as { args: unknown[] }).args as {
      title: string
      description: string
      label: string
      relatedTo: string
    }[]
    expect(issue?.label).toBe('Improvement')
    expect(issue?.relatedTo).toBe(SPEC)
    expect(issue?.title).toContain(RUN_ID)
    expect(issue?.description).toContain('src/a.ts: The name could be clearer; Related to DEV-9.')
    expect(issue?.description).toContain('src/b.ts: Two helpers could be one.')
    expect(issue?.description).toContain('DEV-2 Ticket DEV-2')
    expect(issue?.description).not.toContain('src/hard.ts')
    // It comes after the ticket's own work, and nothing marks it for an agent.
    const last = result.events.findLastIndex(
      (event) => event.port !== 'tracker' && event.port !== 'notifier',
    )
    expect(result.events.indexOf(calls[0] as never)).toBeGreaterThan(last)
    expect(result.trackerCalls.filter((call) => call.includes('DEV-900'))).toEqual([])
    expect(result.output).toContain(
      "Follow-up issue of the Reviewer's judgement calls: DEV-900 https://linear.app/mendpara/issue/DEV-900",
    )
    expect(runJson(result.runDir).summary.followUp).toBe('DEV-900')
  })

  test("takes every round's judgement calls, each once", async () => {
    const old = { severity: 'judgement', file: 'src/old.ts', summary: 'Old.' }
    const result = await workDev2({
      reviewer: [
        review('fail', undefined, [
          old,
          { severity: 'judgement', file: 'src/mid.ts', summary: 'Only in round 0.' },
        ]),
        review('pass', undefined, [
          old,
          { severity: 'judgement', file: 'src/new.ts', summary: 'New.' },
        ]),
      ],
    })
    const calls = created(result)
    expect(calls).toHaveLength(1)
    const [call] = calls as { args: { description: string }[] }[]
    const description = call?.args[0]?.description ?? ''
    expect(description).toContain('src/new.ts: New.')
    expect(description).toContain('src/mid.ts: Only in round 0.')
    expect(description.split('src/old.ts: Old.')).toHaveLength(2)
  })

  test('still ends the Run with its summary when Linear turns the issue down', async () => {
    const result = await workDev2({
      reviewer: review('pass', undefined, findings),
      trackerThrows: 'createIssue',
    })
    expect(created(result)).toHaveLength(1)
    expect(result.code).toBe(0)
    expect(result.output).toContain(`Run ${RUN_ID} done: 1 merged, 0 parked`)
    expect(result.output).toContain(
      "The follow-up issue of the Reviewer's judgement calls couldn't be created: Linear answered 500 to createIssue.",
    )
    expect(runJson(result.runDir).summary).toMatchObject({ merged: 1, followUp: null })
  })

  test('is not created when the Reviewer made no judgement calls', async () => {
    const hardOnly = await workDev2({ reviewer: review('pass', undefined, [findings[0]]) })
    expect(created(hardOnly)).toEqual([])
    expect(runJson(hardOnly.runDir).summary.followUp).toBeNull()
    expect(hardOnly.output).not.toContain('Follow-up issue')
  })
})

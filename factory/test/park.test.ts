// Tests parking a ticket the factory can't finish, and picking it up again once the maintainer has
// answered, through `pnpm factory <spec> --only DEV-M` with fake ports (test/harness.ts).
import { describe, expect, test } from 'vitest'
import type { AgentStep } from '../src/ports.ts'
import {
  type Event,
  review,
  RUN_ID,
  run,
  type Script,
  SPEC,
  signedOff,
  ticket,
  WORKTREE,
} from './harness.ts'

const TICKET = ticket('DEV-2')
const PARK_SIGNAL = 'Done what I could. <park>AC-1.2 contradicts AC-1.1: both cannot hold.</park>'

function workDev2(script: Script = {}, dev2 = TICKET) {
  return run([SPEC, '--only', 'DEV-2'], [signedOff], { tickets: [dev2], script })
}

type Called = Extract<Event, { port: 'tracker' | 'forge' }>
const calls = (events: Event[], port: 'tracker' | 'forge', method: string) =>
  events.filter((event): event is Called => event.port === port && event.method === method)
const linearComments = (events: Event[]) =>
  calls(events, 'tracker', 'comment').map((event) => String(event.args[1]))
const agentSteps = (events: Event[]): AgentStep[] =>
  events.flatMap((event) => (event.method === 'runAgent' && 'step' in event ? [event.step] : []))
const openedPrs = (events: Event[]) =>
  calls(events, 'forge', 'openPr').map((event) => event.args[0] as { draft: boolean; body: string })

/** Checks the ticket ended Todo with `needs-human`: parked, and back with the maintainer. */
function expectParked(events: Event[]) {
  const statuses = calls(events, 'tracker', 'setStatus').map((event) => event.args[1])
  expect(statuses.at(-1)).toBe('Todo')
  expect(calls(events, 'tracker', 'setAgentLabel').map((event) => event.args)).toEqual([
    ['DEV-2', 'needs-human'],
  ])
}

describe('parking a ticket', () => {
  test.each([
    ['covers a criterion the spec lacks', '**Covers:** AC-1.1, AC-9.9', 'AC-9.9'],
    ['says nothing about what it covers', 'No covers line here.', '"Covers:"'],
  ])(
    'parks a ticket that %s before any agent starts, naming why',
    async (_, description, named) => {
      const result = await workDev2({}, ticket('DEV-2', { description }))
      expect(result.code).toBe(1)
      expectParked(result.events)
      expect(result.events.filter((event) => event.port === 'sandboxes')).toEqual([])
      expect(agentSteps(result.events)).toEqual([])
      const [comment] = linearComments(result.events)
      expect(comment).toMatch(/^🏭 Factory: Parked/)
      expect(comment).toContain(named)
    },
  )

  test("parks on the Implementer's park signal, with its reason, and runs no Reviewer", async () => {
    const result = await workDev2({ implementer: PARK_SIGNAL })
    expect(result.code).toBe(1)
    expect(agentSteps(result.events).map((step) => step.name)).toEqual(['implementer'])
    expectParked(result.events)
    expect(linearComments(result.events).at(-1)).toContain(
      'AC-1.2 contradicts AC-1.1: both cannot hold.',
    )
  })

  test('pushes a parked branch as a draft PR with no auto-merge, and @mentions the maintainer', async () => {
    const result = await workDev2({ replays: { 'AC-1.2': 'passes' } })
    expectParked(result.events)
    expect(calls(result.events, 'forge', 'push').map((event) => event.args)).toEqual([
      [WORKTREE, TICKET.branch],
    ])
    const [pr] = openedPrs(result.events)
    expect(pr?.draft).toBe(true)
    expect(pr?.body).toContain('| AC-1.1 | test/AC-1.1.test.ts › AC-1.1 | confirmed |')
    expect(pr?.body).toContain('| AC-1.2 | test/AC-1.2.test.ts › AC-1.2 | not confirmed |')
    expect(calls(result.events, 'forge', 'queueAutoMerge')).toEqual([])
    const prComments = calls(result.events, 'forge', 'commentOnPr').map((event) =>
      String(event.args[1]),
    )
    expect(prComments).toEqual([expect.stringMatching(/^🏭 Factory: @jobanmendpara /)])
  })

  test('says in Linear why, with the last verdict, the replay rows and the run log', async () => {
    const result = await workDev2({ reviewer: review('fail'), replays: { 'AC-1.2': 'passes' } })
    const comment = linearComments(result.events).at(-1) ?? ''
    expect(comment).toMatch(/^🏭 Factory: Parked by factory Run/)
    expect(comment).toContain('the Reviewer failed it')
    expect(comment).toContain("AC-1.2's replay wasn't confirmed")
    expect(comment).toContain('Last verdict: **fail**')
    expect(comment).toContain('| AC-1.2 | test/AC-1.2.test.ts › AC-1.2 | not confirmed |')
    expect(comment).toContain(`.factory/runs/${RUN_ID}/DEV-2`)
    expect(comment).toContain('https://github.com/o/r/pull/')
  })

  test('opens no draft PR when the branch has no commits, and says so', async () => {
    const result = await workDev2({ commits: 0 })
    expectParked(result.events)
    expect(calls(result.events, 'forge', 'push')).toEqual([])
    expect(openedPrs(result.events)).toEqual([])
    expect(linearComments(result.events).at(-1)).toContain('No draft PR')
  })

  test('keeps the branch local when GitHub turns the push down for workflow files', async () => {
    const result = await workDev2({ implementer: PARK_SIGNAL, workflowsRefused: true })
    expectParked(result.events)
    expect(openedPrs(result.events)).toEqual([])
    expect(linearComments(result.events).at(-1)).toContain('has to be made by hand')
  })

  test('parks rather than pushes when the push gate fails, and the Run ends with it parked', async () => {
    const result = await workDev2({ checks: { typecheck: 1 } })
    expect(result.code).toBe(1)
    expectParked(result.events)
    expect(openedPrs(result.events).every((pr) => pr.draft)).toBe(true)
    expect(result.output).toContain(`Run ${RUN_ID} done: DEV-2 parked`)
  })
})

describe('picking a parked ticket up again', () => {
  const PARKED = {
    body: '🏭 Factory: Parked by factory Run `2026-11-26-0900-DEV-269`: AC-1.2 is impossible.',
    createdAt: '2026-11-26T09:30:00Z',
  }
  const comments = [
    { body: 'An old note from before the park.', createdAt: '2026-11-26T08:00:00Z' },
    PARKED,
    {
      body: 'AC-1.2 means the refusal message, not the exit code.',
      createdAt: '2026-11-26T10:00:00Z',
    },
    { body: '🏭 Factory: Claimed by factory Run `x`.', createdAt: '2026-11-26T11:00:00Z' },
  ]

  test('tells a new Implementer the last park and what was said since', async () => {
    const result = await workDev2({ comments })
    expect(result.code).toBe(0)
    const prompt =
      agentSteps(result.events).find((step) => step.name === 'implementer')?.prompt ?? ''
    expect(prompt).toContain(PARKED.body)
    expect(prompt).toContain('AC-1.2 means the refusal message, not the exit code.')
    expect(prompt).not.toContain('An old note from before the park.')
    expect(prompt).not.toContain('Claimed by factory Run `x`')
  })

  test("continues on the ticket's own branch", async () => {
    const result = await workDev2({ comments })
    const created = result.events.find((event) => event.port === 'sandboxes')
    expect(created && 'options' in created ? created.options.branch : null).toBe(TICKET.branch)
  })

  test('says nothing about a park when the ticket was never parked', async () => {
    const result = await workDev2({ comments: [comments[0]!] })
    const prompt =
      agentSteps(result.events).find((step) => step.name === 'implementer')?.prompt ?? ''
    expect(prompt).not.toContain('parked')
  })
})

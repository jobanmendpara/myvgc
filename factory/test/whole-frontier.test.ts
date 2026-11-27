// Tests `pnpm factory <spec>` without `--only`: it works the whole frontier, two tickets at most
// in flight at once, and reads the frontier again after every merge. Through the command entry
// with fake ports (test/harness.ts), holding steps open to look at the Run part-way through.
import { describe, expect, test } from 'vitest'
import {
  DONE,
  type Event,
  type Hold,
  hold,
  RUN_ID,
  SPEC,
  signedOff,
  start,
  ticket,
} from './harness.ts'

const DEV1 = ticket('DEV-1')
const DEV2 = ticket('DEV-2')
const DEV3 = ticket('DEV-3')
const branchOf = (id: string) => ticket(id).branch

const isClaim = (id: string) => (event: Event) =>
  event.port === 'tracker' &&
  event.method === 'setStatus' &&
  event.args[0] === id &&
  event.args[1] === 'In Progress'
const isAgent = (id: string, step: string) => (event: Event) =>
  event.method === 'runAgent' &&
  'step' in event &&
  event.step.name === step &&
  event.branch === branchOf(id)
const isWait = (pr: number) => (event: Event) =>
  event.port === 'forge' && event.method === 'waitForChecks' && event.args[0] === pr
const isClose = (id: string) => (event: Event) =>
  event.method === 'close' && 'branch' in event && event.branch === branchOf(id)
const claimed = (events: Event[]) =>
  events.flatMap((event) =>
    event.port === 'tracker' && event.method === 'setStatus' && event.args[1] === 'In Progress'
      ? [String(event.args[0])]
      : [],
  )
const sandboxesOf = (events: Event[], id: string) =>
  events.filter((event) => event.port === 'sandboxes' && event.options.branch === branchOf(id))

/** The Run's summary line, after "Run <id> done: ", if it has printed one. */
const summaryOf = (lines: string[]) =>
  lines
    .find((line) => line.startsWith(`Run ${RUN_ID} done: `))
    ?.slice(`Run ${RUN_ID} done: `.length)

/** Settles the Run, and checks each hold has caught its step: the Run got that far. */
async function held(factory: { settle: () => Promise<void> }, ...holds: Hold[]) {
  await factory.settle()
  expect(holds.map((each) => each.caught)).toEqual(holds.map(() => true))
}

/** The most sandboxes open at once: each is open from its create to its close. */
function mostOpen(events: Event[]): number {
  let open = 0
  let most = 0
  for (const event of events) {
    if (event.port === 'sandboxes') open += 1
    if (event.method === 'close') open -= 1
    most = Math.max(most, open)
  }
  return most
}

describe('two slots', () => {
  test('with three takeable tickets, makes two sandboxes and claims the third only once a slot frees', async () => {
    const first = hold(isAgent('DEV-1', 'implementer'))
    const second = hold(isAgent('DEV-2', 'implementer'))
    const factory = start([SPEC], [signedOff], {
      tickets: [DEV1, DEV2, DEV3],
      holds: [first, second],
    })
    await held(factory, first, second)
    expect(factory.events.filter((event) => event.port === 'sandboxes')).toHaveLength(2)
    expect(claimed(factory.events)).toEqual(['DEV-1', 'DEV-2'])

    first.release()
    await factory.settle()
    const { events } = factory
    expect(claimed(events)).toEqual(['DEV-1', 'DEV-2', 'DEV-3'])
    expect(events.findIndex(isClaim('DEV-3'))).toBeGreaterThan(events.findIndex(isClose('DEV-1')))
    expect(sandboxesOf(events, 'DEV-3')).toHaveLength(1)

    second.release()
    const result = await factory.done()
    expect(mostOpen(result.events)).toBe(2)
    expect(result.code).toBe(0)
    expect(result.output).toContain(`Run ${RUN_ID} done`)
  })

  test('never has more than two sandboxes open, and works every takeable ticket', async () => {
    const tickets = ['DEV-1', 'DEV-2', 'DEV-3', 'DEV-4', 'DEV-5'].map((id) => ticket(id))
    const result = await start([SPEC], [signedOff], {
      tickets,
      script: { waitsOf: { 'DEV-2': [1, 0], 'DEV-3': [4, 0] } },
    }).done()
    expect(mostOpen(result.events)).toBe(2)
    expect(claimed(result.events).sort()).toEqual(['DEV-1', 'DEV-2', 'DEV-3', 'DEV-4', 'DEV-5'])
    expect(result.code).toBe(0)
  })
})

describe('waiting on CI', () => {
  test('a ticket waiting on CI holds no slot: the next ticket is claimed in its place', async () => {
    const waiting = hold(isWait(42))
    const busy = hold(isAgent('DEV-2', 'implementer'))
    const factory = start([SPEC], [signedOff], {
      tickets: [DEV1, DEV2, DEV3],
      holds: [waiting, busy],
    })
    await held(factory, waiting, busy)
    const { events } = factory
    expect(claimed(events)).toEqual(['DEV-1', 'DEV-2', 'DEV-3'])
    expect(sandboxesOf(events, 'DEV-3')).toHaveLength(1)
    expect(events.findIndex(isClaim('DEV-3'))).toBeGreaterThan(events.findIndex(isClose('DEV-1')))

    waiting.release()
    busy.release()
    expect((await factory.done()).code).toBe(0)
  })

  test('a CI fix round waits for a free slot, holds it through its push, and goes ahead of claiming another ticket', async () => {
    const second = hold(isAgent('DEV-2', 'implementer'))
    const third = hold(isAgent('DEV-3', 'implementer'))
    const factory = start([SPEC], [signedOff], {
      tickets: [DEV1, DEV2, DEV3, ticket('DEV-4')],
      script: { waitsOf: { 'DEV-1': [1, 0] } },
      holds: [second, third],
    })
    await held(factory, second, third)
    // DEV-1's CI failed while DEV-2 and DEV-3 hold both slots: its round has no sandbox yet.
    expect(sandboxesOf(factory.events, 'DEV-1')).toHaveLength(1)
    expect(factory.events.some(isAgent('DEV-1', 'fix-round-1'))).toBe(false)

    second.release()
    await factory.settle()
    const { events } = factory
    const roundSandbox = events.indexOf(sandboxesOf(events, 'DEV-1')[1] as Event)
    expect(roundSandbox).toBeGreaterThan(events.findIndex(isClose('DEV-2')))
    expect(events.some(isAgent('DEV-1', 'fix-round-1'))).toBe(true)
    const pushes = events.flatMap((event, index) =>
      event.port === 'forge' && event.method === 'push' && event.args[1] === branchOf('DEV-1')
        ? [index]
        : [],
    )
    expect(pushes).toHaveLength(2)
    const roundClosed = events.findLastIndex(isClose('DEV-1'))
    expect(pushes[1]).toBeGreaterThan(roundSandbox)
    expect(roundClosed).toBeGreaterThan(pushes[1] ?? Infinity)
    expect(events.findIndex(isClaim('DEV-4'))).toBeGreaterThan(roundClosed)
    expect(mostOpen(events)).toBe(2)

    third.release()
    const result = await factory.done()
    expect(mostOpen(result.events)).toBe(2)
    expect(result.code).toBe(0)
  })

  test("a rebase's sandbox waits for a free slot too", async () => {
    const second = hold(isAgent('DEV-2', 'implementer'))
    const third = hold(isAgent('DEV-3', 'implementer'))
    const factory = start([SPEC], [signedOff], {
      tickets: [DEV1, DEV2, DEV3],
      script: { waitsOf: { 'DEV-1': [4, 0] } },
      holds: [second, third],
    })
    await held(factory, second, third)
    const rebases = (events: Event[]) =>
      events.filter(
        (event) =>
          event.method === 'exec' &&
          'command' in event &&
          event.command === 'git rebase origin/main' &&
          event.branch === branchOf('DEV-1'),
      )
    expect(sandboxesOf(factory.events, 'DEV-1')).toHaveLength(1)
    expect(rebases(factory.events)).toEqual([])

    second.release()
    await factory.settle()
    const { events } = factory
    expect(events.indexOf(sandboxesOf(events, 'DEV-1')[1] as Event)).toBeGreaterThan(
      events.findIndex(isClose('DEV-2')),
    )
    expect(rebases(events)).toHaveLength(1)
    expect(mostOpen(events)).toBe(2)

    third.release()
    expect((await factory.done()).code).toBe(0)
  })
})

describe('reading the frontier again', () => {
  const isRead = (event: Event) => event.port === 'tracker' && event.method === 'getSubIssues'

  test('a ticket blocked by one the Run merges is claimed in the same Run, once the merge is read', async () => {
    const blocked = ticket('DEV-2', { blockedBy: [{ id: 'DEV-1', status: DEV1.status }] })
    const result = await start([SPEC], [signedOff], { tickets: [DEV1, blocked] }).done()
    const { events } = result
    expect(claimed(events)).toEqual(['DEV-1', 'DEV-2'])
    const merge = events.findIndex(isWait(42))
    const reread = events.findIndex((event, index) => index > merge && isRead(event))
    expect(merge).toBeGreaterThan(-1)
    expect(reread).toBeGreaterThan(merge)
    expect(events.findIndex(isClaim('DEV-2'))).toBeGreaterThan(reread)
    expect(summaryOf(result.lines)).toMatch(/^2 merged, 0 parked, /)
    expect(result.code).toBe(0)
  })

  test('reads the frontier again after every merge', async () => {
    const result = await start([SPEC], [signedOff], { tickets: [DEV1, DEV2] }).done()
    const { events } = result
    const merges = events.flatMap((event, index) =>
      event.port === 'forge' && event.method === 'waitForChecks' ? [index] : [],
    )
    const reads = events.flatMap((event, index) => (isRead(event) ? [index] : []))
    expect(merges).toHaveLength(2)
    // Merges that land together share the one read that follows them.
    for (const merge of merges) expect(reads.some((read) => read > merge)).toBe(true)
  })

  test('--only works its one ticket and ends, taking no ticket its merge unblocks', async () => {
    const blocked = ticket('DEV-2', { blockedBy: [{ id: 'DEV-1', status: DEV1.status }] })
    const result = await start([SPEC, '--only', 'DEV-1'], [signedOff], {
      tickets: [DEV1, blocked],
    }).done()
    expect(claimed(result.events)).toEqual(['DEV-1'])
    expect(result.events.filter(isRead)).toHaveLength(1)
    expect(summaryOf(result.lines)).toMatch(/^1 merged, 0 parked, /)
  })
})

describe('the end of the Run', () => {
  test('ends and prints its summary once nothing is takeable and nothing is in flight', async () => {
    const unknown = ticket('DEV-2', { description: '**Covers:** AC-9.9' })
    const result = await start([SPEC], [signedOff], { tickets: [DEV1, unknown] }).done()
    expect(summaryOf(result.lines)).toMatch(/^1 merged, 1 parked, 0 waiting for approval, /)
    expect(result.lines).toContain(`- DEV-1 ${DEV1.title}: merged, $0.00`)
    expect(result.lines).toContain(`- DEV-2 ${unknown.title}: parked, $0.00`)
    // A parked ticket makes the Run's exit non-zero.
    expect(result.code).toBe(1)
  })

  test("doesn't end while a ticket is in flight, even with nothing takeable", async () => {
    const waiting = hold(isWait(42))
    const factory = start([SPEC], [signedOff], { tickets: [DEV1], holds: [waiting] })
    await factory.settle()
    expect(waiting.caught).toBe(true)
    expect(factory.ended()).toBe(false)
    expect(summaryOf(factory.lines)).toBeUndefined()

    waiting.release()
    const result = await factory.done()
    expect(summaryOf(result.lines)).toMatch(/^1 merged, /)
  })

  test('with nothing takeable, ends at once with its summary, claiming nothing', async () => {
    const result = await start([SPEC], [signedOff], {
      tickets: [ticket('DEV-1', { status: DONE })],
    }).done()
    expect(result.code).toBe(0)
    expect(summaryOf(result.lines)).toMatch(/^0 merged, 0 parked, 0 waiting for approval, /)
    expect(result.trackerCalls).toEqual([`getIssue ${SPEC}`, `getSubIssues ${SPEC}`])
    expect(result.events.filter((event) => event.port === 'sandboxes')).toEqual([])
  })
})

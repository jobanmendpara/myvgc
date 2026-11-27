// Tests Seen criteria: the Reviewer's screenshots are copied to the run log, pushed to the
// `factory-screenshots` branch and shown in the PR comment, and a Seen criterion with no screenshot,
// or one the Reviewer judged not matching, fails the push gate. Through
// `pnpm factory <spec> --only DEV-M` with fake ports (test/harness.ts).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import type { AgentStep } from '../src/ports.ts'
import {
  type Event,
  png,
  review,
  RUN_ID,
  run,
  type Script,
  type SeenRowInput,
  SPEC,
  signedOff,
  ticket,
} from './harness.ts'

/** A ticket covering a Tested criterion and a Seen one (AC-2.1 is marked "(Seen)"). */
const TICKET = ticket('DEV-2', {
  description: '## What to build\n\nThe Team page.\n\n**Covers:** AC-1.1, AC-2.1',
})

const PHONE = '.preview/screenshots/teams-sprite-inline-phone.png'
const DESKTOP = '.preview/screenshots/teams-sprite-inline-desktop.png'
const SHOTS = { [PHONE]: png('phone shot'), [DESKTOP]: png('desktop shot') }

const seen = (row: Omit<SeenRowInput, 'id'> = {}): SeenRowInput => ({
  id: 'AC-2.1',
  screenshots: [PHONE, DESKTOP],
  matches: true,
  judgement: 'The Team shows at both widths.',
  ...row,
})
const reviewWith = (...rows: SeenRowInput[]) => review('pass', ['AC-1.1'], [], rows)

function workDev2(script: Script = {}) {
  return run([SPEC, '--only', 'DEV-2'], [signedOff], {
    tickets: [TICKET],
    script: { screenshots: SHOTS, reviewer: reviewWith(seen()), ...script },
  })
}

type ForgeCall = Extract<Event, { port: 'forge' }>
const forgeCalls = (events: Event[], method: string) =>
  events.filter((event): event is ForgeCall => event.port === 'forge' && event.method === method)
const pushedFiles = (events: Event[]) =>
  forgeCalls(events, 'pushFiles').map(
    (event) => event.args as [string, { path: string; from: string }[]],
  )
const prComments = (events: Event[]) =>
  forgeCalls(events, 'commentOnPr').map((event) => String(event.args[1]))
const fixRounds = (events: Event[]): AgentStep[] =>
  events.flatMap((event) =>
    event.method === 'runAgent' && 'step' in event && event.step.name.startsWith('fix-round-')
      ? [event.step]
      : [],
  )
/** PRs opened ready to merge, and merges queued: none when the push gate never passed. */
const notParkedPushes = (events: Event[]) =>
  forgeCalls(events, 'openPr').filter((event) => !(event.args[0] as { draft: boolean }).draft)
    .length + forgeCalls(events, 'queueAutoMerge').length
const RAW = 'https://raw.githubusercontent.com/o/r/factory-screenshots'
const FOLDER = `DEV-2/${RUN_ID}`

describe("a Seen criterion's screenshots", () => {
  test('are copied to the run log', async () => {
    const { code, repoDir } = await workDev2()
    expect(code).toBe(0)
    const logged = join(repoDir, '.factory', 'runs', RUN_ID, 'DEV-2', 'screenshots')
    const copied = (name: string) => {
      const file = join(logged, name)
      return existsSync(file) ? readFileSync(file) : undefined
    }
    expect(copied('teams-sprite-inline-phone.png')).toEqual(SHOTS[PHONE])
    expect(copied('teams-sprite-inline-desktop.png')).toEqual(SHOTS[DESKTOP])
  })

  test('are pushed to factory-screenshots under DEV-N/<run>/, from the run log, before the PR', async () => {
    const { events, repoDir } = await workDev2()
    const logged = join(repoDir, '.factory', 'runs', RUN_ID, 'DEV-2', 'screenshots')
    expect(pushedFiles(events)).toEqual([
      [
        'factory-screenshots',
        [
          {
            path: `${FOLDER}/teams-sprite-inline-phone.png`,
            from: join(logged, 'teams-sprite-inline-phone.png'),
          },
          {
            path: `${FOLDER}/teams-sprite-inline-desktop.png`,
            from: join(logged, 'teams-sprite-inline-desktop.png'),
          },
        ],
      ],
    ])
    const pushed = events.findIndex((event) => event.method === 'pushFiles')
    const opened = events.findIndex((event) => event.method === 'openPr')
    expect(pushed).toBeGreaterThan(-1)
    expect(pushed).toBeLessThan(opened)
  })

  test('are embedded in the PR comment by raw URL, under their criterion', async () => {
    const { events } = await workDev2()
    const [comment = ''] = prComments(events)
    expect(comment).toContain('AC-2.1')
    expect(comment).toContain('The Team shows at both widths.')
    expect(comment).toContain(
      `![teams-sprite-inline-phone.png](${RAW}/${FOLDER}/teams-sprite-inline-phone.png)`,
    )
    expect(comment).toContain(
      `![teams-sprite-inline-desktop.png](${RAW}/${FOLDER}/teams-sprite-inline-desktop.png)`,
    )
    expect(comment.indexOf('The Team shows')).toBeLessThan(comment.indexOf('![teams'))
  })

  test("keep closing words in the Reviewer's judgement from closing another issue", async () => {
    const { events } = await workDev2({
      reviewer: reviewWith(seen({ judgement: 'It matches, and closes DEV-9 as well.' })),
    })
    const [comment = ''] = prComments(events)
    expect(comment).not.toMatch(/closes DEV-9/i)
    expect(comment).toContain('Related to DEV-9')
  })

  test('are taken by the Reviewer, which is told to run pnpm preview and pnpm screenshots', async () => {
    const { events } = await workDev2()
    const reviewer = events.find(
      (event) => event.method === 'runAgent' && 'step' in event && event.step.name === 'reviewer',
    )
    const prompt = reviewer && 'step' in reviewer ? reviewer.step.prompt : ''
    expect(prompt).toContain('AC-2.1 (seen)')
    expect(prompt).toContain('`pnpm preview`')
    expect(prompt).toContain('`pnpm screenshots <path> [options]`')
  })

  test('push nothing to factory-screenshots for a ticket with no Seen criterion', async () => {
    const { code, events } = await run([SPEC, '--only', 'DEV-3'], [signedOff], {
      tickets: [ticket('DEV-3')],
    })
    expect(code).toBe(0)
    expect(pushedFiles(events)).toEqual([])
  })
})

describe('the push gate, for a Seen criterion', () => {
  // The gate's reasons end the fix round's first line, each followed by "; " or the closing ".".
  const NONE = /AC-2\.1 has no screenshot[.;]/
  const ONE_OF_TWO = /AC-2\.1 has no screenshot for 1 of the 2 paths the Reviewer gave/
  test.each<[string, Script, RegExp]>([
    ['the Reviewer lists no screenshot', { reviewer: reviewWith(seen({ screenshots: [] })) }, NONE],
    ['the Reviewer gives the criterion no row', { reviewer: reviewWith() }, NONE],
    [
      'a screenshot is missing from the sandbox',
      { screenshots: { [PHONE]: png('phone') } },
      ONE_OF_TWO,
    ],
    [
      'the screenshot is outside .preview/screenshots, even a PNG the sandbox has',
      {
        reviewer: reviewWith(seen({ screenshots: ['../../../home/agent/shot.png'] })),
        screenshots: { '../../../home/agent/shot.png': png('outside') },
      },
      NONE,
    ],
    [
      'a file is not a PNG',
      { screenshots: { [PHONE]: SHOTS[PHONE], [DESKTOP]: Buffer.from('#!/bin/sh\n') } },
      ONE_OF_TWO,
    ],
    [
      'the screenshots field is not a list',
      { reviewer: reviewWith(seen({ screenshots: PHONE })) },
      NONE,
    ],
  ])('fails when %s, and nothing is pushed', async (_, script, reason) => {
    const { events } = await workDev2(script)
    expect(fixRounds(events)).toHaveLength(2)
    const [first] = fixRounds(events)
    expect(first?.prompt.split('\n')[0]).toMatch(reason)
    expect(pushedFiles(events)).toEqual([])
    // The ticket parks: its branch goes up only as a draft PR, with no auto-merge.
    expect(notParkedPushes(events)).toBe(0)
  })

  test.each<[string, unknown]>([
    ['not matching', false],
    ['nothing about matching', undefined],
  ])(
    'fails when the Reviewer judged the screenshots %s, even with a pass verdict',
    async (_, matches) => {
      const { events } = await workDev2({
        reviewer: reviewWith(seen({ matches, judgement: 'The Team is cut off at phone width.' })),
      })
      expect(fixRounds(events)).toHaveLength(2)
      expect(pushedFiles(events)).toEqual([])
      expect(notParkedPushes(events)).toBe(0)
      const [first] = fixRounds(events)
      expect(first?.prompt).toContain("the Reviewer judged AC-2.1's screenshots not matching")
      expect(first?.prompt).toContain('The Team is cut off at phone width.')
    },
  )

  test('passes once a fix round brings a matching screenshot', async () => {
    const { code, events } = await workDev2({
      reviewer: [reviewWith(seen({ screenshots: [] })), reviewWith(seen())],
    })
    expect(code).toBe(0)
    expect(fixRounds(events)).toHaveLength(1)
    expect(pushedFiles(events)).toHaveLength(1)
    expect(forgeCalls(events, 'queueAutoMerge')).toHaveLength(1)
  })

  test("keeps each round's screenshots in that round's folder of the run log", async () => {
    const { repoDir } = await workDev2({
      reviewer: [reviewWith(seen({ matches: false })), reviewWith(seen())],
    })
    const ticketLog = join(repoDir, '.factory', 'runs', RUN_ID, 'DEV-2')
    expect(existsSync(join(ticketLog, 'screenshots', 'teams-sprite-inline-phone.png'))).toBe(true)
    expect(
      existsSync(join(ticketLog, 'fix-round-1', 'screenshots', 'teams-sprite-inline-phone.png')),
    ).toBe(true)
  })
})

// Tests the retro after each spec (DEV-288): the Run that leaves every ticket Done or parked says
// "Spec done", and `pnpm factory retro <spec>` gathers the bundle for an interactive `/retro`
// session, calling no agent or model. Through factory() with fake ports (test/harness.ts): the
// bundle is gathered from the run logs real Runs left in the same folders, and from what those
// Runs wrote to Linear and GitHub, handed back by the fake Tracker and Forge.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { describe, expect, test } from 'vitest'
import type { Comment, Issue, PrComment, Status } from '../src/ports.ts'
import {
  CANCELED,
  DONE,
  type Event,
  IN_PROGRESS,
  review,
  run,
  type Script,
  session,
  sessionLine,
  SPEC,
  signedOff,
  ticket,
  TODO,
} from './harness.ts'

const IN_REVIEW: Status = { name: 'In Review', type: 'started' }
const SPEC_DONE = 'Spec done: run `pnpm factory retro DEV-269`'

/** A ticket as a park leaves it: Todo with `needs-human`. */
const parked = (id: string) => ticket(id, { status: TODO, labels: ['needs-human', 'Chore'] })

const bundlePath = (repoDir: string) => join(repoDir, '.factory', 'retros', SPEC, 'bundle.md')

/** What a Run wrote through a port's method, in order. */
const calls = (events: Event[], port: string, method: string) =>
  events.flatMap((event) =>
    event.port === port && 'args' in event && event.method === method ? [event.args] : [],
  )

describe('the end of a Run', () => {
  test('that leaves every ticket Done says "Spec done" in its summary and its notification', async () => {
    const result = await run([SPEC], [signedOff], {
      tickets: [ticket('DEV-1', { status: DONE }), ticket('DEV-2')],
    })
    expect(result.lines).toContain(`${SPEC_DONE}.`)
    expect(result.notifications.at(-1)?.text).toMatch(
      /^🏭 Run \S+ done: 1 merged, 0 parked, 0 waiting for approval, \$0\.00\. Spec done: run `pnpm factory retro DEV-269`$/,
    )
  })

  test('that leaves the last ticket parked says "Spec done"', async () => {
    const result = await run([SPEC], [signedOff], {
      tickets: [parked('DEV-1'), ticket('DEV-2', { status: CANCELED }), ticket('DEV-3')],
      script: { install: 1 },
    })
    expect(result.output).toContain('- DEV-3 Ticket DEV-3: parked')
    expect(result.lines).toContain(`${SPEC_DONE}.`)
    expect(result.notifications.at(-1)?.text).toContain(SPEC_DONE)
  })

  test('with a ticket left open says nothing of the spec being done', async () => {
    const result = await run([SPEC, '--only', 'DEV-2'], [signedOff], {
      tickets: [ticket('DEV-1'), ticket('DEV-2')],
    })
    expect(result.output).toContain('- DEV-2 Ticket DEV-2: merged')
    expect(result.output).not.toContain('Spec done')
    expect(result.notifications.at(-1)?.text).not.toContain('Spec done')
  })

  test('with a PR waiting for `approved` says nothing of the spec being done', async () => {
    const result = await run([SPEC], [signedOff], {
      tickets: [ticket('DEV-1')],
      script: { waits: [5] },
    })
    expect(result.output).toContain('- DEV-1 Ticket DEV-1: waiting for approval')
    expect(result.output).not.toContain('Spec done')
    expect(result.notifications.at(-1)?.text).not.toContain('Spec done')
  })

  test('never starts the retro itself', async () => {
    const result = await run([SPEC], [signedOff], { tickets: [ticket('DEV-1')] })
    expect(result.lines).toContain(`${SPEC_DONE}.`)
    expect(existsSync(join(result.repoDir, '.factory', 'retros'))).toBe(false)
  })
})

describe('pnpm factory retro, on a spec that isn’t done', () => {
  test('exits non-zero naming each ticket still open and not parked, and writes no bundle', async () => {
    const result = await run(['retro', SPEC], [signedOff], {
      tickets: [
        ticket('DEV-1', { status: DONE }),
        parked('DEV-2'),
        ticket('DEV-3', { status: IN_PROGRESS }),
        // Waiting for `approved`: In Review with `needs-human`, which isn't parked.
        ticket('DEV-4', { status: IN_REVIEW, labels: ['needs-human', 'Chore'] }),
        ticket('DEV-5'),
      ],
    })
    expect(result.code).not.toBe(0)
    const named = result.lines.filter((line) => line.startsWith('- '))
    expect(named).toEqual([
      '- DEV-3 Ticket DEV-3 (In Progress)',
      '- DEV-4 Ticket DEV-4 (In Review)',
      '- DEV-5 Ticket DEV-5 (Todo)',
    ])
    expect(result.output).toContain('still open and not parked')
    expect(existsSync(bundlePath(result.repoDir))).toBe(false)
  })
})

/** The maintainer's answer to DEV-2's park: after it, and before the retro. */
const REPLY: Comment = {
  body: 'Use the fixture in apps/api instead.',
  createdAt: '2026-11-28T00:00:00.000Z',
}

/**
 * Two Runs of the spec in the same checkout, each a later command: the first merges DEV-1 after
 * two CI failures, each with its fix round, and a clean rebase; the second parks DEV-2, whose
 * install fails. Then the retro, with DEV-1 Done and DEV-2 parked. Linear keeps what the Runs
 * wrote; the PR's comments are the ones the first Run posted, and `more` adds to the script.
 */
async function twoRunsThenRetro(more: Script = {}) {
  const findings = [{ severity: 'judgement', file: 'src/a.ts', summary: 'A clearer name.' }]
  const first = await run([SPEC, '--only', 'DEV-1'], [signedOff], {
    tickets: [ticket('DEV-1'), ticket('DEV-2')],
    script: {
      reviewer: review('pass', undefined, findings),
      waits: [1, 1, 4, 0],
      ciLog: 'ci: FAIL test/refusals.test.ts > refuses\nAssertionError: expected 1 to be 2',
      sessions: {
        implementer: session(sessionLine('msg-1', 'claude-sonnet-5-5', { input: 1_000_000 })),
      },
    },
  })
  const second = await first.again({
    args: [SPEC, '--only', 'DEV-2'],
    tickets: [ticket('DEV-1', { status: DONE }), ticket('DEV-2')],
    script: { install: 1 },
  })
  const [, parkNote] = calls(second.events, 'tracker', 'comment').find(
    ([id, body]) => id === 'DEV-2' && String(body).startsWith('🏭 Factory: Parked'),
  ) as [string, string]
  const prComments: PrComment[] = [
    ...calls(first.events, 'forge', 'commentOnPr').map(([, body]) => String(body)),
    '🏭 Factory: @jobanmendpara this PR changes a risky path, so it waits for you.',
    'Looks good to me.',
  ].map((body, index) => ({
    body,
    url: `https://github.com/o/r/pull/42#issuecomment-${index + 1}`,
    createdAt: '2026-11-27T14:30:00.000Z',
  }))
  const followUp: Issue = {
    id: 'DEV-900',
    title: "The Reviewer's judgement calls from factory Run 2026-11-27-1405-DEV-269",
    labels: ['Improvement'],
    description: '',
  }
  const bug: Issue = {
    id: 'DEV-950',
    title: 'The refusal names the wrong label',
    labels: ['Bug'],
    description: 'Since DEV-1 merged, the refusal says `spec` where it means `signed-off`.',
  }
  const notBug: Issue = {
    id: 'DEV-951',
    title: 'Rename it',
    labels: ['Improvement'],
    description: '',
  }
  const retro = await second.again({
    args: ['retro', SPEC],
    issues: [signedOff, followUp],
    tickets: [ticket('DEV-1', { status: DONE }), parked('DEV-2')],
    script: {
      commentsOf: { 'DEV-2': [REPLY] },
      prComments: { 42: prComments },
      related: { 'DEV-1': [bug, notBug] },
      ...more,
    },
  })
  return { first, second, retro, parkNote, bundle: readFileSync(bundlePath(retro.repoDir), 'utf8') }
}

describe('pnpm factory retro, on a finished spec', () => {
  test('writes .factory/retros/<spec>/bundle.md, outside git status, and says where', async () => {
    const { retro } = await twoRunsThenRetro()
    expect(retro.code).toBe(0)
    expect(retro.output).toContain(bundlePath(retro.repoDir))
    expect(readFileSync(join(retro.repoDir, '.factory', '.gitignore'), 'utf8')).toBe('*\n')
  })

  test("holds each Run's steps and times, cost per step, fix rounds, verdicts and replays", async () => {
    const { bundle, first, second } = await twoRunsThenRetro()
    expect(second.runDir).not.toBe(first.runDir)
    expect(bundle).toContain(`### Run ${basename(first.runDir)}`)
    expect(bundle).toContain(`### Run ${basename(second.runDir)}`)
    expect(bundle).toContain(`Run log: ${first.runDir}`)
    expect(bundle).toContain(`Run log: ${second.runDir}`)
    // Steps, with when each started and finished.
    expect(bundle).toMatch(
      /\| claim \| In Progress \| 2026-11-\d\dT[\d:.]+Z \| 2026-11-\d\dT[\d:.]+Z \| 1 s \|/,
    )
    expect(bundle).toContain('| rebase | onto origin/main, force-pushed |')
    // The Implementer's session: a million input tokens of Sonnet 5.5 at $2 a million.
    expect(bundle).toMatch(
      /\| implementer \| claude-sonnet-5-5 \| medium \| [^|]+ \| [^|]+ \| \$2\.00 \|/,
    )
    expect(bundle).toMatch(
      /\| fix-round-2 \| claude-opus-5-5 \| high \| [^|]+ \| [^|]+ \| no session to cost \|/,
    )
    expect(bundle).toContain('2 fix rounds')
    expect(bundle).toContain('| 2 | 1 | pass | judgement: src/a.ts: A clearer name. |')
    expect(bundle).toContain('| 2 | AC-1.2 | yes |')
    expect(bundle).toContain('#### DEV-2 Ticket DEV-2: parked')
  })

  test("holds each Run's usage-limit pauses and crashes", async () => {
    const first = await run([SPEC, '--only', 'DEV-1'], [signedOff], {
      tickets: [ticket('DEV-1'), ticket('DEV-2')],
    })
    // A pause as DEV-286 logs it in run.json, and a host that died before the Run finished.
    const file = join(first.runDir, 'run.json')
    const record = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    writeFileSync(
      file,
      JSON.stringify({
        ...record,
        finishedAt: null,
        resumedAt: ['2026-11-27T15:00:00.000Z'],
        pauses: [
          {
            ticket: 'DEV-1',
            step: 'implementer',
            at: '2026-11-27T14:10:00.000Z',
            until: '2026-11-27T14:40:00.000Z',
            resetGiven: true,
            message: '429: usage limit reached',
          },
        ],
      }),
    )
    // A Run whose ticket's turn threw.
    const second = await first.again({
      args: [SPEC, '--only', 'DEV-2'],
      tickets: [ticket('DEV-1', { status: DONE }), ticket('DEV-2')],
      script: { trackerThrows: 'setStatus' },
    })
    const retro = await second.again({
      args: ['retro', SPEC],
      tickets: [ticket('DEV-1', { status: DONE }), parked('DEV-2')],
    })
    const bundle = readFileSync(bundlePath(retro.repoDir), 'utf8')
    expect(bundle).toContain(
      '| DEV-1 | implementer | 2026-11-27T14:10:00.000Z | 2026-11-27T14:40:00.000Z | yes | 429: usage limit reached |',
    )
    expect(bundle).toContain('never finished')
    expect(bundle).toContain('took it up again at 2026-11-27T15:00:00.000Z')
    expect(bundle).toContain("DEV-2's turn ended without an outcome")
  })

  test("holds each park note, the maintainer's reply and how the ticket came back", async () => {
    const claim = {
      body: '🏭 Factory: Claimed by factory Run `2026-11-27-1900-DEV-269`.',
      createdAt: '2026-11-28T01:00:00.000Z',
    }
    const { bundle, parkNote } = await twoRunsThenRetro()
    const firstLine = parkNote.split('\n')[0] ?? ''
    expect(bundle).toContain(`> ${firstLine}`)
    expect(bundle).toContain('> Use the fixture in apps/api instead.')
    expect(bundle).toContain("How it came back: it hasn't: it's still parked.")

    const { bundle: cameBack } = await twoRunsThenRetro({
      commentsOf: {
        'DEV-2': [
          REPLY,
          claim,
          { body: 'A note after it came back.', createdAt: '2026-11-28T02:00:00.000Z' },
        ],
      },
    })
    expect(cameBack).toContain(
      'How it came back: factory Run `2026-11-27-1900-DEV-269` took it up again at 2026-11-28T01:00:00.000Z.',
    )
    expect(cameBack).not.toContain('A note after it came back.')
  })

  test("holds the Reviewer's PR comments and the follow-up issues", async () => {
    const { bundle } = await twoRunsThenRetro()
    expect(bundle).toMatch(
      /- DEV-1 Ticket DEV-1, 2026-11-27T14:30:00\.000Z: https:\/\/github\.com\/o\/r\/pull\/42#issuecomment-\d/,
    )
    // Only the Reviewer's: not the factory's other comments, nor anyone else's.
    expect(bundle).not.toContain('@jobanmendpara')
    expect(bundle).not.toContain('Looks good to me.')
    expect(bundle).toContain("> 🏭 Factory: the Reviewer's verdict is **pass**.")
    expect(bundle).toContain(
      "- DEV-900 The Reviewer's judgement calls from factory Run 2026-11-27-1405-DEV-269, from Run 2026-11-27-1405-DEV-269",
    )
  })

  test('holds the CI failure logs and the rebases', async () => {
    const { bundle, first } = await twoRunsThenRetro()
    expect(bundle).toContain(join(first.runDir, 'DEV-1', 'fix-round-2', 'ci.log'))
    expect(bundle).toContain('AssertionError: expected 1 to be 2')
    expect(bundle).toMatch(/- DEV-1, Run \S+, \S+Z: onto origin\/main, force-pushed/)
  })

  test('holds the CI failure that parked a ticket after its fix rounds', async () => {
    const first = await run([SPEC], [signedOff], {
      tickets: [ticket('DEV-1')],
      script: { waits: [1, 1, 1], ciLog: 'ci: FAIL the third time\nAssertionError: still 1' },
    })
    expect(first.output).toContain('- DEV-1 Ticket DEV-1: parked')
    const retro = await first.again({ args: ['retro', SPEC], tickets: [parked('DEV-1')] })
    const bundle = readFileSync(bundlePath(retro.repoDir), 'utf8')
    expect(bundle).toContain(`which parked it: ${join(first.runDir, 'DEV-1', 'ci.log')}`)
    expect(bundle).toContain('ci: FAIL the third time')
  })

  test('names a run.json it can’t read, and gathers the rest', async () => {
    const first = await run([SPEC], [signedOff], { tickets: [ticket('DEV-1')] })
    const broken = join(first.repoDir, '.factory', 'runs', `2026-11-27-1600-${SPEC}`, 'run.json')
    mkdirSync(join(broken, '..'), { recursive: true })
    writeFileSync(broken, '{"runId": "half')
    const retro = await first.again({
      args: ['retro', SPEC],
      tickets: [ticket('DEV-1', { status: DONE })],
    })
    expect(retro.code).toBe(0)
    const bundle = readFileSync(bundlePath(retro.repoDir), 'utf8')
    expect(bundle).toContain(`Not valid JSON, so left out: ${broken}`)
    expect(bundle).toContain(`### Run ${basename(first.runDir)}`)
  })

  test("holds a conflicting rebase's log", async () => {
    const first = await run([SPEC], [signedOff], {
      tickets: [ticket('DEV-1')],
      script: { waits: [4], rebase: 'conflicts' },
    })
    const retro = await first.again({ args: ['retro', SPEC], tickets: [parked('DEV-1')] })
    const bundle = readFileSync(bundlePath(retro.repoDir), 'utf8')
    expect(bundle).toContain(': conflicts with origin/main')
    expect(bundle).toContain(join(first.runDir, 'DEV-1', 'rebase.log'))
    expect(bundle).toContain('CONFLICT (content): Merge conflict in src/a.ts')
  })

  test("holds the Bug issues related to the spec's tickets, and no other issue", async () => {
    const { bundle } = await twoRunsThenRetro()
    expect(bundle).toContain('- DEV-950 The refusal names the wrong label, related to DEV-1')
    expect(bundle).toContain('> Since DEV-1 merged')
    expect(bundle).not.toContain('DEV-951')
  })

  test('names the session JSONL files by path only', async () => {
    const { bundle, first } = await twoRunsThenRetro()
    expect(bundle).toContain(`- ${join(first.runDir, 'DEV-1', 'agents', '01-implementer.jsonl')}`)
    expect(bundle).not.toContain('msg-1')
    expect(bundle).not.toContain('input_tokens')
  })

  test('holds excerpts, not whole comments', async () => {
    const long = `${'The fixture is wrong. '.repeat(100)}THE END`
    const { bundle } = await twoRunsThenRetro({
      commentsOf: { 'DEV-2': [{ ...REPLY, body: long }] },
    })
    expect(bundle).toContain('> The fixture is wrong. The fixture is wrong.')
    expect(bundle).not.toContain('THE END')
  })

  test('counts a Canceled ticket as finished', async () => {
    const result = await run(['retro', SPEC], [signedOff], {
      tickets: [ticket('DEV-1', { status: DONE }), ticket('DEV-2', { status: CANCELED })],
    })
    expect(result.code).toBe(0)
    expect(existsSync(bundlePath(result.repoDir))).toBe(true)
  })
})

describe('pnpm factory retro calls no agent or model', () => {
  test('it makes no sandbox, runs no agent, writes nothing to Linear or GitHub and notifies nobody', async () => {
    const { retro } = await twoRunsThenRetro()
    expect(retro.code).toBe(0)
    // It read Linear and GitHub, with the App's token for GitHub, and did nothing else.
    expect(calls(retro.events, 'forge', 'prComments')).not.toEqual([])
    const reads = (event: Event) =>
      (event.port === 'tracker' && /^get/.test(event.method)) ||
      (event.port === 'forge' && event.method === 'prComments') ||
      (event.port === 'github' && event.method === 'mintToken')
    expect(retro.events.filter((event) => !reads(event))).toEqual([])
  })

  test('it needs no Claude credential', async () => {
    const result = await run(['retro', SPEC], [signedOff], {
      layout: { sandcastleEnv: null },
      tickets: [ticket('DEV-1', { status: DONE })],
    })
    expect(result.code).toBe(0)
    expect(existsSync(bundlePath(result.repoDir))).toBe(true)
  })
})

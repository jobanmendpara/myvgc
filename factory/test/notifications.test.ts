// Tests what interrupts the maintainer (DEV-287): a macOS notification for an exit-5 wait, a park,
// a crash and the Run's end, and an @mention in the PR comment for an exit-5 wait or a park. A
// merge and the follow-up issue only show in the summary. Through `pnpm factory <spec> --only DEV-M`
// with fake ports (test/harness.ts); a crash's notification comes from what factory() throws,
// which src/cli.ts hands to crashNotification().
import { describe, expect, test } from 'vitest'
import { crashNotification } from '../src/notify.ts'
import { type Event, review, RUN_ID, run, type Script, SPEC, signedOff, ticket } from './harness.ts'

const TITLE = 'Show the Team page'
const TICKET = ticket('DEV-2', { title: TITLE })
const TICKET_URL = 'https://linear.app/mendpara/issue/DEV-2'
const PR_URL = 'https://github.com/o/r/pull/42'

function workDev2(script: Script = {}) {
  return run([SPEC, '--only', 'DEV-2'], [signedOff], { tickets: [TICKET], script })
}

const prComments = (events: Event[]) =>
  events.flatMap((event) =>
    event.port === 'forge' && event.method === 'commentOnPr'
      ? [event.args as [number, string]]
      : [],
  )
const indexOf = (events: Event[], found: (event: Event) => boolean) => events.findIndex(found)

describe('a ticket event', () => {
  test('notifies an exit-5 wait with the ticket title and the PR', async () => {
    const result = await workDev2({ waits: [5] })
    expect(result.notifications[0]).toEqual({
      text: `🏭 ${TITLE}: waiting for \`approved\`, since the PR changes a risky path`,
      link: PR_URL,
    })
  })

  test('notifies a park with the reason and the draft PR', async () => {
    const failed = review('fail')
    const result = await workDev2({ reviewer: [failed, failed, failed] })
    expect(result.notifications[0]).toEqual({
      text: `🏭 ${TITLE}: parked, as the push gate failed after 2 fix rounds: the Reviewer failed it`,
      link: PR_URL,
    })
  })

  test('links the Linear ticket when a park has no PR', async () => {
    const result = await workDev2({ install: 1 })
    expect(result.notifications[0]?.link).toBe(TICKET_URL)
    expect(result.notifications[0]?.text).toMatch(new RegExp(`^🏭 ${TITLE}: parked, as `))
  })

  test('names the ticket by its title, never by its ID alone', async () => {
    const results = await Promise.all([workDev2({ waits: [5] }), workDev2({ install: 1 })])
    for (const result of results) {
      const [notification] = result.notifications
      expect(notification?.text).toContain(TITLE)
      expect(notification?.text).not.toContain('DEV-2')
    }
  })

  test('@mentions the maintainer on the PR waiting for `approved`, after the wait', async () => {
    const { events } = await workDev2({ waits: [5] })
    const mention = prComments(events).find(([, body]) => body.includes('@jobanmendpara'))
    expect(mention?.[0]).toBe(42)
    expect(mention?.[1]).toContain('`approved`')
    const waited = indexOf(events, (event) => event.method === 'waitForChecks')
    const commented = events.findLastIndex((event) => event.method === 'commentOnPr')
    expect(commented).toBeGreaterThan(waited)
  })

  test("@mentions the maintainer on a parked ticket's draft PR", async () => {
    const failed = review('fail')
    const { events } = await workDev2({ reviewer: [failed, failed, failed] })
    const mention = prComments(events).find(([, body]) => body.includes('@jobanmendpara'))
    expect(mention?.[0]).toBe(42)
    expect(mention?.[1]).toContain('parked')
  })
})

describe("the Run's end", () => {
  test('notifies the counts and the cost, with the run log', async () => {
    const result = await workDev2({ waits: [5] })
    expect(result.notifications.at(-1)).toEqual({
      text: `🏭 Run ${RUN_ID} done: 0 merged, 0 parked, 1 waiting for approval, $0.00`,
      link: result.runDir,
    })
  })

  test('is the only notification of a merge with a follow-up issue', async () => {
    const findings = [{ severity: 'judgement', file: 'src/a.ts', summary: 'A clearer name.' }]
    const result = await workDev2({ reviewer: review('pass', undefined, findings) })
    expect(result.output).toContain('Follow-up issue')
    expect(result.output).toContain('- DEV-2 Show the Team page: merged')
    expect(result.notifications).toEqual([
      {
        text: `🏭 Run ${RUN_ID} done: 1 merged, 0 parked, 0 waiting for approval, $0.00`,
        link: result.runDir,
      },
    ])
  })
})

describe('the end of a Run of the whole frontier', () => {
  test('notifies once for all its tickets, and not for each merge', async () => {
    const result = await run([SPEC], [signedOff], { tickets: [ticket('DEV-1'), TICKET] })
    expect(result.notifications).toEqual([
      {
        text: `🏭 Run ${RUN_ID} done: 2 merged, 0 parked, 0 waiting for approval, $0.00`,
        link: result.runDir,
      },
    ])
  })
})

describe('a crash', () => {
  test('notifies the Run and where it crashed, saying to run the same command', async () => {
    const result = await workDev2({ waits: [5], trackerThrows: 'setAgentLabel' })
    expect(result.code).toBeNull()
    expect(crashNotification(result.thrown)).toEqual({
      text: `🏭 Run ${RUN_ID} crashed at ${TITLE} (DEV-2), after close sandbox: run the same command to resume`,
      link: result.runDir,
    })
  })

  test('names a ticket that crashed before its first step', async () => {
    const result = await workDev2({ trackerThrows: 'setStatus' })
    expect(crashNotification(result.thrown).text).toBe(
      `🏭 Run ${RUN_ID} crashed at ${TITLE} (DEV-2), before its first step: run the same command to resume`,
    )
  })

  test("sends no notification of the Run's end", async () => {
    const result = await workDev2({ trackerThrows: 'setStatus' })
    expect(result.notifications).toEqual([])
  })

  test('names the ticket whose turn threw, while another is in flight', async () => {
    // DEV-1 can't start, so it parks and Linear turns its label down; DEV-2, after it, merges.
    const dev1 = ticket('DEV-1', { title: 'Read a paste', description: 'No covers line.' })
    const result = await run([SPEC], [signedOff], {
      tickets: [dev1, TICKET],
      script: { trackerThrows: 'setAgentLabel' },
    })
    expect(result.output).toContain(`- DEV-2 ${TITLE}: merged`)
    expect(crashNotification(result.thrown).text).toBe(
      `🏭 Run ${RUN_ID} crashed at Read a paste (DEV-1), before its first step: run the same command to resume`,
    )
  })

  test('before a Run starts, says so', async () => {
    const result = await workDev2({ trackerThrows: 'getIssue' })
    expect(crashNotification(result.thrown).text).toBe(
      `🏭 pnpm factory crashed before its Run started: run the same command to resume`,
    )
  })
})

// What interrupts the maintainer (DEV-259, DEV-287): a macOS notification for an exit-5 wait, a
// park, a crash and the Run's end, and nothing else. A merge, a 429 pause and the follow-up issue
// only show in the summary. Each text starts with 🏭 and names a ticket by its title.
import { execFile } from 'node:child_process'
import type { RunLog } from './runlog.ts'
import type { Notification, Notifier, Ticket } from './ports.ts'

/** A ticket event: an exit-5 wait or a park. It links the PR, or the ticket when there's none. */
export const ticketNotification = (ticket: Ticket, what: string, pr?: string): Notification => ({
  text: `🏭 ${ticket.title}: ${what}`,
  link: pr ?? ticket.url,
})

/**
 * What factory() throws when a Run crashes after it started: the error, and where the Run was, for
 * the wrapper in src/cli.ts to notify.
 */
export class RunCrash extends Error {
  readonly runId: string
  /** The ticket and step the Run was at, such as "Show the Team page (DEV-2), after claim". */
  readonly at: string
  readonly runDir: string

  constructor(log: RunLog, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause })
    this.name = 'RunCrash'
    this.runId = log.runId
    this.runDir = log.dir
    // The turns in flight beside the one that threw finish first (src/slots.ts), so the ticket
    // without an outcome is the one that crashed. With none, reading the frontier threw.
    const ticket = log.tickets.find((each) => each.outcome === null)
    const step = ticket?.steps.at(-1)?.step
    this.at = ticket
      ? `${ticket.title} (${ticket.id}), ${step ? `after ${step}` : 'before its first step'}`
      : log.tickets.length > 0
        ? 'reading the frontier again'
        : 'its start'
  }
}

/** The crash notification for what `pnpm factory` threw. */
export function crashNotification(error: unknown): Notification {
  const resume = 'run the same command to resume'
  if (error instanceof RunCrash) {
    return {
      text: `🏭 Run ${error.runId} crashed at ${error.at}: ${resume}`,
      link: error.runDir,
    }
  }
  return { text: `🏭 pnpm factory crashed before its Run started: ${resume}` }
}

/**
 * The real Notifier: `osascript`'s `display notification`. The text goes in as an argument, never
 * into the script, so a ticket title can't inject AppleScript. Thin on purpose, and not
 * unit-tested; off macOS, or when it fails, nothing shows and the Run goes on.
 */
export const macNotifier: Notifier = {
  notify: ({ text, link }) =>
    new Promise((resolve) => {
      execFile(
        'osascript',
        [
          '-e',
          'on run argv',
          '-e',
          'display notification (item 1 of argv) with title "MyVGC factory" subtitle (item 2 of argv)',
          '-e',
          'end run',
          text,
          link ?? '',
        ],
        () => resolve(),
      )
    }),
}

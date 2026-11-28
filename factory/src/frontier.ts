// A spec's frontier: the tickets a Run may take now (How a factory Run works, DEV-253).
import type { Status, Ticket } from './ports.ts'
import type { TicketOutcome } from './run.ts'

/**
 * Why the factory may not take this ticket now, or nothing when it may. A ticket is takeable when
 * it is open and not started (In Progress and In Review are started), labelled `ready-for-agent`,
 * not labelled `needs-human`, and blocked only by Done tickets (a Canceled blocker still blocks).
 */
export function whyNotTakeable(ticket: Ticket): string[] {
  const reasons: string[] = []
  const { status, labels } = ticket
  if (!['triage', 'backlog', 'unstarted'].includes(status.type)) reasons.push(`it's ${status.name}`)
  if (!labels.includes('ready-for-agent')) reasons.push("it isn't labelled `ready-for-agent`")
  if (labels.includes('needs-human')) reasons.push("it's labelled `needs-human`")
  for (const blocker of ticket.blockedBy) {
    if (blocker.status.type !== 'completed') {
      reasons.push(`it's blocked by ${blocker.id}, which is ${blocker.status.name}`)
    }
  }
  return reasons
}

/**
 * The takeable tickets, in Linear's manual order of the spec's sub-issues. A ticket whose PR
 * merged in this Run (`mergedInRun`) counts as Done to the tickets it blocks, even before Linear
 * closes it: the PR's "Closes" does that, a moment later.
 */
export function frontier(
  tickets: Ticket[],
  mergedInRun: ReadonlySet<string> = new Set(),
): Ticket[] {
  return tickets
    .map((ticket) => ({
      ...ticket,
      blockedBy: ticket.blockedBy.map((blocker) =>
        mergedInRun.has(blocker.id) ? { ...blocker, status: MERGED } : blocker,
      ),
    }))
    .filter((ticket) => whyNotTakeable(ticket).length === 0)
    .sort((a, b) => a.order - b.order)
}

const MERGED: Status = { name: 'Done', type: 'completed' }

/**
 * Whether the ticket is parked for the maintainer: labelled `needs-human` and not started, as a
 * park leaves it. A PR waiting for `approved` is In Review with `needs-human`, so it isn't.
 */
export const isParked = ({ labels, status }: Ticket) =>
  labels.includes('needs-human') && !['started', 'completed', 'canceled'].includes(status.type)

/**
 * The tickets that keep a spec from being done (DEV-288): every one that is still open (not Done
 * or Canceled) and not parked. `ranInRun` is how this Run's turns ended, which Linear may not show
 * yet: a merge counts as Done, since the PR's "Closes" closes the ticket, and a park as parked.
 */
export function stillOpen(
  tickets: Ticket[],
  ranInRun: ReadonlyMap<string, TicketOutcome | null> = new Map(),
): Ticket[] {
  return tickets
    .filter((ticket) => {
      if (ranInRun.has(ticket.id)) {
        const outcome = ranInRun.get(ticket.id)
        return outcome !== 'merged' && outcome !== 'parked'
      }
      const { type } = ticket.status
      return type !== 'completed' && type !== 'canceled' && !isParked(ticket)
    })
    .sort((a, b) => a.order - b.order)
}

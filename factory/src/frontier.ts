// A spec's frontier: the tickets a Run may take now (How a factory Run works, DEV-253).
import type { Status, Ticket } from './ports.ts'

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

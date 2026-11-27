// A spec's frontier: the tickets a Run may take now (How a factory Run works, DEV-253).
import type { Ticket } from './ports.ts'

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

/** The takeable tickets, in Linear's manual order of the spec's sub-issues. */
export function frontier(tickets: Ticket[]): Ticket[] {
  return tickets
    .filter((ticket) => whyNotTakeable(ticket).length === 0)
    .sort((a, b) => a.order - b.order)
}

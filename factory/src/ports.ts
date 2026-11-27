// The factory's ports: the outside world the Run engine talks to. Tests pass fakes; src/cli.ts
// passes the real adapters. Each later ticket of DEV-269 adds the port it needs (Forge, Sandboxes,
// Notifier, Clock, Run store), so none is declared before something uses it.

/** A Linear issue, as much of it as the factory reads. */
export interface Issue {
  /** The identifier, such as DEV-269. */
  id: string
  title: string
  labels: string[]
}

/** Linear's kinds of workflow state, whatever each team calls its statuses. */
export const STATUS_TYPES = [
  'triage',
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
] as const
export type StatusType = (typeof STATUS_TYPES)[number]

export interface Status {
  /** The team's name for it, such as "In Progress" or "Done". */
  name: string
  type: StatusType
}

/** An issue that blocks a ticket. */
export interface Blocker {
  id: string
  status: Status
}

/** A sub-issue of a spec. */
export interface Ticket extends Issue {
  status: Status
  /** The issues that block it, with their statuses. */
  blockedBy: Blocker[]
  /** Its place in Linear's manual order of the spec's sub-issues, lower first. */
  order: number
}

/** Linear. */
export interface Tracker {
  /** The issue with this identifier, or null when Linear has none. */
  getIssue(id: string): Promise<Issue | null>
  /** The issue's direct sub-issues, in any order. */
  getSubIssues(id: string): Promise<Ticket[]>
}

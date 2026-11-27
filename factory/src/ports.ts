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

/** Linear. */
export interface Tracker {
  /** The issue with this identifier, or null when Linear has none. */
  getIssue(id: string): Promise<Issue | null>
}

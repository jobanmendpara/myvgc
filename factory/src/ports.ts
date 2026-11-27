// The factory's ports: the outside world the Run engine talks to. Tests pass fakes; src/cli.ts
// passes the real adapters. Each later ticket of DEV-269 adds the port it needs (a Notifier, a
// Clock that can sleep, a Run store), so none is declared before something uses it. Telling the
// time is FactoryPorts' `now`.

/** The GitHub App the factory pushes and opens PRs as (DEV-271). */
export interface GitHubApp {
  /** Path to the App's private key. */
  keyPath: string
  appId: string
  installationId: string
}

/** Who a commit is by. */
export interface GitIdentity {
  name: string
  email: string
}

/** pnpm's store inside a sandbox: outside the worktree, so `pnpm install` makes none in it. */
export const STORE_DIR = '/home/agent/.local/share/pnpm/store'

/** A Linear issue, as much of it as the factory reads. */
export interface Issue {
  /** The identifier, such as DEV-269. */
  id: string
  title: string
  labels: string[]
  /** The description, in Markdown. */
  description: string
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
  /** Linear's suggested branch name, such as jobanmendpara/dev-273-…, which links the PR. */
  branch: string
}

/** The statuses the factory moves a ticket to. It never sets Done: the PR's "Closes" does. */
export type FactoryStatus = 'In Progress' | 'In Review'

/** Linear. */
export interface Tracker {
  /** The issue with this identifier, or null when Linear has none. */
  getIssue(id: string): Promise<Issue | null>
  /** The issue's direct sub-issues, in any order. */
  getSubIssues(id: string): Promise<Ticket[]>
  setStatus(id: string, status: FactoryStatus): Promise<void>
  comment(id: string, body: string): Promise<void>
}

/** GitHub, as the `myvgc-factory` App. Only the host talks to it: sandboxes have no credentials. */
export interface Forge {
  /**
   * The App's bot user, who factory commits are by. Asking mints the installation token, so a Run
   * asks first, before it claims anything, and a broken App key stops it there.
   */
  botIdentity(): Promise<GitIdentity>
  /** Pushes the branch checked out in the worktree at `cwd`. */
  push(cwd: string, branch: string): Promise<void>
  openPr(pr: {
    branch: string
    title: string
    body: string
  }): Promise<{ number: number; url: string }>
  commentOnPr(pr: number, body: string): Promise<void>
  /** Queues the merge for when the checks pass (`gh pr merge --auto --merge --delete-branch`). */
  queueAutoMerge(pr: number): Promise<void>
  /** Runs `scripts/wait-for-checks.sh` once and returns its exit code. */
  waitForChecks(pr: number): Promise<number>
}

export interface ExecResult {
  exitCode: number
  stdout: string
  stderr: string
}

export type Effort = 'low' | 'medium' | 'high' | 'xhigh'

/** One agent step of a Run (src/settings.ts gives its model and effort). */
export interface AgentStep {
  /** A name for the logs, such as "implementer". */
  name: string
  model: string
  effort: Effort
  prompt: string
  idleTimeoutSeconds: number
}

/** One ticket's Docker sandbox, on a git worktree of its branch. */
export interface Sandbox {
  /** The worktree's path on the host. */
  worktreePath: string
  /** Runs a shell command in the sandbox's checkout. A non-zero exit is returned, not thrown. */
  exec(command: string, options?: { stdin?: string }): Promise<ExecResult>
  /** Runs an agent in a fresh session and returns what it printed. */
  runAgent(step: AgentStep): Promise<{ stdout: string }>
  close(): Promise<void>
}

export interface Sandboxes {
  /**
   * Fetches `base` and makes a worktree on `branch` (forked from `base` when the branch doesn't
   * exist yet) and a sandbox on it. `env` is the only credential its agents get: the Claude one.
   * Commits made in it are by `author`, set for the sandbox alone, never in the shared git config.
   */
  create(options: {
    branch: string
    base: string
    env: Record<string, string>
    author: GitIdentity
  }): Promise<Sandbox>
}

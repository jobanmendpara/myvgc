// Runs `pnpm factory` through its command entry, factory(), with fake ports and real temporary
// folders standing in for the checkout (.sandcastle/.env, the workspace, .factory/) and
// ~/.config/myvgc-factory. Every port call lands in one ordered list of events, so a test can check
// both what the factory did and in which order.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import { factory } from '../src/factory.ts'
import type {
  AgentStep,
  Comment,
  ExecResult,
  Forge,
  Issue,
  Sandbox,
  Sandboxes,
  Status,
  Ticket,
  Tracker,
} from '../src/ports.ts'

export const SPEC = 'DEV-269'

/** What the temporary folders hold. */
export interface Layout {
  appKey?: boolean
  config?: Record<string, string>
  sandcastleEnv?: Record<string, string> | null
}

export const CONFIG = {
  GITHUB_APP_ID: '123',
  GITHUB_INSTALLATION_ID: '456',
  LINEAR_API_KEY: 'lin_api_x',
}
export const COMPLETE: Required<Layout> = {
  appKey: true,
  config: CONFIG,
  sandcastleEnv: { CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat-x' },
}

export const TODO: Status = { name: 'Todo', type: 'unstarted' }
export const BACKLOG: Status = { name: 'Backlog', type: 'backlog' }
export const IN_PROGRESS: Status = { name: 'In Progress', type: 'started' }
export const DONE: Status = { name: 'Done', type: 'completed' }
export const CANCELED: Status = { name: 'Canceled', type: 'canceled' }

export const CRITERIA = {
  'AC-1.1': 'Given a spec without `signed-off`, when it runs, then it refuses.',
  'AC-1.2': 'Given an issue without `spec`, when it runs, then it refuses.',
  'AC-2.1': 'Given a page, when it opens, then it shows the Team. (Seen)',
}

export const signedOff: Issue = {
  id: SPEC,
  title: 'Factory spec',
  labels: ['spec', 'signed-off', 'Chore'],
  description: [
    '## User Stories',
    '1. As the maintainer, I want refusals, so that nothing unapproved is built.',
    ...Object.entries(CRITERIA).map(([id, text]) => `   * **${id}** ${text}`),
  ].join('\n'),
}

let nextOrder = 0
/** A takeable ticket of the spec, covering AC-1.1 and AC-1.2, unless `changes` say otherwise. */
export function ticket(id: string, changes: Partial<Ticket> = {}): Ticket {
  return {
    id,
    title: `Ticket ${id}`,
    labels: ['ready-for-agent', 'Chore'],
    description: `## What to build\n\nThe refusals of ${id}.\n\n**Covers:** AC-1.1, AC-1.2`,
    status: TODO,
    blockedBy: [],
    order: nextOrder++,
    branch: `jobanmendpara/${id.toLowerCase()}-the-refusals`,
    ...changes,
  }
}

/** The frontier as `--dry-run` lists it: the identifiers on its numbered lines, in order. */
export function listed(output: string): string[] {
  return [...output.matchAll(/^\d+\. (\S+)/gm)].map((match) => match[1] ?? '')
}

/** How a sabotage's replay comes out. "suite error": one file fails on an assertion, another fails to load. */
export type ReplayOutcome =
  'caught' | 'load error' | 'suite error' | 'hook error' | 'passes' | 'stays broken'

/** What the fake sandbox and agents do. Anything not named succeeds. */
export interface Script {
  install?: number
  checks?: Partial<Record<'test' | 'typecheck' | 'lint' | 'format:check', number>>
  /** The Reviewer's stdout; by default a passing review of AC-1.1 and AC-1.2. */
  reviewer?: string | string[]
  /** What the Implementer wrote to the mapping file, or null for none. */
  mapping?: string | null
  /** How each criterion's replay comes out; by default every one is caught. */
  replays?: Record<string, ReplayOutcome>
  /** What the Implementer prints. */
  implementer?: string
  /** What each fix round prints, round by round. */
  fixRounds?: string[]
  /** Whether Sandcastle captures no session for the Implementer. */
  noSession?: boolean
  /** The ticket's Linear comments, oldest first. */
  comments?: Comment[]
  /** Whether GitHub turns down the push for changing workflow files. */
  workflowsRefused?: boolean
  /** The Implementer's commits since origin/main; 1 by default. */
  commits?: number
  /** scripts/wait-for-checks.sh's exit codes, call by call. */
  waits?: number[]
  /** The files the branch changes since origin/main; none by default. */
  changedFiles?: string[]
  /** What `pnpm accuracy` prints on each checkout; by default a summary naming the checkout. */
  accuracy?: Partial<Record<'base' | 'branch', string>>
  /** Which checkout for `pnpm accuracy` fails, if one does. */
  checkoutFails?: 'base' | 'branch'
  /** The failed CI checks' logs, as the Forge reads them after an exit 1. */
  ciLog?: string
  /** How `git rebase origin/main` goes after an exit 4; clean by default. */
  rebase?: 'clean' | 'conflicts'
  /**
   * The session JSONL each agent step hands back, by step name (implementer, reviewer,
   * fix-round-1, …); a list gives each run of that step its own, the last one repeating. A step
   * with none hands back no session.
   */
  sessions?: Record<string, string | string[]>
  /** A Tracker method that throws, as Linear does when it's down or turns a write down. */
  trackerThrows?: string
}

/** What `git rev-parse HEAD` prints in the fake sandbox: the branch as it was pushed. */
export const PUSHED_HEAD = '0123456789abcdef0123456789abcdef01234567'

/** The commit `git merge-base origin/main HEAD` gives in the fake sandbox. */
export const BASE_COMMIT = 'b45e0000c0ffee'

/** What `pnpm accuracy` prints: its run lines, its summary, and the report it wrote. */
export const accuracyOutput = (checkout: string, passed: number) =>
  [
    `PASS sun-charizard moves (jpeg): 1200 in, 300 out, $0.01, 4 s on ${checkout}`,
    `Reading accuracy, claude-haiku-5-5: ${passed} of 4 passed, $0.04 in all`,
    `  PASS  sun-charizard moves (jpeg)    0 differences  on ${checkout}`,
    `Report: /home/agent/repo/apps/api/.accuracy/${checkout}.json`,
  ].join('\n')

/** One assistant message's usage, as a session JSONL line records it. */
export interface Usage {
  input?: number
  output?: number
  cacheRead?: number
  cacheWrite5m?: number
  cacheWrite1h?: number
}

let blocks = 0
/**
 * A line of a Claude Code session JSONL: one content block of the API message `id`. A message
 * with several blocks is written as several lines, each repeating the message's usage.
 */
export function sessionLine(id: string, model: string, usage: Usage): string {
  const { input = 0, output = 0, cacheRead = 0, cacheWrite5m = 0, cacheWrite1h = 0 } = usage
  return JSON.stringify({
    type: 'assistant',
    uuid: `${id}-${blocks++}`,
    message: {
      id,
      model,
      role: 'assistant',
      usage: {
        input_tokens: input,
        output_tokens: output,
        cache_read_input_tokens: cacheRead,
        cache_creation_input_tokens: cacheWrite5m + cacheWrite1h,
        cache_creation: {
          ephemeral_5m_input_tokens: cacheWrite5m,
          ephemeral_1h_input_tokens: cacheWrite1h,
        },
      },
    },
  })
}

/** A session JSONL from its lines, with the user and system lines a real one holds between. */
export const session = (...lines: string[]) =>
  [
    JSON.stringify({ type: 'user', uuid: 'u', message: { role: 'user', content: 'Go.' } }),
    ...lines,
    JSON.stringify({ type: 'system', uuid: 's', content: 'done' }),
  ].join('\n') + '\n'

/** A sabotage patch whose text names its criterion, so the fake sandbox knows which one is applied. */
export const sabotageOf = (id: string) =>
  `--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-ok\n+broken ${id}\n`
export const testCommandOf = (id: string) =>
  `pnpm --filter @myvgc/core exec vitest run test/${id}.test.ts`

export function review(
  verdict: 'pass' | 'fail' = 'pass',
  ids = ['AC-1.1', 'AC-1.2'],
  findings: unknown[] = [],
): string {
  const criteria = ids.map((id) => ({
    id,
    kind: 'tested',
    test: `test/${id}.test.ts › ${id}`,
    testCommand: testCommandOf(id),
    sabotagePatch: sabotageOf(id),
  }))
  return `Reviewed.\n<review>${JSON.stringify({ verdict, criteria, findings })}</review>`
}

const vitestReport = (outcome: ReplayOutcome) =>
  JSON.stringify(
    outcome === 'hook error'
      ? {
          numFailedTests: 1,
          testResults: [
            {
              status: 'failed',
              message: 'Error: afterAll hook threw',
              assertionResults: [
                { status: 'failed', failureMessages: ['AssertionError: expected 1 to be 2'] },
              ],
            },
          ],
        }
      : outcome === 'suite error'
        ? {
            numFailedTests: 1,
            testResults: [
              {
                status: 'failed',
                message: '',
                assertionResults: [
                  { status: 'failed', failureMessages: ['AssertionError: expected 1 to be 2'] },
                ],
              },
              { status: 'failed', message: 'Failed to load y.ts', assertionResults: [] },
            ],
          }
        : outcome === 'caught' || outcome === 'stays broken'
          ? {
              numFailedTests: 1,
              testResults: [
                {
                  status: 'failed',
                  message: '',
                  assertionResults: [
                    { status: 'failed', failureMessages: ['AssertionError: expected 1 to be 2'] },
                  ],
                },
              ],
            }
          : outcome === 'load error'
            ? {
                numFailedTests: 0,
                testResults: [
                  { status: 'failed', message: 'Failed to load x.ts', assertionResults: [] },
                ],
              }
            : {
                numFailedTests: 0,
                testResults: [{ status: 'passed', message: '', assertionResults: [] }],
              },
  )

const folders: string[] = []
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

function envFile(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key}=${value}\n`)
    .join('')
}

/** One thing the factory did through a port. */
export type Event =
  | { port: 'tracker'; method: string; args: unknown[] }
  | { port: 'forge'; method: string; args: unknown[] }
  | { port: 'sandboxes'; method: 'create'; options: Parameters<Sandboxes['create']>[0] }
  | {
      port: 'sandbox'
      method: 'exec'
      command: string
      stdin?: string
      env?: Record<string, string>
      /** What the sandbox had checked out: the branch, or the commit a detached checkout named. */
      checkout: string
    }
  | { port: 'sandbox'; method: 'runAgent'; step: AgentStep }
  | { port: 'sandbox'; method: 'close' }

export const WORKTREE = '/host/repo/.sandcastle/worktrees/ticket'
export const NOW = new Date(2026, 10, 27, 14, 5)
export const RUN_ID = `2026-11-27-1405-${SPEC}`

/** Lays out the folders, runs factory() and records what it did. */
export async function run(
  args: string[],
  issues: Issue[],
  {
    layout = {},
    tickets = [],
    script = {},
  }: { layout?: Layout; tickets?: Ticket[]; script?: Script } = {},
) {
  const { appKey, config, sandcastleEnv } = { ...COMPLETE, ...layout }
  const root = mkdtempSync(join(tmpdir(), 'factory-'))
  folders.push(root)
  const repoDir = join(root, 'repo')
  const configDir = join(root, 'config')
  mkdirSync(join(repoDir, '.sandcastle'), { recursive: true })
  mkdirSync(configDir)
  if (appKey) writeFileSync(join(configDir, 'app.pem'), '-----BEGIN RSA PRIVATE KEY-----\n')
  if (Object.keys(config).length > 0) writeFileSync(join(configDir, 'config.env'), envFile(config))
  if (sandcastleEnv) writeFileSync(join(repoDir, '.sandcastle', '.env'), envFile(sandcastleEnv))
  writeWorkspace(repoDir)

  const events: Event[] = []
  // Records every call, including to methods later tickets add to the Tracker, so "reads the spec
  // and nothing else" keeps meaning something as the port grows.
  const tracker = new Proxy({} as Tracker, {
    get:
      (_, method: string) =>
      async (...callArgs: unknown[]) => {
        events.push({ port: 'tracker', method, args: callArgs })
        if (method === script.trackerThrows) throw new Error(`Linear answered 500 to ${method}`)
        if (method === 'getIssue') return issues.find((issue) => issue.id === callArgs[0]) ?? null
        if (method === 'getSubIssues') return callArgs[0] === SPEC ? tickets : []
        if (method === 'getComments') return script.comments ?? []
        if (method === 'createIssue') {
          return { id: 'DEV-900', url: 'https://linear.app/mendpara/issue/DEV-900' }
        }
      },
  })

  const waits = [...(script.waits ?? [0])]
  let nextPr = 41
  // One PR per branch, as on GitHub: opening it again brings the open one up to date.
  const prs = new Map<string, number>()
  const forge: Forge = {
    async botIdentity() {
      events.push({ port: 'forge', method: 'botIdentity', args: [] })
      return {
        name: 'myvgc-factory[bot]',
        email: '999+myvgc-factory[bot]@users.noreply.github.com',
      }
    },
    async push(cwd, branch, options) {
      events.push({
        port: 'forge',
        method: 'push',
        args: options ? [cwd, branch, options] : [cwd, branch],
      })
      return script.workflowsRefused ? 'workflows refused' : 'pushed'
    },
    async openPr(pr) {
      events.push({ port: 'forge', method: 'openPr', args: [pr] })
      const number = prs.get(pr.branch) ?? (nextPr += 1)
      prs.set(pr.branch, number)
      return { number, url: `https://github.com/o/r/pull/${number}` }
    },
    async failedCheckLogs(pr) {
      events.push({ port: 'forge', method: 'failedCheckLogs', args: [pr] })
      return (
        script.ciLog ?? 'check: FAIL test/a.test.ts > refuses\nAssertionError: expected 1 to be 2'
      )
    },
    maintainer() {
      return 'jobanmendpara'
    },
    async commentOnPr(pr, body) {
      events.push({ port: 'forge', method: 'commentOnPr', args: [pr, body] })
    },
    async queueAutoMerge(pr) {
      events.push({ port: 'forge', method: 'queueAutoMerge', args: [pr] })
    },
    async waitForChecks(pr) {
      events.push({ port: 'forge', method: 'waitForChecks', args: [pr] })
      return waits.shift() ?? 0
    },
  }

  const sandboxes: Sandboxes = {
    async create(options) {
      events.push({ port: 'sandboxes', method: 'create', options })
      return fakeSandbox(script, events, options.branch)
    },
  }

  const lines: string[] = []
  // A second passes between one reading of the clock and the next, so the Run's times differ.
  let ticks = 0
  // What factory() threw, if it did: a test of a crash still reads what it printed and wrote.
  let thrown: unknown
  const code = await factory(args, {
    repoDir,
    configDir,
    tracker: () => tracker,
    forge: () => forge,
    sandboxes,
    now: () => new Date(NOW.getTime() + 1000 * ticks++),
    print: (line) => lines.push(line),
  }).catch((error: unknown) => {
    thrown = error
    return null
  })
  const trackerCalls = events
    .filter((event) => event.port === 'tracker')
    .map((event) => `${event.method} ${event.args.join(' ')}`)
  return {
    code,
    thrown,
    output: lines.join('\n'),
    lines,
    events,
    trackerCalls,
    repoDir,
    runDir: join(repoDir, '.factory', 'runs', RUN_ID),
  }
}

/** A small workspace: @myvgc/api depends on @myvgc/core. */
function writeWorkspace(repoDir: string) {
  writeFileSync(join(repoDir, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n  - packages/*\n')
  for (const [folder, manifest] of [
    ['packages/core', { name: '@myvgc/core' }],
    ['apps/api', { name: '@myvgc/api', dependencies: { '@myvgc/core': 'workspace:*', hono: '4' } }],
  ] as const) {
    mkdirSync(join(repoDir, folder), { recursive: true })
    writeFileSync(join(repoDir, folder, 'package.json'), JSON.stringify(manifest))
  }
}

function fakeSandbox(script: Script, events: Event[], branch: string): Sandbox {
  /** The criterion whose sabotage is applied, if any. */
  let sabotaged: string | null = null
  let reviewers = 0
  let checkout = 'branch'
  /** How many times each agent step has run, to hand each its own session. */
  const sessionRuns: Record<string, number> = {}
  const ok = (stdout = ''): ExecResult => ({ exitCode: 0, stdout, stderr: '' })
  const exit = (exitCode: number, stdout = ''): ExecResult => ({ exitCode, stdout, stderr: '' })
  const outcomeOf = (id: string): ReplayOutcome => script.replays?.[id] ?? 'caught'
  return {
    worktreePath: WORKTREE,
    async exec(command, options) {
      events.push({
        port: 'sandbox',
        method: 'exec',
        command,
        stdin: options?.stdin,
        env: options?.env,
        checkout,
      })
      if (command.includes('pnpm install')) return exit(script.install ?? 0)
      if (command === 'git diff --name-only origin/main...HEAD') {
        return ok((script.changedFiles ?? []).map((file) => `${file}\n`).join(''))
      }
      if (command === 'git merge-base origin/main HEAD') return ok(`${BASE_COMMIT}\n`)
      const detached = /^git checkout --detach (\S+)$/.exec(command)?.[1]
      if (detached) {
        if (script.checkoutFails === 'base') return exit(1)
        checkout = detached
        return ok()
      }
      if (command === `git checkout ${branch}`) {
        if (script.checkoutFails === 'branch') return exit(1)
        checkout = 'branch'
        return ok()
      }
      if (command === 'pnpm accuracy') {
        const which = checkout === 'branch' ? 'branch' : 'base'
        return ok(script.accuracy?.[which] ?? accuracyOutput(checkout, which === 'base' ? 3 : 4))
      }
      if (command === 'git rev-list --count origin/main..HEAD')
        return ok(`${script.commits ?? 1}\n`)
      if (command === 'git rev-parse HEAD') return ok(`${PUSHED_HEAD}\n`)
      if (command === 'git rebase origin/main') {
        return script.rebase === 'conflicts'
          ? exit(1, 'CONFLICT (content): Merge conflict in src/a.ts')
          : ok()
      }
      const check = /^pnpm (test|typecheck|lint|format:check)$/.exec(command)?.[1]
      if (check) {
        const code = script.checks?.[check as keyof Script['checks'] & string] ?? 0
        return exit(code, `pnpm ${check} output`)
      }
      if (command.startsWith('git apply')) {
        sabotaged = /broken (AC-\d+\.\d+)/.exec(options?.stdin ?? '')?.[1] ?? null
        return ok()
      }
      if (command.startsWith('git checkout -- .')) {
        const undone = sabotaged
        sabotaged = null
        return undone && outcomeOf(undone) === 'stays broken' ? ok('still broken') : ok()
      }
      if (command.includes('replay.json') && command.startsWith('cat ')) {
        return ok(sabotaged ? vitestReport(outcomeOf(sabotaged)) : vitestReport('passes'))
      }
      if (command.startsWith('cat ') && command.includes('mapping.md')) {
        const mapping =
          script.mapping === undefined ? '| AC-1.1 | test/a.test.ts | refuses |' : script.mapping
        return mapping === null ? exit(1) : ok(mapping)
      }
      const replayed = /vitest run test\/(AC-\d+\.\d+)\.test\.ts$/.exec(command)?.[1]
      if (replayed) {
        // The test re-run once the sabotage is undone.
        return exit(outcomeOf(replayed) === 'stays broken' ? 1 : 0)
      }
      return ok()
    },
    async runAgent(step) {
      events.push({ port: 'sandbox', method: 'runAgent', step })
      const answer = answerOf(step)
      const sessions = [script.sessions?.[step.name] ?? []].flat()
      const text = sessions[Math.min(sessionRuns[step.name] ?? 0, sessions.length - 1)]
      sessionRuns[step.name] = (sessionRuns[step.name] ?? 0) + 1
      return text === undefined ? answer : { ...answer, session: text }
    },
    async close() {
      events.push({ port: 'sandbox', method: 'close' })
    },
  }
  function answerOf(step: AgentStep): { stdout: string; sessionId?: string } {
    if (step.name === 'reviewer') {
      // A list gives each Reviewer its own answer, the last one repeating.
      const answers = [script.reviewer ?? review()].flat()
      const answer = answers[Math.min(reviewers++, answers.length - 1)] ?? review()
      return { stdout: answer, sessionId: `reviewer-session-${reviewers}` }
    }
    if (step.name.startsWith('fix-round-')) {
      const answer = script.fixRounds?.[Number(step.name.slice('fix-round-'.length)) - 1]
      return { stdout: answer ?? 'Fixed.', sessionId: step.resumeSession }
    }
    return {
      stdout: script.implementer ?? 'Implemented.',
      sessionId: script.noSession ? undefined : 'implementer-session',
    }
  }
}

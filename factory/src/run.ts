// One ticket's way through a Run, from claim to merge (How a factory Run works, DEV-253). A ticket
// the factory can't finish is parked for the maintainer (DEV-279): Todo with `needs-human`, its
// branch on a draft PR, and a Linear comment saying why. When CI fails after the push, the Run
// stops and says so. Fix rounds and the rest come in later tickets of DEV-269.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Criterion } from './criteria.ts'
import {
  type Forge,
  type GitIdentity,
  type Sandbox,
  type Sandboxes,
  STORE_DIR,
  type Tracker,
} from './ports.ts'
import { implementerPrompt, MAPPING_FILE, reviewerPrompt, type TicketBrief } from './prompts.ts'
import { caughtByAssertion, lastTag, readReview, type Review, type ReviewRow } from './review.ts'
import { STEPS, type Step } from './settings.ts'

/** Longer than any command an agent runs silently (the spike, DEV-251, lesson 6). */
const IDLE_TIMEOUT_SECONDS = 1800
const REPLAY_REPORT = '/home/agent/factory/replay.json'
const CLEAN = 'git checkout -- . && git clean -fd'
/**
 * The only test commands a replay runs: a Vitest run in one workspace package. The Reviewer writes
 * them, so nothing else it could put there (another command, a redirect) reaches the shell.
 */
const TEST_COMMAND = /^pnpm --filter [@\w./-]+ exec vitest run [\w@./ '"*:-]+$/

/** The full checks the host runs itself (CI's commands), with no idle limit. */
const HOST_CHECKS = ['test', 'typecheck', 'lint', 'format:check'] as const

export interface RunContext {
  runId: string
  specId: string
  /** The Run's log folder, `.factory/runs/<id>/`. */
  runDir: string
  tracker: Tracker
  forge: Forge
  sandboxes: Sandboxes
  /** The environment sandboxes get: the Claude credential and nothing else. */
  sandboxEnv: Record<string, string>
  /** Who the sandbox's commits are by: the App's bot user, read when the Run started. */
  author: GitIdentity
  print: (line: string) => void
}

/** How a ticket's turn in a Run ended. */
export type TicketOutcome = 'merged' | 'parked' | 'stopped'

/** The note a park leaves on the ticket starts with this, which is how a later Run finds it. */
const PARKED = '🏭 Factory: Parked'

/**
 * Works one ticket to a merged PR, or parks it. `unstartable` says why it can't start at all, such
 * as a criterion the spec lacks: it is parked before any agent runs.
 */
export async function workTicket(
  context: RunContext,
  brief: TicketBrief,
  unstartable?: string,
): Promise<TicketOutcome> {
  const { tracker, forge, print } = context
  const { ticket } = brief
  const say = (step: string, result: string) =>
    print(`${ticket.id} ${ticket.title} · ${step}: ${result}`)
  const logDir = join(context.runDir, ticket.id)
  const parkHere = (reason: string, work?: Work) => park(context, brief, say, reason, work)

  if (unstartable) return parkHere(unstartable)
  const previousPark = await previousParkOf(tracker, ticket.id)
  if (previousPark) brief = { ...brief, previousPark }

  await tracker.setStatus(ticket.id, 'In Progress')
  await tracker.comment(ticket.id, `🏭 Factory: Claimed by factory Run \`${context.runId}\`.`)
  say('claim', 'In Progress')

  const sandbox = await context.sandboxes.create({
    branch: ticket.branch,
    base: 'origin/main',
    env: context.sandboxEnv,
    author: context.author,
  })
  let closed = false
  const close = async () => {
    if (closed) return
    closed = true
    await sandbox.close()
    say('close sandbox', 'closed')
  }
  try {
    const install = await sandbox.exec(
      // Where the Implementer writes the mapping table and the host its replay reports.
      `mkdir -p /home/agent/factory && pnpm install --frozen-lockfile --store-dir ${STORE_DIR}`,
    )
    if (install.exitCode !== 0) {
      writeLog(logDir, 'install.log', install.stdout + install.stderr)
      return await parkHere('`pnpm install` failed in the sandbox: see install.log in the run log')
    }
    say('worktree and install', `${ticket.branch}, installed`)

    const implementer = await sandbox.runAgent(agentStep('implementer', implementerPrompt(brief)))
    const commits = Number((await sandbox.exec('git rev-list --count origin/main..HEAD')).stdout)
    say('Implementer', `finished, ${commits} commit${commits === 1 ? '' : 's'}`)
    const parkSignal = lastTag(implementer.stdout, 'park')
    if (parkSignal) {
      return await parkHere(`the Implementer parked it: ${parkSignal}`, { sandbox, commits })
    }

    const checks = await hostChecks(sandbox, logDir)
    say('host checks', checks.passed ? 'all passed' : `failed: ${checks.failed.join(', ')}`)

    const reviewer = await sandbox.runAgent(
      agentStep('reviewer', reviewerPrompt(brief, checks.summary)),
    )
    const review = readReview(reviewer.stdout)
    say('Reviewer', review ? review.verdict : 'no readable <review>')

    const replays = review ? await replayAll(sandbox, review) : new Map<string, boolean>()
    const confirmed = [...replays.values()].filter(Boolean).length
    say('replay', `${confirmed} of ${replays.size} confirmed`)

    const gate = pushGate({ review, replays, checksPassed: checks.passed, commits }, brief.criteria)
    if (!review || gate.length > 0) {
      say('push gate', `failed: ${gate.join('; ')}`)
      return await parkHere(`the push gate failed: ${gate.join('; ')}`, {
        sandbox,
        commits,
        review,
        replays,
      })
    }
    say('push gate', 'passed')

    if ((await forge.push(sandbox.worktreePath, ticket.branch)) === 'workflows refused') {
      return await parkHere('the branch changes workflow files', {
        sandbox,
        commits,
        review,
        replays,
      })
    }
    const mapping = await sandbox.exec(`cat ${MAPPING_FILE}`)
    const pr = await forge.openPr({
      branch: ticket.branch,
      title: `${ticket.title} (${ticket.id})`,
      body: prBody(context, brief, mapping.exitCode === 0 ? mapping.stdout.trim() : ''),
      draft: false,
    })
    await forge.commentOnPr(pr.number, reviewComment(review, replays))
    await forge.queueAutoMerge(pr.number)
    await tracker.setStatus(ticket.id, 'In Review')
    say('push, PR and auto-merge', pr.url)
    await close()

    for (;;) {
      const code = await forge.waitForChecks(pr.number)
      if (code === 0) {
        say('wait for checks', 'merged')
        return 'merged'
      }
      // 2: still pending; 3: a gh error. Both mean wait again (scripts/wait-for-checks.sh).
      if (code !== 2 && code !== 3) {
        say('wait for checks', `exit ${code}; handling it comes with DEV-284`)
        return 'stopped'
      }
    }
  } finally {
    await close()
  }
}

/** What a ticket's sandbox holds when it parks. */
interface Work {
  sandbox: Sandbox
  commits: number
  review?: Review | null
  replays?: Map<string, boolean>
}

const WORKFLOWS_REFUSED =
  "GitHub turned the push down because the branch changes workflow files, which the factory's App may not push. The branch stays local, and that change has to be made by hand"

/**
 * Parks the ticket for the maintainer: its branch on a draft PR when it has commits, then Todo with
 * `needs-human` and a Linear comment with the reason, the last review and the run log.
 */
async function park(
  context: RunContext,
  { ticket }: TicketBrief,
  say: (step: string, result: string) => void,
  reason: string,
  work?: Work,
): Promise<'parked'> {
  const { tracker, forge } = context
  const rows = work?.review ? reviewRows(work.review, work.replays ?? new Map()) : []
  const verdict = work?.review ? `Last verdict: **${work.review.verdict}**.` : 'No review ran.'
  let pr: string
  if (!work || !(work.commits > 0)) {
    pr = 'No draft PR: the branch has no commits.'
  } else if ((await forge.push(work.sandbox.worktreePath, ticket.branch)) === 'workflows refused') {
    pr = `${WORKFLOWS_REFUSED}.`
  } else {
    const draft = await forge.openPr({
      branch: ticket.branch,
      title: `${ticket.title} (${ticket.id})`,
      body: [
        `Parked by the factory Run \`${context.runId}\`: ${reason}.`,
        '',
        verdict,
        '',
        ...rows,
        '',
        `Related to ${ticket.id}`,
        `Part of ${context.specId}`,
      ].join('\n'),
      draft: true,
    })
    await forge.commentOnPr(
      draft.number,
      `🏭 Factory: @${forge.maintainer()} this ticket is parked and needs you: ${reason}.`,
    )
    pr = `Draft PR: ${draft.url}`
  }
  await tracker.setStatus(ticket.id, 'Todo')
  await tracker.setAgentLabel(ticket.id, 'needs-human')
  await tracker.comment(
    ticket.id,
    [
      `${PARKED} by factory Run \`${context.runId}\`: ${reason}.`,
      '',
      verdict,
      ...(rows.length > 0 ? ['', ...rows] : []),
      '',
      pr,
      `Run log: ${join(context.runDir, ticket.id)}`,
      '',
      'To send it back to the factory, answer here, then swap `needs-human` for `ready-for-agent`.',
    ].join('\n'),
  )
  say('park', reason)
  return 'parked'
}

/** The ticket's last park note and the comments since that the factory didn't write, if any. */
async function previousParkOf(
  tracker: Tracker,
  id: string,
): Promise<TicketBrief['previousPark'] | undefined> {
  const comments = await tracker.getComments(id)
  const at = comments.findLastIndex((comment) => comment.body.startsWith(PARKED))
  const note = comments[at]
  if (!note) return undefined
  const since = comments
    .slice(at + 1)
    .filter((comment) => !comment.body.startsWith('🏭 Factory'))
    .map((comment) => comment.body)
  return { note: note.body, since }
}

function writeLog(logDir: string, name: string, text: string) {
  mkdirSync(logDir, { recursive: true })
  writeFileSync(join(logDir, name), text)
}

function agentStep(step: Step, prompt: string) {
  const { model, effort } = STEPS[step]
  return { name: step, model, effort, prompt, idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS }
}

/** Runs CI's checks as host commands, saving each one's output and the results to the run log. */
async function hostChecks(sandbox: Sandbox, logDir: string) {
  mkdirSync(join(logDir, 'checks'), { recursive: true })
  const failed: string[] = []
  for (const check of HOST_CHECKS) {
    const result = await sandbox.exec(`pnpm ${check}`)
    writeFileSync(
      join(logDir, 'checks', `${check.replace(':', '-')}.log`),
      result.stdout + result.stderr,
    )
    if (result.exitCode !== 0) failed.push(check)
  }
  const summary = HOST_CHECKS.map(
    (check) => `- pnpm ${check}: ${failed.includes(check) ? 'failed' : 'passed'}`,
  ).join('\n')
  writeFileSync(join(logDir, 'checks', 'results.md'), `${summary}\n`)
  return { passed: failed.length === 0, failed, summary }
}

const tested = <T extends { kind: Criterion['kind'] }>(items: T[]) =>
  items.filter((item) => item.kind === 'tested')

/**
 * Replays each Tested row's sabotage, each on a clean checkout: confirmed when the test fails on
 * an assertion under the sabotage and passes again once it's undone.
 */
async function replayAll(sandbox: Sandbox, review: Review): Promise<Map<string, boolean>> {
  const replays = new Map<string, boolean>()
  for (const row of tested(review.criteria)) replays.set(row.id, await replay(sandbox, row))
  await sandbox.exec(CLEAN)
  return replays
}

async function replay(sandbox: Sandbox, row: ReviewRow): Promise<boolean> {
  if (!TEST_COMMAND.test(row.testCommand)) return false
  await sandbox.exec(CLEAN)
  const patch = row.sabotagePatch.endsWith('\n') ? row.sabotagePatch : `${row.sabotagePatch}\n`
  const applied = await sandbox.exec('git apply --whitespace=nowarn -', { stdin: patch })
  if (applied.exitCode !== 0) return false
  await sandbox.exec(`rm -f ${REPLAY_REPORT}`)
  await sandbox.exec(`${row.testCommand} --reporter=json --outputFile=${REPLAY_REPORT}`)
  const report = await sandbox.exec(`cat ${REPLAY_REPORT}`)
  await sandbox.exec(CLEAN)
  const restored = await sandbox.exec(row.testCommand)
  return report.exitCode === 0 && caughtByAssertion(report.stdout) && restored.exitCode === 0
}

interface Outcome {
  review: Review | null
  replays: Map<string, boolean>
  checksPassed: boolean
  /** The Implementer's commits since origin/main. */
  commits: number
}

/** Why the push gate fails, or nothing when it passes. */
function pushGate(
  { review, replays, checksPassed, commits }: Outcome,
  criteria: Criterion[],
): string[] {
  const reasons: string[] = []
  if (!(commits > 0)) reasons.push('the Implementer made no commits')
  if (!checksPassed) reasons.push('the host checks failed')
  if (!review) return [...reasons, 'no readable review']
  if (review.verdict !== 'pass') reasons.push('the Reviewer failed it')
  for (const criterion of tested(criteria)) {
    if (replays.get(criterion.id) !== true) {
      reasons.push(`${criterion.id}'s replay wasn't confirmed`)
    }
  }
  return reasons
}

/**
 * Linear reads these words before an identifier as closing it, so text the factory didn't write
 * has them turned into "Related to" (CLAUDE.md, Tracking).
 */
const CLOSING = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)(\s+[A-Z]+-\d+)/gi

function prBody(context: RunContext, { ticket }: TicketBrief, mapping: string): string {
  return [
    `Built by the factory Run \`${context.runId}\` from the spec ${context.specId}.`,
    '',
    '## Acceptance criteria',
    '',
    mapping.replace(CLOSING, 'Related to$1') || 'The Implementer wrote no mapping table.',
    '',
    `Closes ${ticket.id}`,
    `Part of ${context.specId}`,
    '',
    '🤖 Generated with [Claude Code](https://claude.com/claude-code)',
  ].join('\n')
}

/** The Reviewer's rows as a Markdown table, with each replay's result. */
function reviewRows(review: Review, replays: Map<string, boolean>): string[] {
  return [
    '| Criterion | Test | Sabotage replay |',
    '| -- | -- | -- |',
    ...review.criteria.map((row) => {
      const replayed =
        row.kind === 'seen' ? 'Seen' : replays.get(row.id) ? 'confirmed' : 'not confirmed'
      return `| ${row.id} | ${row.test.replace(CLOSING, 'Related to$1')} | ${replayed} |`
    }),
  ]
}

function reviewComment(review: Review, replays: Map<string, boolean>): string {
  return [
    `🏭 Factory: the Reviewer's verdict is **${review.verdict}**.`,
    '',
    ...reviewRows(review, replays),
  ].join('\n')
}

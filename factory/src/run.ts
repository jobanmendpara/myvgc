// One ticket's way through a Run, from claim to merge (How a factory Run works, DEV-253). This is
// the happy path (DEV-278): when the push gate or CI fails, the Run stops and says so. Fix rounds,
// parking and the rest come in later tickets of DEV-269.
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
import { caughtByAssertion, readReview, type Review, type ReviewRow } from './review.ts'
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

/** Works one ticket to a merged PR. True when it merged. */
export async function workTicket(context: RunContext, brief: TicketBrief): Promise<boolean> {
  const { tracker, forge, print } = context
  const { ticket } = brief
  const say = (step: string, result: string) =>
    print(`${ticket.id} ${ticket.title} · ${step}: ${result}`)
  const logDir = join(context.runDir, ticket.id)

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
      return stop(say, 'worktree and install', install.stdout + install.stderr)
    }
    say('worktree and install', `${ticket.branch}, installed`)

    await sandbox.runAgent(agentStep('implementer', implementerPrompt(brief)))
    const commits = Number((await sandbox.exec('git rev-list --count origin/main..HEAD')).stdout)
    say('Implementer', `finished, ${commits} commit${commits === 1 ? '' : 's'}`)

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
      return stop(say, 'push gate', `failed (${gate.join('; ')}); fix rounds come with DEV-283`)
    }
    say('push gate', 'passed')

    await forge.push(sandbox.worktreePath, ticket.branch)
    const mapping = await sandbox.exec(`cat ${MAPPING_FILE}`)
    const pr = await forge.openPr({
      branch: ticket.branch,
      title: `${ticket.title} (${ticket.id})`,
      body: prBody(context, brief, mapping.exitCode === 0 ? mapping.stdout.trim() : ''),
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
        return true
      }
      // 2: still pending; 3: a gh error. Both mean wait again (scripts/wait-for-checks.sh).
      if (code !== 2 && code !== 3) {
        return stop(say, 'wait for checks', `exit ${code}; handling it comes with DEV-284`)
      }
    }
  } finally {
    await close()
  }
}

function stop(say: (step: string, result: string) => void, step: string, why: string): false {
  say(step, why)
  return false
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

function reviewComment(review: Review, replays: Map<string, boolean>): string {
  const rows = review.criteria.map((row) => {
    const replayed =
      row.kind === 'seen' ? 'Seen' : replays.get(row.id) ? 'confirmed' : 'not confirmed'
    return `| ${row.id} | ${row.test.replace(CLOSING, 'Related to$1')} | ${replayed} |`
  })
  return [
    `🏭 Factory: the Reviewer's verdict is **${review.verdict}**.`,
    '',
    '| Criterion | Test | Sabotage replay |',
    '| -- | -- | -- |',
    ...rows,
  ].join('\n')
}

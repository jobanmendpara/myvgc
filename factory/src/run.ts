// One ticket's way through a Run, from claim to merge (How a factory Run works, DEV-253). This is
// the happy path (DEV-278): when the push gate or CI fails, the Run stops and says so. Fix rounds,
// parking and the rest come in later tickets of DEV-269.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Criterion } from './criteria.ts'
import type { Forge, Sandbox, Sandboxes, Ticket, Tracker } from './ports.ts'
import { implementerPrompt, MAPPING_FILE, reviewerPrompt, type TicketBrief } from './prompts.ts'
import { caughtByAssertion, readReview, type Review, type ReviewRow } from './review.ts'
import { STEPS, type Step } from './settings.ts'

/** pnpm's store inside the sandbox, outside the worktree, so `pnpm install` makes none in it. */
export const STORE_DIR = '/home/agent/.local/share/pnpm/store'
/** Longer than any command an agent runs silently (the spike, DEV-251, lesson 6). */
const IDLE_TIMEOUT_SECONDS = 1800
const REPLAY_REPORT = '/home/agent/factory/replay.json'

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
  print: (line: string) => void
}

/** Works one ticket to a merged PR. True when it merged. */
export async function workTicket(
  context: RunContext,
  ticket: Ticket,
  criteria: Criterion[],
  workspace: string,
): Promise<boolean> {
  const { tracker, forge, print } = context
  const say = (step: string, result: string) =>
    print(`${ticket.id} ${ticket.title} · ${step}: ${result}`)
  const brief: TicketBrief = { ticket, specId: context.specId, criteria, workspace }

  await tracker.setStatus(ticket.id, 'In Progress')
  await tracker.comment(ticket.id, `🏭 Factory: Claimed by factory Run \`${context.runId}\`.`)
  say('claim', 'In Progress')

  const sandbox = await context.sandboxes.create({
    branch: ticket.branch,
    base: 'origin/main',
    env: context.sandboxEnv,
  })
  let closed = false
  const close = async () => {
    if (!closed) await sandbox.close()
    closed = true
  }
  try {
    const bot = await forge.botIdentity()
    const install = await sandbox.exec(
      [
        `git config user.name '${bot.name}'`,
        `git config user.email '${bot.email}'`,
        // Where the Implementer writes the mapping table and the host its replay reports.
        'mkdir -p /home/agent/factory',
        `pnpm install --frozen-lockfile --store-dir ${STORE_DIR}`,
      ].join(' && '),
    )
    if (install.exitCode !== 0)
      return stop(say, 'worktree and install', install.stdout + install.stderr)
    say('worktree and install', `${ticket.branch}, installed`)

    await sandbox.runAgent(agentStep('implementer', implementerPrompt(brief)))
    say('Implementer', 'finished')

    const checks = await hostChecks(sandbox, join(context.runDir, ticket.id))
    say('host checks', checks.passed ? 'all passed' : `failed: ${checks.failed.join(', ')}`)

    const reviewer = await sandbox.runAgent(
      agentStep('reviewer', reviewerPrompt(brief, checks.summary)),
    )
    const review = readReview(reviewer.stdout)
    say('Reviewer', review ? review.verdict : 'no readable <review>')

    const replays = review ? await replayAll(sandbox, review) : new Map<string, boolean>()
    const confirmed = [...replays.values()].filter(Boolean).length
    say('replay', `${confirmed} of ${replays.size} confirmed`)

    const gate = pushGate(review, replays, checks.passed, criteria)
    if (gate.length > 0) {
      return stop(say, 'push gate', `failed (${gate.join('; ')}); fix rounds come with DEV-283`)
    }
    say('push gate', 'passed')

    await forge.push(sandbox.worktreePath, ticket.branch)
    const mapping = await sandbox.exec(`cat ${MAPPING_FILE}`)
    const pr = await forge.openPr({
      branch: ticket.branch,
      title: `${ticket.title} (${ticket.id})`,
      body: prBody(context, ticket, mapping.exitCode === 0 ? mapping.stdout.trim() : ''),
    })
    await forge.commentOnPr(pr.number, reviewComment(review as Review, replays))
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

/** Runs CI's checks as host commands, saving each one's output to the run log. */
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
  return { passed: failed.length === 0, failed, summary }
}

/**
 * Replays each Tested row's sabotage on a clean checkout: confirmed when the test fails on an
 * assertion under the sabotage and passes again once it's undone.
 */
async function replayAll(sandbox: Sandbox, review: Review): Promise<Map<string, boolean>> {
  const replays = new Map<string, boolean>()
  await sandbox.exec('git checkout -- . && git clean -fd')
  for (const row of review.criteria.filter((candidate) => candidate.kind === 'tested')) {
    replays.set(row.id, await replay(sandbox, row))
  }
  return replays
}

async function replay(sandbox: Sandbox, row: ReviewRow): Promise<boolean> {
  const patch = row.sabotagePatch.endsWith('\n') ? row.sabotagePatch : `${row.sabotagePatch}\n`
  const applied = await sandbox.exec('git apply --whitespace=nowarn -', { stdin: patch })
  if (applied.exitCode !== 0) return false
  await sandbox.exec(`rm -f ${REPLAY_REPORT}`)
  await sandbox.exec(`${row.testCommand} --reporter=json --outputFile=${REPLAY_REPORT}`)
  const report = await sandbox.exec(`cat ${REPLAY_REPORT}`)
  await sandbox.exec('git checkout -- .')
  const restored = await sandbox.exec(row.testCommand)
  return report.exitCode === 0 && caughtByAssertion(report.stdout) && restored.exitCode === 0
}

/** Why the push gate fails, or nothing when it passes. */
function pushGate(
  review: Review | null,
  replays: Map<string, boolean>,
  checksPassed: boolean,
  criteria: Criterion[],
): string[] {
  const reasons: string[] = []
  if (!checksPassed) reasons.push('the host checks failed')
  if (!review) return [...reasons, 'no readable review']
  if (review.verdict !== 'pass') reasons.push('the Reviewer failed it')
  for (const criterion of criteria.filter((candidate) => candidate.kind === 'tested')) {
    if (replays.get(criterion.id) !== true)
      reasons.push(`${criterion.id}'s replay wasn't confirmed`)
  }
  return reasons
}

function prBody(context: RunContext, ticket: Ticket, mapping: string): string {
  return [
    `Built by the factory Run \`${context.runId}\` from the spec ${context.specId}.`,
    '',
    '## Acceptance criteria',
    '',
    mapping || 'The Implementer wrote no mapping table.',
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
    return `| ${row.id} | ${row.test} | ${replayed} |`
  })
  return [
    `🏭 Factory: the Reviewer's verdict is **${review.verdict}**.`,
    '',
    '| Criterion | Test | Sabotage replay |',
    '| -- | -- | -- |',
    ...rows,
  ].join('\n')
}

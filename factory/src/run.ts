// One ticket's way through a Run, from claim to merge (How a factory Run works, DEV-253). When the
// push gate fails, up to two fix rounds resume the Implementer's session on rising models
// (DEV-283). A ticket the factory still can't finish is parked for the maintainer (DEV-279): Todo
// with `needs-human`, its branch on a draft PR, and a Linear comment saying why. After the push it
// acts on what scripts/wait-for-checks.sh reports (DEV-284): a CI failure gets a fix round in a new
// sandbox, counted towards the two; a conflict with main gets a rebase and a force-push, or a park
// when the rebase stops on conflicts; and a PR waiting on `approved` is left with the maintainer,
// auto-merge still queued, while the Run moves on. A branch that changes an ADR 24 path has
// `pnpm accuracy` run before and after it, ahead of each push (DEV-280). A Seen criterion passes
// the push gate only with screenshots the Reviewer judged matching, which the PR comment shows
// (DEV-281, src/screenshots.ts).
//
// It survives what interrupted the spike (DEV-286): each agent's sessions live in the Run's folder;
// a usage limit pauses every agent step until it resets, then the step continues its session; an
// agent the idle timeout killed has its work committed by the host, which carries on to the host
// checks; and each step that finishes saves a checkpoint, which a Run adopting the ticket after the
// host died resumes from.
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import {
  type Accuracy,
  type AccuracyKey,
  type AccuracyRun,
  headline,
  measureAccuracy,
} from './accuracy.ts'
import type { Criterion } from './criteria.ts'
import { ticketNotification } from './notify.ts'
import {
  type AgentResult,
  type AgentStep,
  type Clock,
  type Comment,
  type Forge,
  type GitIdentity,
  type Notifier,
  type Sandbox,
  type Sandboxes,
  STORE_DIR,
  type Ticket,
  type Tracker,
} from './ports.ts'
import {
  ciFixRoundPrompt,
  fixRoundPrompt,
  type GateFailure,
  implementerPrompt,
  MAPPING_FILE,
  reviewerPrompt,
  type TicketBrief,
} from './prompts.ts'
import {
  caughtByAssertion,
  lastTag,
  readReview,
  type Review,
  type ReviewRow,
  type TestedRow,
} from './review.ts'
import type { CheckResults, Checkpoint, RunLog, TicketLog } from './runlog.ts'
import {
  type CopiedShots,
  copyScreenshots,
  pushScreenshots,
  seenGate,
  seenRows,
} from './screenshots.ts'
import { modelName, type Settings, type Step } from './settings.ts'
import { CONTINUE, isUsageLimit, type UsageLimit } from './usage.ts'

/** Longer than any command an agent runs silently (the spike, DEV-251, lesson 6). */
const IDLE_TIMEOUT_SECONDS = 1800
const REPLAY_REPORT = '/home/agent/factory/replay.json'
const CLEAN = 'git checkout -- . && git clean -fd'
/**
 * The only test commands a replay runs: a Vitest run in one workspace package. The Reviewer writes
 * them, so nothing else it could put there (another command, a redirect) reaches the shell.
 */
const TEST_COMMAND = /^pnpm --filter [@\w./-]+ exec vitest run [\w@./ '"*:-]+$/
/** A full commit ID, as `git rev-parse HEAD` prints it. */
const COMMIT = /^[0-9a-f]{40}$/
/** How much of a CI log goes in a fix round's prompt: its end, where the failures are. */
const CI_LOG_LINES = 300

/** The full checks the host runs itself (CI's commands), with no idle limit. */
const HOST_CHECKS = ['test', 'typecheck', 'lint', 'format:check'] as const

export interface RunContext {
  runId: string
  specId: string
  /** The Run's log folder, `.factory/runs/<id>/`. */
  runDir: string
  /** The Run's log in that folder: run.json, and each agent's stdout and session. */
  log: RunLog
  tracker: Tracker
  forge: Forge
  clock: Clock
  /** The Run-wide pause for the usage limit, which every agent step waits on. */
  usage: UsageLimit
  sandboxes: Sandboxes
  /** Notifies an exit-5 wait or a park (src/notify.ts). */
  notifier: Notifier
  /** The environment sandboxes get: the Claude credential and nothing else. */
  sandboxEnv: Record<string, string>
  /** Who the sandbox's commits are by: the App's bot user, read when the Run started. */
  author: GitIdentity
  /** Each agent step's model and effort, with the Run's flags applied. */
  settings: Settings
  /**
   * The Anthropic API key `pnpm accuracy` runs with (src/accuracy.ts), when the set-up has one, and
   * where it belongs. Only that command gets it, never the sandbox's environment.
   */
  accuracyKey: AccuracyKey
  print: (line: string) => void
}

/**
 * How many fix rounds a ticket gets before it parks (How a factory Run works, DEV-253), whether
 * the push gate or CI failed it. Each has its own step in the settings table: fix-round-1,
 * fix-round-2.
 */
const FIX_ROUNDS = 2

/**
 * How a ticket's turn in a Run ended. "waiting for approval": its PR changes a risky path and waits
 * for the maintainer's `approved`, with auto-merge queued.
 */
export type TicketOutcome = 'merged' | 'parked' | 'waiting for approval' | 'stopped'

/** A ticket's turn: printing a finished step's line, and its log in the run folder. */
interface Turn {
  /** Prints one line for a finished step and adds it to the run log. */
  say: (step: string, result: string) => void
  log: TicketLog
  /** Runs an agent step in a sandbox, waiting out the usage limit. */
  agent: (sandbox: Sandbox, step: AgentStep) => Promise<AgentResult>
}

/** Every comment the factory writes starts with this (DEV-259). */
const FACTORY = '🏭 Factory'
/** The note a park leaves on the ticket starts with this, which is how a later Run finds it. */
const PARKED = `${FACTORY}: Parked`

/**
 * Works one ticket to a merged PR, or parks it. `unstartable` says why it can't start at all, such
 * as a criterion the spec lacks: it is parked before any agent runs. `resume` is the last step a
 * Run whose host died finished: the ticket carries on from there, claimed already.
 */
export async function workTicket(
  context: RunContext,
  brief: TicketBrief,
  unstartable?: string,
  resume?: Checkpoint,
): Promise<TicketOutcome> {
  const { ticket } = brief
  const log = context.log.ticket(ticket)
  const say = (step: string, result: string) => {
    context.print(`${ticket.id} ${ticket.title} · ${step}: ${result}`)
    log.step(step, result)
  }
  const turn: Turn = {
    say,
    log,
    agent: (sandbox, step) => runAgent(context, ticket, { say, log }, sandbox, step),
  }
  const outcome = await turnOf(context, brief, turn, unstartable, resume)
  log.outcome(outcome)
  return outcome
}

/**
 * Runs an agent step once no usage-limit pause holds. A step the limit stopped pauses every agent
 * step of the Run until the limit resets, then continues its own session with "continue"; one that
 * captured no session runs again from its prompt. Any other error stops the ticket's turn.
 */
async function runAgent(
  context: RunContext,
  ticket: Ticket,
  { say, log }: Pick<Turn, 'say' | 'log'>,
  sandbox: Sandbox,
  step: AgentStep,
): Promise<AgentResult> {
  let current = step
  for (;;) {
    await context.usage.wait()
    const attempt = current
    const result = await log.agent(attempt, () => sandbox.runAgent(attempt))
    const stopped = result.stopped
    const session = result.sessionId ?? attempt.resumeSession
    if (stopped?.kind !== 'error') return { ...result, sessionId: session }
    if (!isUsageLimit(stopped.message)) {
      throw new Error(`The agent step ${step.name} failed: ${stopped.message}`)
    }
    const until = context.usage.pause(ticket.id, step.name, stopped.message)
    say(step.name, `the usage limit was reached, so agent steps wait until ${until.toISOString()}`)
    current = session ? { ...step, prompt: CONTINUE, resumeSession: session } : step
  }
}

async function turnOf(
  context: RunContext,
  brief: TicketBrief,
  turn: Turn,
  unstartable?: string,
  resume?: Checkpoint,
): Promise<TicketOutcome> {
  const { tracker, forge, settings } = context
  const { ticket } = brief
  const { say, log } = turn
  const logDir = join(context.runDir, ticket.id)
  if (unstartable) return park(context, brief, turn, unstartable)
  const comments = await tracker.getComments(ticket.id)
  const previousPark = previousParkOf(comments)
  const working: TicketBrief = previousPark ? { ...brief, previousPark } : brief
  const parkHere = (reason: string, work?: Work) => park(context, working, turn, reason, work)

  const claim = `${FACTORY}: Claimed by factory Run \`${context.runId}\`.`
  if (resume) say('adopt', `after the host died, from ${resume.step}`)
  // Saved before the claim, so a host that dies in the middle of it leaves a ticket the next Run
  // adopts. That Run claims it only when the claim comment didn't get made: never twice.
  else log.checkpoint({ step: 'claimed' })
  if (!resume || !comments.some((comment) => comment.body === claim)) {
    await tracker.setStatus(ticket.id, 'In Progress')
    await tracker.comment(ticket.id, claim)
    say('claim', 'In Progress')
  }

  const open = new Set<Sandbox>()
  const newSandbox = async () => {
    const sandbox = await context.sandboxes.create({
      branch: ticket.branch,
      base: 'origin/main',
      env: context.sandboxEnv,
      author: context.author,
      // Outside every sandbox, so a crash or a closed sandbox never loses a session.
      sessions: join(logDir, 'sessions'),
    })
    open.add(sandbox)
    return sandbox
  }
  const close = async (sandbox: Sandbox) => {
    if (!open.delete(sandbox)) return
    await sandbox.close()
    say('close sandbox', 'closed')
  }
  /** A new sandbox with the workspace installed, or null when the install failed. */
  const installed = async (): Promise<Sandbox | null> => {
    const sandbox = await newSandbox()
    const install = await sandbox.exec(
      // Where the Implementer writes the mapping table and the host its replay reports.
      `mkdir -p /home/agent/factory && pnpm install --frozen-lockfile --store-dir ${STORE_DIR}`,
    )
    if (install.exitCode !== 0) {
      writeLog(logDir, 'install.log', install.stdout + install.stderr)
      return null
    }
    say('worktree and install', `${ticket.branch}, installed`)
    return sandbox
  }

  // What the ticket's work has come to so far, across sandboxes and pushes, and Runs.
  const resumed = resumedFrom(resume)
  let { round, session, pr } = resumed
  // The last review, kept so a park in a later round still reports it.
  let { review, replays } = resumed
  // The last review's Seen screenshots, as the host copied them to the run log.
  let shots = new Map<string, CopiedShots>()
  let commits = 0
  /** The work as it stands, for a park; `sandbox` when the branch's last commits aren't pushed. */
  const work = (sandbox?: Sandbox, more: Partial<Work> = {}): Work => ({
    sandbox,
    commits,
    review,
    replays,
    ...more,
  })

  /** Runs the next fix round in `sandbox`, resuming the Implementer's session on its model. */
  const fixRound = (sandbox: Sandbox, promptFor: (round: number, model: string) => string) => {
    round += 1
    log.fixRound(round)
    const fix = fixStep(round)
    const prompt = promptFor(round, settings[fix].model)
    // Without a session captured, the round starts afresh, told the ticket as well.
    return turn.agent(
      sandbox,
      session
        ? { ...agentStep(settings, fix, prompt), resumeSession: session }
        : agentStep(
            settings,
            fix,
            `${implementerPrompt(working, settings[fix].model)}\n\n${prompt}`,
          ),
    )
  }

  /**
   * From the agent's last step to a passing push gate: the host checks, a fresh Reviewer and the
   * replays, then a fix round while the gate fails and rounds are left. Parks it otherwise.
   */
  const untilGatePasses = async (sandbox: Sandbox, start: From): Promise<'passed' | 'parked'> => {
    let from = start
    for (;;) {
      const label = round === 0 ? 'Implementer' : `fix round ${round}`
      const who = round === 0 ? 'the Implementer' : label
      if (from.kind === 'agent' && from.agent.stopped?.kind === 'idle timeout') {
        // Its work is in the worktree, uncommitted: keep it, and judge it as it stands.
        const kept = await commitLeftWork(sandbox, context, ticket, settings[fixStep(round)].model)
        say(
          label,
          kept
            ? 'stopped by the idle timeout, so the host committed its work'
            : 'stopped by the idle timeout, with nothing left uncommitted',
        )
      }
      commits = Number((await sandbox.exec('git rev-list --count origin/main..HEAD')).stdout)
      let checks: CheckResults
      if (from.kind === 'replays') {
        checks = from.checks
        review = from.review
      } else {
        if (from.kind === 'agent') {
          say(label, `finished, ${commits} commit${commits === 1 ? '' : 's'}`)
          const parkSignal = lastTag(from.agent.stdout, 'park')
          if (parkSignal) return parkHere(`${who} parked it: ${parkSignal}`, work(sandbox))
          log.checkpoint({ step: 'implemented', round, session: session ?? null })
        }

        // Each round keeps its own logs and screenshots: the first in checks/ and screenshots/,
        // then in fix-round-n/.
        checks = await hostChecks(sandbox, roundDir(logDir, round))
        say('host checks', checks.passed ? 'all passed' : `failed: ${checks.failed.join(', ')}`)

        const read = await readableReview(
          sandbox,
          settings,
          reviewerPrompt(working, checks.summary),
          turn,
          round,
        )
        if (!read) {
          return parkHere("the Reviewer's answer couldn't be read, twice", work(sandbox))
        }
        review = read
        log.checkpoint({ step: 'reviewed', round, session: session ?? null, checks, review })
      }
      // Copied again for a review adopted after the host died: they are in the reused worktree.
      shots = await copyScreenshots(sandbox, review, roundDir(logDir, round))
      replays = await replayAll(sandbox, review)
      log.replays(round, replays)
      const confirmed = [...replays.values()].filter(Boolean).length
      say('replay', `${confirmed} of ${replays.size} confirmed`)

      const gate = pushGate(
        { review, replays, shots, checksPassed: checks.passed, commits },
        working.criteria,
      )
      if (gate.length === 0) {
        say('push gate', 'passed')
        return 'passed'
      }
      say('push gate', `failed: ${gate.join('; ')}`)
      if (round === FIX_ROUNDS) {
        return parkHere(
          `the push gate failed after ${FIX_ROUNDS} fix rounds: ${gate.join('; ')}`,
          work(sandbox),
        )
      }
      const failure: GateFailure = {
        reasons: gate,
        hostChecks: checks.summary,
        rows: reviewRows(review, replays),
        findings: findingLines(review),
      }
      from = {
        kind: 'agent',
        agent: await fixRound(sandbox, (next, model) =>
          fixRoundPrompt(next, FIX_ROUNDS, working, failure, model),
        ),
      }
    }
  }

  /**
   * Pushes the branch, opens its PR (or brings the open one up to date), posts the review and
   * queues auto-merge, then closes the sandbox.
   */
  /** Pushes the branch from `sandbox`, or parks the ticket when GitHub turns the push down. */
  const pushOrPark = async (
    sandbox: Sandbox,
    options?: { forceWithLease: string },
  ): Promise<'pushed' | 'parked'> => {
    if ((await forge.push(sandbox.worktreePath, ticket.branch, options)) === 'pushed') {
      return 'pushed'
    }
    return parkHere('the branch changes workflow files', work(sandbox, { pushRefused: true }))
  }

  const ship = async (sandbox: Sandbox): Promise<'shipped' | 'parked'> => {
    if (!review || !replays) throw new Error('The push gate passed with no review.')
    const accuracy = await measureAccuracy(sandbox, ticket.branch, context.accuracyKey)
    if (accuracy.kind === 'unmeasured') {
      say('accuracy', 'not measured')
      return parkHere(accuracy.problem, work(sandbox))
    }
    if (accuracy.kind === 'measured') {
      writeLog(roundDir(logDir, round), 'accuracy-base.log', accuracy.before.log)
      writeLog(roundDir(logDir, round), 'accuracy-branch.log', accuracy.after.log)
      say('accuracy', `${headline(accuracy.before)} before; ${headline(accuracy.after)} after`)
    }
    // The screenshots go up first, so a failure there leaves no branch pushed without its PR.
    const urls = await pushScreenshots(forge, `${ticket.id}/${context.runId}`, shots)
    if ((await pushOrPark(sandbox)) === 'parked') return 'parked'
    const mapping = await sandbox.exec(`cat ${MAPPING_FILE}`)
    pr = await forge.openPr({
      branch: ticket.branch,
      title: prTitle(ticket),
      body: prBody(context, working, mapping.exitCode === 0 ? mapping.stdout.trim() : '', accuracy),
      draft: false,
    })
    log.pr(pr.url)
    await forge.commentOnPr(pr.number, reviewComment(review, replays, shots, urls))
    await forge.queueAutoMerge(pr.number)
    log.checkpoint({
      step: 'shipped',
      round,
      session: session ?? null,
      pr,
      review,
      replays: Object.fromEntries(replays),
    })
    await tracker.setStatus(ticket.id, 'In Review')
    say('push, PR and auto-merge', pr.url)
    await close(sandbox)
    return 'shipped'
  }

  /**
   * Rebases the pushed branch onto origin/main in `sandbox` and force-pushes it, leased to the
   * commit it was pushed at. Parks the ticket when the rebase stops on conflicts.
   */
  const rebase = async (sandbox: Sandbox): Promise<'rebased' | 'parked'> => {
    const pushedAt = (await sandbox.exec('git rev-parse HEAD')).stdout.trim()
    if (!COMMIT.test(pushedAt)) throw new Error(`git rev-parse HEAD printed ${pushedAt}.`)
    const rebased = await sandbox.exec('git rebase origin/main')
    if (rebased.exitCode !== 0) {
      writeLog(logDir, 'rebase.log', rebased.stdout + rebased.stderr)
      await sandbox.exec('git rebase --abort')
      say('rebase', 'conflicts with origin/main')
      return parkHere(
        `the PR conflicts with main, and \`git rebase origin/main\` stops on conflicts: see rebase.log in the run log and ${pr?.url}`,
        work(),
      )
    }
    if ((await pushOrPark(sandbox, { forceWithLease: pushedAt })) === 'parked') return 'parked'
    say('rebase', 'onto origin/main, force-pushed')
    await close(sandbox)
    return 'rebased'
  }

  try {
    // Shipped already: straight to waiting on its checks.
    if (resumed.next !== 'wait') {
      const first = await installed()
      if (!first) return await parkHere(INSTALL_FAILED, resume ? work() : undefined)
      let from: From
      if (resumed.next === 'implement') {
        const implementer = await turn.agent(
          first,
          agentStep(
            settings,
            'implementer',
            implementerPrompt(working, settings.implementer.model),
          ),
        )
        session = implementer.sessionId
        from = { kind: 'agent', agent: implementer }
      } else {
        from = resumed.next
      }
      if ((await untilGatePasses(first, from)) === 'parked') return 'parked'
      if ((await ship(first)) === 'parked') return 'parked'
    }

    for (;;) {
      if (!pr) throw new Error('Waiting on checks with no PR.')
      const code = await forge.waitForChecks(pr.number)
      if (code === WAIT.pending || code === WAIT.ghError) continue
      if (code === WAIT.merged) {
        say('wait for checks', 'merged')
        return 'merged'
      }
      if (code === WAIT.awaitingApproval) {
        return await waitForApproval(context, ticket, pr, say)
      }
      if (code === WAIT.conflicts) {
        const rebased = await rebase(await newSandbox())
        if (rebased !== 'rebased') return rebased
        continue
      }
      if (code !== WAIT.checkFailed) {
        say('wait for checks', `exit ${code}, which the factory doesn't know`)
        return 'stopped'
      }

      // CI failed: a fix round, from the pushed branch, counted towards the two.
      if (round === FIX_ROUNDS) {
        return await parkHere(
          `CI failed, and the ticket has had its ${FIX_ROUNDS} fix rounds: see ${pr.url}`,
          work(),
        )
      }
      const log = await forge.failedCheckLogs(pr.number)
      writeLog(roundDir(logDir, round + 1), 'ci.log', log)
      say('wait for checks', `CI failed, so fix round ${round + 1} starts`)
      const sandbox = await installed()
      if (!sandbox) return await parkHere(INSTALL_FAILED, work())
      const agent = await fixRound(sandbox, (next, model) =>
        ciFixRoundPrompt(next, FIX_ROUNDS, working, lastLines(log, CI_LOG_LINES), model),
      )
      if ((await untilGatePasses(sandbox, { kind: 'agent', agent })) === 'parked') return 'parked'
      if ((await ship(sandbox)) === 'parked') return 'parked'
    }
  } finally {
    for (const sandbox of [...open]) await close(sandbox)
  }
}

const INSTALL_FAILED = '`pnpm install` failed in the sandbox: see install.log in the run log'

/**
 * Where the way to a passing push gate starts: an agent step that just finished, or, for a ticket
 * adopted after the host died, the host checks after its last agent step, or the replays of its
 * last review.
 */
type From =
  | { kind: 'agent'; agent: AgentResult }
  | { kind: 'checks' }
  | { kind: 'replays'; checks: CheckResults; review: Review }

/** What a ticket's work had come to at its checkpoint, and where its turn goes on from. */
interface Resumed {
  round: number
  /** The Implementer's session. */
  session?: string
  review?: Review
  replays?: Map<string, boolean>
  pr?: { number: number; url: string }
  /** The Implementer's step, the way to the push gate, or the wait on a shipped PR's checks. */
  next: 'implement' | From | 'wait'
}

function resumedFrom(resume: Checkpoint | undefined): Resumed {
  if (!resume || resume.step === 'claimed') return { round: 0, next: 'implement' }
  const { round } = resume
  const session = resume.session ?? undefined
  switch (resume.step) {
    case 'implemented':
      return { round, session, next: { kind: 'checks' } }
    case 'reviewed':
      return {
        round,
        session,
        review: resume.review,
        next: { kind: 'replays', checks: resume.checks, review: resume.review },
      }
    case 'shipped':
      return {
        round,
        session,
        review: resume.review,
        replays: new Map(Object.entries(resume.replays)),
        pr: resume.pr,
        next: 'wait',
      }
  }
}

/** The agent step of a round: the Implementer's, then each fix round's. */
const fixStep = (round: number): Step =>
  round === 0 ? 'implementer' : (`fix-round-${round}` as Step)

/**
 * Commits what an agent the idle timeout killed left in the worktree, as the bot, so the host checks
 * and the Reviewer judge it (the spike, DEV-251, lesson 5). False when nothing was left.
 */
async function commitLeftWork(
  sandbox: Sandbox,
  context: Pick<RunContext, 'runId' | 'specId'>,
  ticket: Ticket,
  model: string,
): Promise<boolean> {
  const status = await sandbox.exec('git status --porcelain')
  if (status.exitCode !== 0 || status.stdout.trim() === '') return false
  const message = [
    `Keep the work an agent left when the idle timeout stopped it (${ticket.id})`,
    '',
    `The factory Run \`${context.runId}\` committed it as it stood, for the host checks and the Reviewer.`,
    '',
    `Part of ${context.specId}`,
    '',
    `Co-Authored-By: ${modelName(model)} <noreply@anthropic.com>`,
  ].join('\n')
  const committed = await sandbox.exec('git add -A && git commit --no-verify -F -', {
    stdin: `${message}\n`,
  })
  return committed.exitCode === 0
}

/** scripts/wait-for-checks.sh's exit codes, as its comment block lists them. */
const WAIT = {
  merged: 0,
  checkFailed: 1,
  /** A check or the queued merge is still pending: wait again. */
  pending: 2,
  /** `gh` failed: wait again. */
  ghError: 3,
  /** The PR conflicts with main. */
  conflicts: 4,
  /** The risky-path gate waits for the maintainer's `approved`. */
  awaitingApproval: 5,
} as const

/** Where a round's logs go: the ticket's folder for the first, then fix-round-n/. */
const roundDir = (logDir: string, round: number) =>
  round === 0 ? logDir : join(logDir, `fix-round-${round}`)

const lastLines = (text: string, count: number) => text.split('\n').slice(-count).join('\n')

/**
 * Leaves a PR waiting on `approved` with the maintainer: the ticket stays In Review and gets
 * `needs-human`, auto-merge stays queued, and the Run moves on. The PR comment @mentions the
 * maintainer, and a notification says so.
 */
async function waitForApproval(
  context: RunContext,
  ticket: Ticket,
  { number, url }: { number: number; url: string },
  say: (step: string, result: string) => void,
): Promise<'waiting for approval'> {
  const { forge } = context
  await forge.commentOnPr(
    number,
    `${FACTORY}: @${forge.maintainer()} this PR changes a risky path, so it waits for you to add \`approved\`. Auto-merge stays queued, so adding the label merges it.`,
  )
  await context.tracker.setAgentLabel(ticket.id, 'needs-human')
  await context.tracker.comment(
    ticket.id,
    [
      `${FACTORY}: Waiting for approval. The PR changes a risky path, so the risky-path gate waits for the maintainer to add \`approved\` to it: ${url}`,
      '',
      `Auto-merge stays queued, so adding the label merges it. Run \`${context.runId}\` has moved on.`,
    ].join('\n'),
  )
  say('wait for checks', 'waiting for `approved`')
  await context.notifier.notify(
    ticketNotification(ticket, 'waiting for `approved`, since the PR changes a risky path', url),
  )
  return 'waiting for approval'
}

/** What a ticket's work holds when it parks. */
interface Work {
  /** The sandbox holding commits not pushed yet; none when the branch is pushed as it stands. */
  sandbox?: Sandbox
  commits: number
  /** The last review, when one ran; with the host's replays of its sabotages. */
  review?: Review | null
  replays?: Map<string, boolean>
  /** GitHub already turned the branch's push down: don't try again. */
  pushRefused?: boolean
}

const prTitle = (ticket: Ticket) => `${ticket.title} (${ticket.id})`

const WORKFLOWS_REFUSED =
  "GitHub turned the push down because the branch changes workflow files, which the factory's App may not push. The branch stays local, and that change has to be made by hand"

/**
 * Parks the ticket for the maintainer: its branch on a draft PR when it has commits (an open PR
 * is turned back into a draft, its auto-merge cancelled), then Todo with `needs-human` and a
 * Linear comment with the reason, the last review and the run log. The draft PR's comment
 * @mentions the maintainer, and a notification links the draft PR, or the ticket without one.
 */
async function park(
  context: RunContext,
  { ticket }: TicketBrief,
  { say, log }: Turn,
  why: string,
  work?: Work,
): Promise<'parked'> {
  const { tracker, forge } = context
  // The reason can carry an agent's words (its park signal), which mustn't close another issue.
  const reason = why.replace(CLOSING, 'Related to$1')
  const review = work?.review
  const lastReview = review
    ? [
        `Last verdict: **${review.verdict}**.`,
        '',
        ...reviewRows(review, work?.replays ?? new Map()),
        ...(review.findings.length > 0
          ? ['', "The Reviewer's findings:", ...findingLines(review)]
          : []),
      ]
    : ['No review ran.']
  let pr: string
  let draftUrl: string | undefined
  if (!work || work.commits === 0) {
    pr = 'No draft PR: the branch has no commits.'
  } else if (
    work.pushRefused ||
    (work.sandbox &&
      (await forge.push(work.sandbox.worktreePath, ticket.branch)) === 'workflows refused')
  ) {
    pr = `${WORKFLOWS_REFUSED}.`
  } else {
    const draft = await forge.openPr({
      branch: ticket.branch,
      title: prTitle(ticket),
      body: [
        `Parked by the factory Run \`${context.runId}\`: ${reason}.`,
        '',
        ...lastReview,
        '',
        `Related to ${ticket.id}`,
        `Part of ${context.specId}`,
        '',
        GENERATED,
      ].join('\n'),
      draft: true,
    })
    log.pr(draft.url)
    await forge.commentOnPr(
      draft.number,
      `${FACTORY}: @${forge.maintainer()} this ticket is parked and needs you: ${reason}.`,
    )
    pr = `Draft PR: ${draft.url}`
    draftUrl = draft.url
  }
  await tracker.setStatus(ticket.id, 'Todo')
  await tracker.setAgentLabel(ticket.id, 'needs-human')
  await tracker.comment(
    ticket.id,
    [
      `${PARKED} by factory Run \`${context.runId}\`: ${reason}.`,
      '',
      ...lastReview,
      '',
      pr,
      `Run log: ${join(context.runDir, ticket.id)}`,
      '',
      'To send it back to the factory, answer here, then swap `needs-human` for `ready-for-agent`.',
    ].join('\n'),
  )
  say('park', reason)
  await context.notifier.notify(ticketNotification(ticket, `parked, as ${reason}`, draftUrl))
  return 'parked'
}

/** The ticket's last park note and the comments since that the factory didn't write, if any. */
function previousParkOf(comments: Comment[]): TicketBrief['previousPark'] {
  const at = comments.findLastIndex((comment) => comment.body.startsWith(PARKED))
  const note = comments[at]
  if (!note) return undefined
  const since = comments
    .slice(at + 1)
    .filter((comment) => !comment.body.startsWith(FACTORY))
    .map((comment) => comment.body)
  return { note: note.body, since }
}

function writeLog(logDir: string, name: string, text: string) {
  mkdirSync(logDir, { recursive: true })
  writeFileSync(join(logDir, name), text)
}

function agentStep(settings: Settings, step: Step, prompt: string): AgentStep {
  const { model, effort } = settings[step]
  return { name: step, model, effort, prompt, idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS }
}

/**
 * The Reviewer's review, from a fresh session; when its answer can't be read, from one more.
 * Null when neither can be.
 */
async function readableReview(
  sandbox: Sandbox,
  settings: Settings,
  prompt: string,
  { say, log, agent }: Turn,
  round: number,
): Promise<Review | null> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const step = agentStep(settings, 'reviewer', prompt)
    // A Reviewer the idle timeout killed printed no review: it counts as unreadable.
    const review = readReview((await agent(sandbox, step)).stdout)
    log.review(round, attempt, review)
    say('Reviewer', review ? review.verdict : 'no readable <review>')
    if (review) return review
  }
  return null
}

function findingLines(review: Review): string[] {
  return review.findings.map(
    ({ severity, file, summary }) =>
      `- ${severity}, ${file}: ${summary.replace(CLOSING, 'Related to$1')}`,
  )
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
  for (const row of review.criteria) {
    if (row.kind === 'tested') replays.set(row.id, await replay(sandbox, row))
  }
  await sandbox.exec(CLEAN)
  return replays
}

async function replay(sandbox: Sandbox, row: TestedRow): Promise<boolean> {
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
  /** The Seen rows' screenshots, as the host copied them to the run log. */
  shots: Map<string, CopiedShots>
  checksPassed: boolean
  /** The Implementer's commits since origin/main. */
  commits: number
}

/** Why the push gate fails, or nothing when it passes. */
function pushGate(
  { review, replays, shots, checksPassed, commits }: Outcome,
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
  reasons.push(...seenGate(criteria, review, shots))
  return reasons
}

/**
 * Linear reads these words before an identifier as closing it, so text the factory didn't write
 * has them turned into "Related to" (CLAUDE.md, Tracking).
 */
export const CLOSING = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)(\s+[A-Z]+-\d+)/gi

/** Both `pnpm accuracy` summaries, for the PR body (CLAUDE.md: "pastes both summaries"). */
function accuracySection(accuracy: Accuracy): string[] {
  if (accuracy.kind !== 'measured') return []
  // The branch's code printed them, so they mustn't close another issue.
  const block = ({ on, summary }: AccuracyRun) => [
    `On ${on}:`,
    '',
    '```text',
    summary.replace(CLOSING, 'Related to$1').replaceAll('```', "'''"),
    '```',
    '',
  ]
  return [
    '## Reading accuracy',
    '',
    'The branch changes an ADR 24 path, so `pnpm accuracy` ran before and after (ADR 24).',
    '',
    ...block(accuracy.before),
    ...block(accuracy.after),
  ]
}

function prBody(
  context: RunContext,
  { ticket }: TicketBrief,
  mapping: string,
  accuracy: Accuracy,
): string {
  return [
    `Built by the factory Run \`${context.runId}\` from the spec ${context.specId}.`,
    '',
    '## Acceptance criteria',
    '',
    mapping.replace(CLOSING, 'Related to$1') || 'The Implementer wrote no mapping table.',
    '',
    ...accuracySection(accuracy),
    `Closes ${ticket.id}`,
    `Part of ${context.specId}`,
    '',
    GENERATED,
  ].join('\n')
}

const GENERATED = '🤖 Generated with [Claude Code](https://claude.com/claude-code)'

/** The Reviewer's rows as a Markdown table, with each replay's result. */
function reviewRows(review: Review, replays: Map<string, boolean>): string[] {
  return [
    '| Criterion | Test | Sabotage replay |',
    '| -- | -- | -- |',
    ...review.criteria.map(
      (row) =>
        `| ${row.id} | ${row.test.replace(CLOSING, 'Related to$1')} | ${proven(row, replays)} |`,
    ),
  ]
}

/** How a row was proven: its sabotage's replay (Tested), or the Reviewer's judgement (Seen). */
function proven(row: ReviewRow, replays: Map<string, boolean>): string {
  if (row.kind === 'seen') return `Seen: ${row.matches ? 'matches' : 'not matching'}`
  return replays.get(row.id) ? 'confirmed' : 'not confirmed'
}

/**
 * The Reviewer's verdict and rows, then each Seen criterion's judgement and its screenshots, by
 * their raw URLs on `factory-screenshots` (`urls`, by run-log copy).
 */
function reviewComment(
  review: Review,
  replays: Map<string, boolean>,
  shots: Map<string, CopiedShots>,
  urls: Map<string, string>,
): string {
  const seen = seenRows(review).flatMap((row) => [
    '',
    `**${row.id}** (Seen): ${row.judgement.replace(CLOSING, 'Related to$1').replace(/\s+/g, ' ')}`,
    '',
    ...(shots.get(row.id)?.files ?? []).map((file) => `![${basename(file)}](${urls.get(file)})`),
  ])
  return [
    `${FACTORY}: the Reviewer's verdict is **${review.verdict}**.`,
    '',
    ...reviewRows(review, replays),
    ...seen,
  ].join('\n')
}

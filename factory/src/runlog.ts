// The Run's log: `.factory/runs/<yyyy-mm-dd-hhmm>-<spec id>/` (DEV-282). run.json holds each
// ticket's steps and times, its agent steps with their cost, the Reviewer's verdicts, the
// replays, the fix rounds and the Run's summary, rewritten whenever something is added so a crash
// leaves what had happened. Beside it, each ticket's folder holds its agents' stdout and session
// JSONL (agents/), the host check logs (checks/, then fix-round-n/checks/), and its screenshots
// (screenshots/, DEV-281).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { sessionCost, type StepCost } from './cost.ts'
import type { AgentResult, AgentStep, AgentStop, Ticket } from './ports.ts'
import type { Finding, Review } from './review.ts'
import type { TicketOutcome } from './run.ts'

export interface StepRecord {
  step: string
  result: string
  /** ISO 8601: when the step before it finished, or the ticket's turn started. */
  startedAt: string
  finishedAt: string
}

export interface AgentRecord {
  step: string
  model: string
  effort: string
  resumed: string | null
  /** The session it ran in, which a fix round resumes, even after the host died. */
  sessionId: string | null
  /** Why it didn't finish, when it didn't. */
  stopped: AgentStop | null
  startedAt: string
  finishedAt: string
  /** Paths relative to the run folder. */
  stdout: string
  session: string | null
  /** Null when no session was captured to cost. */
  cost: StepCost | null
}

export interface TicketRecord {
  id: string
  title: string
  outcome: TicketOutcome | null
  pr: string | null
  fixRounds: number
  /** The priced cost of its agent steps, in US dollars. */
  cost: number
  steps: StepRecord[]
  agents: AgentRecord[]
  reviews: {
    round: number
    attempt: number
    verdict: Review['verdict'] | 'unreadable'
    findings: Finding[]
  }[]
  replays: { round: number; criterion: string; confirmed: boolean }[]
  /** The last step it finished that a later Run can resume from, if the host dies. */
  checkpoint: Checkpoint | null
}

/** The host checks' results, as the Reviewer and the push gate read them. */
export interface CheckResults {
  passed: boolean
  failed: string[]
  summary: string
}

/**
 * Where a ticket's turn can resume from (AC-29.1), each saved as its step finishes:
 * - `claimed`: In Progress with the claim comment, so it is never claimed twice;
 * - `implemented`: an agent step of `round` (0 for the Implementer) finished, with its work committed;
 * - `reviewed`: the host checks and a readable review of that round, before the replays;
 * - `shipped`: pushed, with its PR open and auto-merge queued, waiting on the checks.
 * `session` is the Implementer's, which every fix round resumes.
 */
export type Checkpoint =
  | { step: 'claimed' }
  | { step: 'implemented'; round: number; session: string | null }
  | {
      step: 'reviewed'
      round: number
      session: string | null
      checks: CheckResults
      review: Review
    }
  | {
      step: 'shipped'
      round: number
      session: string | null
      pr: { number: number; url: string }
      review: Review
      replays: Record<string, boolean>
    }

/** A pause for the usage limit (AC-27.2). */
export interface PauseRecord {
  ticket: string
  step: string
  /** ISO 8601: when the step hit the limit, and when agent steps may start again. */
  at: string
  until: string
  /** Whether the error gave the reset time; without it, the Run checks again every 15 minutes. */
  resetGiven: boolean
  message: string
}

export interface Summary {
  merged: number
  parked: number
  waitingForApproval: number
  /** Tickets whose turn stopped for a reason the factory doesn't handle yet (DEV-284). */
  stopped: number
  cost: number
  /** Models whose tokens aren't in the cost, for want of a price. */
  unpriced: string[]
  /** The follow-up issue of the Reviewer's judgement calls, if there were any. */
  followUp: string | null
}

export interface RunRecord {
  runId: string
  specId: string
  /** The host process running it, so a later Run can tell it died (AC-29.1). */
  pid: number
  startedAt: string
  /** When a later command took the Run up again after its host died. */
  resumedAt: string[]
  finishedAt: string | null
  tickets: TicketRecord[]
  pauses: PauseRecord[]
  summary: Summary | null
}

export class RunLog {
  readonly dir: string
  readonly #now: () => Date
  readonly #record: RunRecord
  /** The session messages already costed, so a resumed session counts only what it added. */
  readonly #counted = new Set<string>()

  /** A new Run's log, or with `resumed`, the record of a Run whose host died, taken up again. */
  constructor(
    dir: string,
    run: { runId: string; specId: string; pid: number },
    now: () => Date,
    resumed?: RunRecord,
  ) {
    this.dir = dir
    this.#now = now
    mkdirSync(dir, { recursive: true })
    // Keeps the whole of .factory/ out of `git status`, whatever the checkout's .gitignore says.
    writeFileSync(join(dir, '..', '..', '.gitignore'), '*\n')
    if (resumed) {
      this.#record = { ...resumed, pid: run.pid, finishedAt: null, summary: null }
      this.#record.resumedAt.push(this.#time())
      // The messages its sessions held are costed already: a resumed session adds only new ones.
      for (const agent of resumed.tickets.flatMap((ticket) => ticket.agents)) {
        const path = agent.session && join(dir, agent.session)
        if (path && existsSync(path)) sessionCost(readFileSync(path, 'utf8'), this.#counted)
      }
    } else {
      this.#record = {
        ...run,
        startedAt: this.#time(),
        resumedAt: [],
        finishedAt: null,
        tickets: [],
        pauses: [],
        summary: null,
      }
    }
    this.#save()
  }

  /** The Run's record in `dir`, as run.json holds it, or null when it holds none. */
  static read(dir: string): RunRecord | null {
    const file = join(dir, 'run.json')
    if (!existsSync(file)) return null
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as RunRecord
    } catch {
      return null
    }
  }

  /**
   * The log of one ticket's turn, which starts now. A ticket the Run had already, as one adopted
   * after its host died, carries on in its record.
   */
  ticket(ticket: Ticket): TicketLog {
    const existing = this.#record.tickets.find((record) => record.id === ticket.id)
    if (existing) return new TicketLog(this, existing, this.#time())
    const record: TicketRecord = {
      id: ticket.id,
      title: ticket.title,
      outcome: null,
      pr: null,
      fixRounds: 0,
      cost: 0,
      steps: [],
      agents: [],
      reviews: [],
      replays: [],
      checkpoint: null,
    }
    this.#record.tickets.push(record)
    this.#save()
    return new TicketLog(this, record, this.#time())
  }

  get runId(): string {
    return this.#record.runId
  }

  get specId(): string {
    return this.#record.specId
  }

  get tickets(): readonly TicketRecord[] {
    return this.#record.tickets
  }

  /** A pause for the usage limit. */
  pause(pause: PauseRecord): void {
    this.#record.pauses.push(pause)
    this.#save()
  }

  /** Ends the Run: its summary, with the follow-up issue when one was made. */
  finish(followUp: string | null): Summary {
    const count = (outcome: TicketOutcome) =>
      this.#record.tickets.filter((ticket) => ticket.outcome === outcome).length
    const unpriced = [
      ...new Set(
        this.#record.tickets.flatMap((ticket) =>
          ticket.agents.flatMap((agent) => agent.cost?.unpriced ?? []),
        ),
      ),
    ]
    const summary: Summary = {
      merged: count('merged'),
      parked: count('parked'),
      waitingForApproval: count('waiting for approval'),
      stopped: count('stopped'),
      cost: this.#record.tickets.reduce((sum, ticket) => sum + ticket.cost, 0),
      unpriced,
      followUp,
    }
    this.#record.summary = summary
    this.#record.finishedAt = this.#time()
    this.#save()
    return summary
  }

  /** @internal For TicketLog. */
  time(): string {
    return this.#time()
  }

  /** @internal For TicketLog. */
  cost(session: string): StepCost {
    return sessionCost(session, this.#counted)
  }

  /** @internal For TicketLog. */
  save(): void {
    this.#save()
  }

  /** Writes a file in the run folder and returns its path relative to it. */
  write(path: string, text: string): string {
    const file = join(this.dir, path)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, text)
    return relative(this.dir, file)
  }

  #time(): string {
    return this.#now().toISOString()
  }

  #save(): void {
    // Written whole, then moved into place, so a reader never sees half a file.
    const file = join(this.dir, 'run.json')
    writeFileSync(`${file}.tmp`, `${JSON.stringify(this.#record, null, 2)}\n`)
    renameSync(`${file}.tmp`, file)
  }
}

export class TicketLog {
  readonly #run: RunLog
  readonly #record: TicketRecord
  #lastFinished: string

  constructor(run: RunLog, record: TicketRecord, startedAt: string) {
    this.#run = run
    this.#record = record
    this.#lastFinished = startedAt
  }

  /** A finished step, timed from the end of the one before it. */
  step(step: string, result: string): void {
    const finishedAt = this.#run.time()
    this.#record.steps.push({ step, result, startedAt: this.#lastFinished, finishedAt })
    this.#lastFinished = finishedAt
    this.#run.save()
  }

  /**
   * Runs an agent step, saving its stdout and session JSONL to agents/ and its cost to run.json.
   */
  async agent(step: AgentStep, work: () => Promise<AgentResult>): Promise<AgentResult> {
    const startedAt = this.#run.time()
    const result = await work()
    const finishedAt = this.#run.time()
    const name = `${String(this.#record.agents.length + 1).padStart(2, '0')}-${step.name}`
    const base = join(this.#record.id, 'agents', name)
    const cost = result.session === undefined ? null : this.#run.cost(result.session)
    this.#record.agents.push({
      step: step.name,
      model: step.model,
      effort: step.effort,
      resumed: step.resumeSession ?? null,
      sessionId: result.sessionId ?? null,
      stopped: result.stopped ?? null,
      startedAt,
      finishedAt,
      stdout: this.#run.write(`${base}.stdout.txt`, result.stdout),
      session:
        result.session === undefined ? null : this.#run.write(`${base}.jsonl`, result.session),
      cost,
    })
    this.#record.cost += cost?.usd ?? 0
    this.#run.save()
    return result
  }

  /** A Reviewer's answer; null when it couldn't be read, which is logged as `unreadable`. */
  review(round: number, attempt: number, review: Review | null): void {
    this.#record.reviews.push({
      round,
      attempt,
      verdict: review?.verdict ?? 'unreadable',
      findings: review?.findings ?? [],
    })
    this.#run.save()
  }

  replays(round: number, replays: Map<string, boolean>): void {
    for (const [criterion, confirmed] of replays) {
      this.#record.replays.push({ round, criterion, confirmed })
    }
    this.#run.save()
  }

  fixRound(round: number): void {
    this.#record.fixRounds = round
    this.#run.save()
  }

  pr(url: string): void {
    this.#record.pr = url
    this.#run.save()
  }

  checkpoint(checkpoint: Checkpoint): void {
    this.#record.checkpoint = checkpoint
    this.#run.save()
  }

  outcome(outcome: TicketOutcome): void {
    this.#record.outcome = outcome
    this.#run.save()
  }
}

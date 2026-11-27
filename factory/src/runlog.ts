// The Run's log: `.factory/runs/<yyyy-mm-dd-hhmm>-<spec id>/` (DEV-282). run.json holds each
// ticket's steps and times, its agent steps with their cost, the Reviewer's verdicts, the
// replays, the fix rounds and the Run's summary, rewritten whenever something is added so a crash
// leaves what had happened. Beside it, each ticket's folder holds its agents' stdout and session
// JSONL (agents/), the host check logs (checks/, then fix-round-n/checks/), and its screenshots
// (screenshots/, DEV-281).
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { sessionCost, type StepCost } from './cost.ts'
import type { AgentStep, Ticket } from './ports.ts'
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

interface RunRecord {
  runId: string
  specId: string
  startedAt: string
  finishedAt: string | null
  tickets: TicketRecord[]
  summary: Summary | null
}

export class RunLog {
  readonly dir: string
  readonly #now: () => Date
  readonly #record: RunRecord
  /** The session messages already costed, so a resumed session counts only what it added. */
  readonly #counted = new Set<string>()

  constructor(dir: string, run: { runId: string; specId: string }, now: () => Date) {
    this.dir = dir
    this.#now = now
    mkdirSync(dir, { recursive: true })
    // Keeps the whole of .factory/ out of `git status`, whatever the checkout's .gitignore says.
    writeFileSync(join(dir, '..', '..', '.gitignore'), '*\n')
    this.#record = {
      ...run,
      startedAt: this.#time(),
      finishedAt: null,
      tickets: [],
      summary: null,
    }
    this.#save()
  }

  /** The log of one ticket's turn, which starts now. */
  ticket(ticket: Ticket): TicketLog {
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
  async agent<T extends { stdout: string; session?: string }>(
    step: AgentStep,
    work: () => Promise<T>,
  ): Promise<T> {
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

  outcome(outcome: TicketOutcome): void {
    this.#record.outcome = outcome
    this.#run.save()
  }
}

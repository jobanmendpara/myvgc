// `pnpm factory retro <spec>` (DEV-288): gathers a finished spec's retro bundle,
// `.factory/retros/<spec>/bundle.md`, for an interactive `/retro` session (What the retro after
// each spec reads and changes, DEV-258). It is a host script: it calls no agent or model, and it
// writes nothing to Linear or GitHub. It reads them through the Tracker and the Forge, and the
// spec's run logs from `.factory/runs/`.
//
// The bundle holds links and excerpts, not whole files: for each Run, its steps and times, the cost
// of each agent step, fix rounds, verdicts, replays, usage-limit pauses and crashes; each park, the
// maintainer's reply and how the ticket came back; the Reviewer's PR comments and the follow-up
// issues; CI failure logs, conflicts and rebases; the Bug issues related to the spec's tickets; and
// the session JSONL files, by path only.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stillOpen } from './frontier.ts'
import type { Comment, Forge, Issue, Ticket, Tracker } from './ports.ts'
import { CLAIMED, FACTORY, PARKED, REVIEWED } from './run.ts'
import type { Summary, TicketRecord } from './runlog.ts'

export interface RetroPorts {
  repoDir: string
  tracker: Tracker
  forge: Forge
  now: () => Date
  print: (line: string) => void
}

/** How long an excerpt of a comment or a description runs, in characters. */
const EXCERPT_CHARACTERS = 600
/** How many of a log's last lines an excerpt holds. */
const LOG_LINES = 15

/**
 * Writes the spec's retro bundle, or refuses when a ticket of the spec is still open and not
 * parked, naming each one. Returns whether it wrote the bundle.
 */
export async function retro(specId: string, ports: RetroPorts): Promise<boolean> {
  const { tracker, print } = ports
  const spec = await tracker.getIssue(specId)
  if (!spec) {
    print(`${specId} wasn't found in Linear.`)
    return false
  }
  if (!spec.labels.includes('spec')) {
    print(`${specId} isn't a spec: it has no \`spec\` label.`)
    return false
  }
  const tickets = [...(await tracker.getSubIssues(specId))].sort((a, b) => a.order - b.order)
  const open = stillOpen(tickets)
  if (open.length > 0) {
    print(
      `${specId} (${spec.title}) isn't done, so its retro can't start: these tickets are still open and not parked.`,
    )
    for (const ticket of open) print(`- ${ticket.id} ${ticket.title} (${ticket.status.name})`)
    return false
  }

  const runs = runsOf(ports.repoDir, specId)
  const bundle = [
    `# Retro bundle: ${specId} ${spec.title}`,
    '',
    `Gathered by \`pnpm factory retro ${specId}\` at ${ports.now().toISOString()}, for an interactive \`/retro\` session. It holds links and excerpts: open a path for the whole file.`,
    '',
    '## Tickets',
    '',
    ...tickets.map((ticket) => `- [${ticket.id} ${ticket.title}](${ticket.url}): ${state(ticket)}`),
    '',
    ...runSections(runs),
    ...(await parkSections(tracker, tickets)),
    ...(await reviewSections(ports, runs)),
    ...failureSections(runs),
    ...(await bugSections(tracker, tickets)),
    ...sessionSections(runs),
  ].join('\n')

  const factoryDir = join(ports.repoDir, '.factory')
  const dir = join(factoryDir, 'retros', specId)
  mkdirSync(dir, { recursive: true })
  // Keeps the whole of .factory/ out of `git status`, as the run log does.
  writeFileSync(join(factoryDir, '.gitignore'), '*\n')
  const path = join(dir, 'bundle.md')
  writeFileSync(path, `${bundle}\n`)
  print(`The retro bundle of ${specId} (${spec.title}): ${path}`)
  print(`Open an interactive session and run \`/retro\` on it.`)
  return true
}

const state = (ticket: Ticket) =>
  ticket.labels.includes('needs-human') ? `${ticket.status.name}, parked` : ticket.status.name

/** A Run's record, as run.json holds it; pauses and resumes only from DEV-286 on. */
interface LoggedRun {
  dir: string
  runId: string
  specId: string
  startedAt: string
  finishedAt: string | null
  /** When a later command took the Run up again after its host died. */
  resumedAt?: string[]
  pauses?: {
    ticket: string
    step: string
    at: string
    until: string
    resetGiven: boolean
    message: string
  }[]
  tickets: TicketRecord[]
  summary: Summary | null
}

/** Every Run of the spec in `.factory/runs/`, oldest first. */
function runsOf(repoDir: string, specId: string): LoggedRun[] {
  const root = join(repoDir, '.factory', 'runs')
  if (!existsSync(root)) return []
  return readdirSync(root)
    .flatMap((name) => {
      const file = join(root, name, 'run.json')
      if (!existsSync(file)) return []
      const record = JSON.parse(readFileSync(file, 'utf8')) as Omit<LoggedRun, 'dir'>
      return record.specId === specId ? [{ ...record, dir: join(root, name) }] : []
    })
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}

function runSections(runs: LoggedRun[]): string[] {
  if (runs.length === 0)
    return ['## Runs', '', 'No run log of this spec is in `.factory/runs/`.', '']
  return [
    '## Runs',
    '',
    ...runs.flatMap((run) => [
      `### Run ${run.runId}`,
      '',
      `Run log: ${run.dir}`,
      '',
      `Started ${run.startedAt}, ${run.finishedAt ? `finished ${run.finishedAt}` : 'never finished'}.`,
      ...(run.summary
        ? [
            `Summary: ${run.summary.merged} merged, ${run.summary.parked} parked, ${run.summary.waitingForApproval} waiting for approval, ${dollars(run.summary.cost)}.`,
          ]
        : []),
      '',
      '#### Usage-limit pauses and crashes',
      '',
      ...crashLines(run),
      '',
      ...(run.pauses?.length
        ? table(
            ['Ticket', 'Step', 'Paused at', 'Until', 'Reset time given', 'Message'],
            run.pauses.map((pause) => [
              pause.ticket,
              pause.step,
              pause.at,
              pause.until,
              pause.resetGiven ? 'yes' : 'no: checked every 15 minutes',
              excerpt(pause.message, 200),
            ]),
          )
        : ['No usage-limit pause.', '']),
      ...run.tickets.flatMap((ticket) => ticketSection(ticket, run.dir)),
    ]),
  ]
}

/** The Run's crashes: its host dying, and any ticket whose turn ended without an outcome. */
function crashLines(run: LoggedRun): string[] {
  const lines = [
    ...(run.finishedAt === null
      ? ["- The Run never finished: its host died, or it's still running."]
      : []),
    ...(run.resumedAt ?? []).map(
      (at) => `- Its host died, and a later command took it up again at ${at}.`,
    ),
    ...run.tickets
      .filter((ticket) => ticket.outcome === null)
      .map(
        (ticket) =>
          `- ${ticket.id}'s turn ended without an outcome, after ${ticket.steps.at(-1)?.step ?? 'no step'}: it crashed.`,
      ),
  ]
  return lines.length > 0 ? lines : ['No crash.']
}

function ticketSection(ticket: TicketRecord, runDir: string): string[] {
  return [
    `#### ${ticket.id} ${ticket.title}: ${ticket.outcome ?? 'unfinished'}`,
    '',
    `${ticket.fixRounds} fix round${ticket.fixRounds === 1 ? '' : 's'}, ${dollars(ticket.cost)}.${ticket.pr ? ` PR: ${ticket.pr}` : ''}`,
    '',
    'Steps:',
    '',
    ...table(
      ['Step', 'Result', 'Started', 'Finished', 'Took'],
      ticket.steps.map((step) => [
        step.step,
        step.result,
        step.startedAt,
        step.finishedAt,
        took(step.startedAt, step.finishedAt),
      ]),
    ),
    'Agent steps:',
    '',
    ...table(
      ['Step', 'Model', 'Effort', 'Started', 'Took', 'Cost', 'Stdout'],
      ticket.agents.map((agent) => [
        agent.step,
        agent.model,
        agent.effort,
        agent.startedAt,
        took(agent.startedAt, agent.finishedAt),
        agent.cost ? dollars(agent.cost.usd) : 'no session to cost',
        join(runDir, agent.stdout),
      ]),
    ),
    'Verdicts:',
    '',
    ...table(
      ['Round', 'Attempt', 'Verdict', 'Findings'],
      ticket.reviews.map((review) => [
        String(review.round),
        String(review.attempt),
        review.verdict,
        review.findings
          .map((finding) => `${finding.severity}: ${finding.file}: ${finding.summary}`)
          .join('; ') || 'none',
      ]),
    ),
    'Replays:',
    '',
    ...table(
      ['Round', 'Criterion', 'Confirmed'],
      ticket.replays.map((replay) => [
        String(replay.round),
        replay.criterion,
        replay.confirmed ? 'yes' : 'no',
      ]),
    ),
  ]
}

/** Each park note, the maintainer's reply to it, and how the ticket came back from it. */
async function parkSections(tracker: Tracker, tickets: Ticket[]): Promise<string[]> {
  const sections: string[] = []
  for (const ticket of tickets) {
    const comments = await tracker.getComments(ticket.id)
    comments.forEach((comment, index) => {
      if (!comment.body.startsWith(PARKED)) return
      const after = comments.slice(index + 1)
      const next = after.findIndex(
        (each) => each.body.startsWith(CLAIMED) || each.body.startsWith(PARKED),
      )
      const replies = (next === -1 ? after : after.slice(0, next)).filter(
        (each) => !each.body.startsWith(FACTORY),
      )
      sections.push(
        `### ${ticket.id} ${ticket.title}, parked ${comment.createdAt}`,
        '',
        quote(comment),
        '',
        "The maintainer's reply:",
        '',
        ...(replies.length > 0
          ? replies.flatMap((reply) => [quote(reply), ''])
          : ['No reply.', '']),
        `How it came back: ${cameBack(ticket, after[next])}`,
        '',
      )
    })
  }
  return ['## Parked tickets', '', ...(sections.length > 0 ? sections : ['No ticket parked.', ''])]
}

function cameBack(ticket: Ticket, next: Comment | undefined): string {
  if (next?.body.startsWith(CLAIMED)) {
    const run = /`([^`]+)`/.exec(next.body)?.[1]
    return `factory Run \`${run}\` took it up again at ${next.createdAt}.`
  }
  if (next) return `it was parked again at ${next.createdAt} before a Run took it up.`
  if (ticket.labels.includes('needs-human')) return `it hasn't: it's still parked.`
  return `without another factory Run: it's ${ticket.status.name}.`
}

/** The Reviewer's PR comments on each PR of the spec's Runs, and each Run's follow-up issue. */
async function reviewSections({ forge, tracker }: RetroPorts, runs: LoggedRun[]) {
  const prs = new Map<string, string>()
  for (const ticket of runs.flatMap((run) => run.tickets)) {
    if (ticket.pr) prs.set(ticket.pr, `${ticket.id} ${ticket.title}`)
  }
  const comments: string[] = []
  for (const [url, ticket] of prs) {
    const number = Number(/\/pull\/(\d+)/.exec(url)?.[1])
    if (!number) continue
    for (const comment of await forge.prComments(number)) {
      if (!comment.body.startsWith(REVIEWED)) continue
      comments.push(
        `- ${ticket}, ${comment.createdAt}: ${comment.url}`,
        '',
        indent(quote(comment)),
        '',
      )
    }
  }
  const followUps: string[] = []
  for (const run of runs) {
    const id = run.summary?.followUp
    if (!id) continue
    const issue = await tracker.getIssue(id)
    followUps.push(`- ${id} ${issue?.title ?? "(Linear didn't find it)"}, from Run ${run.runId}`)
  }
  return [
    '## Review results',
    '',
    "### The Reviewer's PR comments",
    '',
    ...(comments.length > 0 ? comments : ['None.', '']),
    '### Follow-up issues of judgement calls',
    '',
    ...(followUps.length > 0 ? followUps : ['None.']),
    '',
  ]
}

/** The CI failure logs after a push, and each rebase onto main, with its log when it conflicted. */
function failureSections(runs: LoggedRun[]): string[] {
  const ci: string[] = []
  const rebases: string[] = []
  for (const run of runs) {
    for (const ticket of run.tickets) {
      const dir = join(run.dir, ticket.id)
      const rounds = existsSync(dir)
        ? readdirSync(dir)
            .filter((name) => /^fix-round-\d+$/.test(name))
            .sort()
        : []
      for (const round of rounds) {
        const log = join(dir, round, 'ci.log')
        if (!existsSync(log)) continue
        ci.push(
          `- ${ticket.id}, Run ${run.runId}, before ${round}: ${log}`,
          '',
          fence(lastLines(readFileSync(log, 'utf8'))),
          '',
        )
      }
      for (const step of ticket.steps.filter((each) => each.step === 'rebase')) {
        rebases.push(`- ${ticket.id}, Run ${run.runId}, ${step.finishedAt}: ${step.result}`)
      }
      const rebaseLog = join(dir, 'rebase.log')
      if (existsSync(rebaseLog)) {
        rebases.push('', `  ${rebaseLog}`, '', fence(lastLines(readFileSync(rebaseLog, 'utf8'))))
      }
    }
  }
  return [
    '## Failures',
    '',
    '### CI failure logs',
    '',
    ...(ci.length > 0 ? ci : ['None.', '']),
    '### Conflicts and rebases',
    '',
    ...(rebases.length > 0 ? rebases : ['None.']),
    '',
  ]
}

/** The Bug issues a relation links to one of the spec's tickets. */
async function bugSections(tracker: Tracker, tickets: Ticket[]): Promise<string[]> {
  const bugs = new Map<string, { issue: Issue; tickets: string[] }>()
  for (const ticket of tickets) {
    for (const issue of await tracker.getRelatedIssues(ticket.id)) {
      if (!issue.labels.includes('Bug')) continue
      const bug = bugs.get(issue.id) ?? { issue, tickets: [] }
      bug.tickets.push(ticket.id)
      bugs.set(issue.id, bug)
    }
  }
  return [
    "## Bug issues traced back to the spec's tickets",
    '',
    ...(bugs.size > 0
      ? [...bugs.values()].flatMap(({ issue, tickets: related }) => [
          `- ${issue.id} ${issue.title}, related to ${related.join(', ')}`,
          '',
          indent(quote({ body: issue.description })),
          '',
        ])
      : ['None.', '']),
  ]
}

function sessionSections(runs: LoggedRun[]): string[] {
  const sessions = runs.flatMap((run) =>
    run.tickets.flatMap((ticket) =>
      ticket.agents.flatMap((agent) =>
        agent.session ? [`- ${join(run.dir, agent.session)}`] : [],
      ),
    ),
  )
  return ['## Session JSONL files', '', ...(sessions.length > 0 ? sessions : ['None.']), '']
}

/** A Markdown table, then a blank line; "None." for no rows. */
function table(headings: string[], rows: string[][]): string[] {
  if (rows.length === 0) return ['None.', '']
  const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')
  return [
    `| ${headings.join(' | ')} |`,
    `| ${headings.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
    '',
  ]
}

/** The start of a long text, marked as cut when it is. */
function excerpt(text: string, characters = EXCERPT_CHARACTERS): string {
  const trimmed = text.trim()
  return trimmed.length > characters ? `${trimmed.slice(0, characters).trimEnd()} …` : trimmed
}

const quote = ({ body }: { body: string }) =>
  excerpt(body)
    .split('\n')
    .map((line) => `> ${line}`.trimEnd())
    .join('\n')

const indent = (text: string) =>
  text
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')

const lastLines = (text: string) => text.trimEnd().split('\n').slice(-LOG_LINES).join('\n')

const fence = (text: string) => ['  ```', indent(text), '  ```'].join('\n')

function took(from: string, to: string): string {
  const seconds = Math.round((Date.parse(to) - Date.parse(from)) / 1000)
  if (!Number.isFinite(seconds)) return ''
  const minutes = Math.floor(seconds / 60)
  return minutes > 0 ? `${minutes} min ${seconds % 60} s` : `${seconds} s`
}

const dollars = (usd: number) => `$${usd.toFixed(2)}`

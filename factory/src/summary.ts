// The end of a Run (DEV-282): one follow-up issue of the Reviewer's judgement calls, if it made
// any, then the summary printed and saved to run.json, and the end's notification (DEV-287).
import type { FactoryPorts } from './factory.ts'
import type { Tracker } from './ports.ts'
import { CLOSING } from './run.ts'
import type { RunLog, Summary, TicketRecord } from './runlog.ts'

export async function endRun(
  { print, notifier }: Pick<FactoryPorts, 'print' | 'notifier'>,
  tracker: Tracker,
  log: RunLog,
  { crashed }: { crashed: boolean },
): Promise<Summary> {
  const { runId, specId } = log
  const calls = log.tickets.flatMap((ticket) => {
    const findings = judgementCalls(ticket)
    return findings.length > 0 ? [{ ticket, findings }] : []
  })
  let followUp: { id: string; url: string } | null = null
  let followUpFailed: string | undefined
  if (calls.length > 0) {
    try {
      followUp = await tracker.createIssue({
        title: `The Reviewer's judgement calls from factory Run ${runId}`,
        description: [
          `🏭 Factory Run \`${runId}\` of ${specId}: the Reviewer's findings that weren't hard, from every round. Some may have been dealt with in a later round. Sort them: fix, file or drop each one.`,
          ...calls.flatMap(({ ticket, findings }) => [
            '',
            `## ${ticket.id} ${ticket.title}`,
            '',
            ticket.pr ? `PR: ${ticket.pr} (${outcomeOf(ticket)})` : `No PR (${outcomeOf(ticket)}).`,
            '',
            ...findings.map(
              ({ file, summary }) => `- ${file}: ${summary.replace(CLOSING, 'Related to$1')}`,
            ),
          ]),
          '',
          `Related to ${specId}`,
        ].join('\n'),
        label: 'Improvement',
        relatedTo: specId,
      })
    } catch (error) {
      // The summary still prints, and the judgement calls stay in run.json's reviews.
      followUpFailed = error instanceof Error ? error.message : String(error)
    }
  }
  const summary = log.finish(followUp?.id ?? null)
  const counts = [
    `${summary.merged} merged`,
    `${summary.parked} parked`,
    `${summary.waitingForApproval} waiting for approval`,
    ...(summary.stopped > 0 ? [`${summary.stopped} stopped`] : []),
  ]
  print(`Run ${runId} done: ${counts.join(', ')}, ${dollars(summary.cost)}.`)
  for (const ticket of log.tickets) {
    print(`- ${ticket.id} ${ticket.title}: ${outcomeOf(ticket)}, ${dollars(ticket.cost)}`)
  }
  for (const model of summary.unpriced) {
    print(`The factory has no price for ${model}: ${model}'s tokens aren't in the cost.`)
  }
  if (followUp) {
    print(`Follow-up issue of the Reviewer's judgement calls: ${followUp.id} ${followUp.url}`)
  }
  if (followUpFailed) {
    print(
      `The follow-up issue of the Reviewer's judgement calls couldn't be created: ${followUpFailed}. They are in run.json.`,
    )
  }
  print(`Run log: ${log.dir}`)
  // A crashed Run's notification is the crash's, from src/cli.ts (src/notify.ts).
  if (!crashed) {
    await notifier.notify({
      text: `🏭 Run ${runId} done: ${counts.join(', ')}, ${dollars(summary.cost)}`,
      link: log.dir,
    })
  }
  return summary
}

/** A turn that threw has no outcome. */
const outcomeOf = (ticket: TicketRecord) => ticket.outcome ?? 'unfinished'

/** The non-hard findings of every review of the ticket, each once. */
function judgementCalls(ticket: TicketRecord) {
  const seen = new Set<string>()
  return ticket.reviews
    .flatMap((review) => review.findings)
    .filter((finding) => {
      const key = `${finding.file}\n${finding.summary}`
      if (finding.severity === 'hard' || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const dollars = (usd: number) => `$${usd.toFixed(2)}`

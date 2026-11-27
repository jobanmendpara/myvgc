// The prompts for a Run's agent steps. The sandbox has no Linear, so the host writes the ticket and
// the criteria it covers into each prompt (How a factory Run works, DEV-253).
import type { Criterion } from './criteria.ts'
import type { Ticket } from './ports.ts'
import { modelName } from './settings.ts'

/** Where the Implementer writes the criterion → test or screenshot table: outside the worktree. */
export const MAPPING_FILE = '/home/agent/factory/mapping.md'

export interface TicketBrief {
  ticket: Ticket
  specId: string
  criteria: Criterion[]
  /** The workspace's packages and their dependencies (src/workspace.ts). */
  workspace: string
  /** When the ticket was parked before: the factory's park note and what was said since. */
  previousPark?: { note: string; since: string[] }
}

function describePreviousPark({ previousPark }: TicketBrief): string {
  if (!previousPark) return ''
  const since =
    previousPark.since.length > 0
      ? previousPark.since.map((comment) => `- ${comment}`).join('\n')
      : '- (nothing)'
  return `
The factory parked this ticket before, and the maintainer has sent it back. The branch holds the work so far, with any commits the maintainer added: build on it. The factory's note:
${previousPark.note}
What was said on the ticket since:
${since}
`
}

function describeTicket({ ticket, specId, criteria }: TicketBrief): string {
  return [
    `Ticket ${ticket.id}: ${ticket.title} (part of the spec ${specId})`,
    '',
    ticket.description,
    '',
    'The acceptance criteria it covers, from the signed-off spec. They are fixed: never change one.',
    ...criteria.map((criterion) => `- ${criterion.id} (${criterion.kind}): ${criterion.text}`),
  ].join('\n')
}

export function implementerPrompt(brief: TicketBrief, model: string): string {
  return `You are the Implementer in a factory Run for the MyVGC repo. Follow CLAUDE.md, CONTEXT.md and the ADRs in docs/adr/.

${describeTicket(brief)}
${describePreviousPark(brief)}
Work test-first (the tdd skill) at the highest seam the spec's Testing Decisions name. Every Tested criterion needs a test that checks its behaviour through a public interface. Don't put criterion IDs in test names.

The workspace's packages:
${brief.workspace}
Run the tests of every package you change and of every package that depends on one you change, one test file at a time. Don't run the full \`pnpm test\`: it takes 5 to 10 minutes here, and the host runs it, with typecheck, lint and format:check, after you finish.

Commit your work on the current branch. End each commit message with ${commitEnding(brief, model)}. Don't push, open a PR or touch Linear: the host does that.

Write ${MAPPING_FILE}: a Markdown table with the columns Criterion | Test file | Test name, one row per criterion you cover (for a Seen criterion, the page and options to screenshot in place of the test).

If a criterion is wrong or impossible, don't bend it: commit what you have, print <park>why, naming the criterion</park>, and stop. The host parks the ticket for the maintainer.`
}

export function reviewerPrompt(brief: TicketBrief, hostChecks: string): string {
  return `You are the Reviewer in a factory Run for the MyVGC repo. Review the commits on this branch since origin/main (\`git diff origin/main...HEAD\`) against the ticket, CLAUDE.md and the ADRs. Commit nothing, and leave the working tree clean.

${describeTicket(brief)}

The host already ran the full checks in this sandbox:
${hostChecks}
Don't run the full \`pnpm test\`: run single test files.

Do the sabotage and verdict work yourself. Use subagents (Haiku 5.5) only to find code.

For every Tested criterion, write a sabotage: the smallest change to the implementation, never to a test file, that breaks that criterion's behaviour while everything still compiles. Apply it, run the criterion's test and check it fails on an assertion, not on a load or compile error. Undo it with \`git checkout -- .\` and check the test passes again. The host replays every sabotage itself, so each must apply with \`git apply\` to the committed branch, and its test command must be a Vitest run of the files that prove the criterion.

Print exactly one JSON object between <review> and </review>, shaped:
{"verdict": "pass" | "fail",
 "criteria": [{"id": "AC-1.1", "kind": "tested", "test": "<file> › <test name>", "testCommand": "pnpm --filter <package> exec vitest run <file> -t '<test name>'", "sabotagePatch": "<unified diff>"}],
 "findings": [{"severity": "hard" | "judgement", "file": "<path>", "summary": "<one sentence>"}]}
Give the verdict "fail" when any criterion lacks a test whose sabotage fails it, when the host checks failed, or when there is any hard finding against the standards or the spec.`
}

const commitEnding = ({ specId }: TicketBrief, model: string) =>
  `"Part of ${specId}" and then the line "Co-Authored-By: ${modelName(model)} <noreply@anthropic.com>"`

/** Why a fix round runs: the push gate's reasons and what the Reviewer and the host found. */
export interface GateFailure {
  reasons: string[]
  hostChecks: string
  /** The Reviewer's per-criterion rows, with each replay's result, as a Markdown table. */
  rows: string[]
  /** The Reviewer's findings, one per line. */
  findings: string[]
}

/**
 * The prompt that resumes the Implementer's session for a fix round after CI failed on the pushed
 * branch. `log` is the end of the failed checks' logs.
 */
export function ciFixRoundPrompt(
  round: number,
  rounds: number,
  brief: TicketBrief,
  log: string,
  model: string,
): string {
  return `Fix round ${round} of ${rounds}. The host pushed your branch and opened its PR, but CI failed on it. This is a new sandbox on the pushed branch, with the workspace installed. The end of the failed checks' logs:

${log}

Find why CI failed where the host checks passed, and fix it test-first, without changing any criterion. Run single test files only, as before; the host runs the full checks and a fresh Reviewer again after you. Commit, ending each commit message with ${commitEnding(brief, model)}, and bring ${MAPPING_FILE} up to date. If a criterion is wrong or impossible, print <park>why, naming the criterion</park> and stop.`
}

/** The prompt that resumes the Implementer's session for a fix round. */
export function fixRoundPrompt(
  round: number,
  rounds: number,
  brief: TicketBrief,
  failure: GateFailure,
  model: string,
): string {
  return `Fix round ${round} of ${rounds}. The push gate failed, so nothing was pushed: ${failure.reasons.join('; ')}.

The host checks:
${failure.hostChecks}
${failure.rows.length > 0 ? `\nThe Reviewer's rows, with the host's replay of each sabotage. A replay is confirmed only when the test fails on an assertion under the sabotage and passes again once it's undone:\n${failure.rows.join('\n')}\n` : ''}${failure.findings.length > 0 ? `\nThe Reviewer's findings:\n${failure.findings.join('\n')}\n` : ''}
Fix what failed, test-first, without changing any criterion. Run single test files only, as before. Commit, ending each commit message with ${commitEnding(brief, model)}, and bring ${MAPPING_FILE} up to date. If a criterion is wrong or impossible, print <park>why, naming the criterion</park> and stop.`
}

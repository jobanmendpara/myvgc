// The prompts for a Run's agent steps. The sandbox has no Linear, so the host writes the ticket and
// the criteria it covers into each prompt (How a factory Run works, DEV-253).
import type { Criterion } from './criteria.ts'
import type { Ticket } from './ports.ts'
import { modelName, STEPS } from './settings.ts'

/** Where the Implementer writes the criterion → test or screenshot table: outside the worktree. */
export const MAPPING_FILE = '/home/agent/factory/mapping.md'

export interface TicketBrief {
  ticket: Ticket
  specId: string
  criteria: Criterion[]
  /** The workspace's packages and their dependencies (src/workspace.ts). */
  workspace: string
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

export function implementerPrompt(brief: TicketBrief): string {
  return `You are the Implementer in a factory Run for the MyVGC repo. Follow CLAUDE.md, CONTEXT.md and the ADRs in docs/adr/.

${describeTicket(brief)}

Work test-first (the tdd skill) at the highest seam the spec's Testing Decisions name. Every Tested criterion needs a test that checks its behaviour through a public interface. Don't put criterion IDs in test names.

The workspace's packages:
${brief.workspace}
Run the tests of every package you change and of every package that depends on one you change, one test file at a time. Don't run the full \`pnpm test\`: it takes 5 to 10 minutes here, and the host runs it, with typecheck, lint and format:check, after you finish.

Commit your work on the current branch. End each commit message with "Part of ${brief.specId}" and then the line "Co-Authored-By: ${modelName(STEPS.implementer.model)} <noreply@anthropic.com>". Don't push, open a PR or touch Linear: the host does that.

Write ${MAPPING_FILE}: a Markdown table with the columns Criterion | Test file | Test name, one row per criterion you cover (for a Seen criterion, the page and options to screenshot in place of the test).`
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

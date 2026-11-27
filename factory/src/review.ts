// The Reviewer's verdict and the host's replay of its sabotages (How specs prove themselves,
// DEV-252; How a factory Run works, DEV-253).

import type { CriterionKind } from './criteria.ts'

export interface ReviewRow {
  /** The criterion, such as AC-3.1. */
  id: string
  kind: CriterionKind
  /** The test that proves it: "file › name". */
  test: string
  /** Runs that test with Vitest, such as `pnpm --filter @myvgc/core exec vitest run <file> -t '<name>'`. */
  testCommand: string
  /** The smallest compiling change to the implementation that breaks the criterion, as a diff. */
  sabotagePatch: string
}

export interface Finding {
  severity: 'hard' | 'judgement'
  file: string
  summary: string
}

export interface Review {
  verdict: 'pass' | 'fail'
  criteria: ReviewRow[]
  findings: Finding[]
}

/** The last `<name>…</name>` block in an agent's output: Sandcastle has no structured output. */
export function lastTag(stdout: string, name: string): string | undefined {
  return [...stdout.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g'))]
    .at(-1)?.[1]
    ?.trim()
}

/** The Reviewer's `<review>` JSON, or null when it's missing or not shaped like a Review. */
export function readReview(stdout: string): Review | null {
  const text = lastTag(stdout, 'review')
  if (!text) return null
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  const review = value as Partial<Review>
  if (review.verdict !== 'pass' && review.verdict !== 'fail') return null
  if (!Array.isArray(review.criteria) || !Array.isArray(review.findings)) return null
  const rowsOk = review.criteria.every(
    (row) =>
      typeof row?.id === 'string' &&
      (row.kind === 'tested' || row.kind === 'seen') &&
      typeof row.test === 'string' &&
      (row.kind === 'seen' ||
        (typeof row.testCommand === 'string' && typeof row.sabotagePatch === 'string')),
  )
  return rowsOk ? (review as Review) : null
}

/** What Vitest's `--reporter=json` writes, as much of it as a replay reads. */
interface VitestReport {
  numFailedTests: number
  testResults: {
    status: string
    message?: string
    assertionResults: { status: string; failureMessages: string[] }[]
  }[]
}

/**
 * Whether a sabotaged run's Vitest JSON report shows the sabotage caught by an assertion: at least
 * one failed test, no suite errors (a file that failed to load or compile, or a hook that threw),
 * and an assertion failure message. Matching text in the output instead was too weak in the spike (DEV-251).
 */
export function caughtByAssertion(reportJson: string): boolean {
  let report: VitestReport
  try {
    report = JSON.parse(reportJson) as VitestReport
  } catch {
    return false
  }
  if (!(report.numFailedTests >= 1)) return false
  // A file that failed to load or compile, or whose hooks threw, reports a message of its own.
  const suiteError = report.testResults.some(
    (file) => file.status === 'failed' && Boolean(file.message),
  )
  if (suiteError) return false
  return report.testResults.some((file) =>
    file.assertionResults.some(
      (test) =>
        test.status === 'failed' &&
        test.failureMessages.some((message) => message.includes('AssertionError')),
    ),
  )
}

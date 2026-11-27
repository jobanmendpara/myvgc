// The Reviewer's verdict and the host's replay of its sabotages (How specs prove themselves,
// DEV-252; How a factory Run works, DEV-253).

/** The Reviewer's row for a Tested criterion. */
export interface TestedRow {
  /** The criterion, such as AC-3.1. */
  id: string
  kind: 'tested'
  /** The test that proves it: "file › name". */
  test: string
  /** Runs that test with Vitest, such as `pnpm --filter @myvgc/core exec vitest run <file> -t '<name>'`. */
  testCommand: string
  /** The smallest compiling change to the implementation that breaks the criterion, as a diff. */
  sabotagePatch: string
}

/** The Reviewer's row for a Seen criterion: the screenshots it took and what it made of them. */
export interface SeenRow {
  id: string
  kind: 'seen'
  /** The page and `pnpm screenshots` options it shot. */
  test: string
  /** The shots' paths in the checkout, such as `.preview/screenshots/teams-phone.png`. */
  screenshots: string[]
  /** Whether the shots show what the criterion says. Only `true` passes. */
  matches: boolean
  /** Why, in a sentence or two. */
  judgement: string
}

export type ReviewRow = TestedRow | SeenRow

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
  const review = value as { verdict?: unknown; criteria?: unknown; findings?: unknown }
  if (review.verdict !== 'pass' && review.verdict !== 'fail') return null
  if (!Array.isArray(review.criteria) || !Array.isArray(review.findings)) return null
  const criteria: ReviewRow[] = []
  for (const row of review.criteria as Record<string, unknown>[]) {
    if (typeof row?.id !== 'string' || typeof row.test !== 'string') return null
    if (row.kind === 'tested') {
      if (typeof row.testCommand !== 'string' || typeof row.sabotagePatch !== 'string') return null
      criteria.push(row as unknown as TestedRow)
    } else if (row.kind === 'seen') {
      // A Seen row missing its shots or its judgement is still read, so the push gate can fail it.
      criteria.push({
        id: row.id,
        kind: 'seen',
        test: row.test,
        screenshots: Array.isArray(row.screenshots)
          ? row.screenshots.filter((path): path is string => typeof path === 'string')
          : [],
        matches: row.matches === true,
        judgement: typeof row.judgement === 'string' ? row.judgement : '',
      })
    } else {
      return null
    }
  }
  return { verdict: review.verdict, criteria, findings: review.findings as Finding[] }
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

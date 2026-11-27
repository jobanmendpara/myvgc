// `pnpm accuracy` before and after a change to the image reader (ADR 24, DEV-280). CLAUDE.md asks
// every PR that changes the reader's instructions, `seenTeamSchema`, the default model or the web
// app's image shrinking to run it on the base and on the branch and show both summaries. So before
// the push, when the branch touches an ADR 24 path, the factory runs it on the commit the branch
// forks from and on the branch, and the PR body carries both summaries.
//
// The key comes from ANTHROPIC_API_KEY in ~/.config/myvgc-factory/config.env, never from
// .sandcastle/.env, and reaches only the accuracy command's environment: the sandbox and its agents
// never hold it. Only a ticket that touches an ADR 24 path needs it, so a Run starts without it and
// such a ticket parks when it's missing.
//
// ADR_24_PATHS is a subset of the risky-path gate's inline list in
// .github/workflows/risky-change-gate.yml (DEV-250, the spec's H-6): the ADR 24 reading files, not
// migrations, docs/adr/ or .github/. Changing either list means checking the other. This note
// belongs in docs/wiki/factory.md once that page exists (DEV-276).
import type { ExecResult, Sandbox } from './ports.ts'

/** The ADR 24 reading files: a path is one when it equals an entry or lies under one ending in /. */
const ADR_24_PATHS = [
  // The reader's instructions and output format.
  'apps/api/src/team-reader.ts',
  // `seenTeamSchema` and `readSeenTeam`.
  'packages/core/src/seen-team.ts',
  // The default model.
  'apps/api/src/config.ts',
  // The web app's image shrinking.
  'apps/web/app/lib/shrink-image.ts',
  // The accuracy check itself.
  'apps/api/test/reading-fixtures/',
  'apps/api/test/reading.accuracy.ts',
  'apps/api/scripts/accuracy.ts',
]

const touchesAdr24 = (file: string) =>
  ADR_24_PATHS.some((path) => (path.endsWith('/') ? file.startsWith(path) : file === path))

const CLEAN = 'git checkout -- . && git clean -fd'

/** One `pnpm accuracy` run: on the base commit or on the branch. */
export interface AccuracyRun {
  /** "the base commit <sha>" or "the branch". */
  on: string
  /** The summary it printed, or what happened when it printed none. */
  summary: string
  /** Its whole output, for the run log. */
  log: string
}

export type Accuracy =
  | { kind: 'not needed' }
  | { kind: 'measured'; before: AccuracyRun; after: AccuracyRun }
  | { kind: 'unmeasured'; problem: string }

/**
 * Runs `pnpm accuracy` on the base commit and then on the branch when the branch changes an ADR 24
 * path; otherwise runs nothing. `key` is the Anthropic API key, or undefined when the set-up has
 * none, and `keyHome` says where it belongs.
 */
export async function measureAccuracy(
  sandbox: Sandbox,
  branch: string,
  key: string | undefined,
  keyHome: string,
): Promise<Accuracy> {
  const changed = await sandbox.exec('git diff --name-only origin/main...HEAD')
  const files = changed.stdout.split('\n').filter(Boolean)
  if (!files.some(touchesAdr24)) return { kind: 'not needed' }
  if (!key) {
    return {
      kind: 'unmeasured',
      problem: `the branch changes an ADR 24 path, so \`pnpm accuracy\` must run, and it needs ANTHROPIC_API_KEY in ${keyHome}`,
    }
  }
  const base = (await sandbox.exec('git merge-base origin/main HEAD')).stdout.trim()
  if (!/^[0-9a-f]{7,40}$/.test(base)) {
    return {
      kind: 'unmeasured',
      problem: "the branch's base commit couldn't be found for `pnpm accuracy`",
    }
  }
  const accuracy = async (on: string): Promise<AccuracyRun> => {
    const result = await sandbox.exec('pnpm accuracy', { env: { ANTHROPIC_API_KEY: key } })
    // Its report, under apps/api/.accuracy/, is gitignored; anything else it left is cleared.
    await sandbox.exec(CLEAN)
    return { on, summary: summaryOf(result), log: result.stdout + result.stderr }
  }

  if ((await sandbox.exec(`git checkout --detach ${base}`)).exitCode !== 0) {
    return { kind: 'unmeasured', problem: `the base commit ${base} couldn't be checked out` }
  }
  const before = await accuracy(`the base commit ${base}`)
  if ((await sandbox.exec(`git checkout ${branch}`)).exitCode !== 0) {
    return {
      kind: 'unmeasured',
      problem: `the branch couldn't be checked out again after \`pnpm accuracy\``,
    }
  }
  const after = await accuracy('the branch')
  return { kind: 'measured', before, after }
}

/**
 * The summary apps/api/test/reading.accuracy.ts prints at the end: from its "Reading accuracy, "
 * line up to the report's path.
 */
function summaryOf({ exitCode, stdout }: ExecResult): string {
  const lines = stdout.split('\n')
  const start = lines.findIndex((line) => line.startsWith('Reading accuracy, '))
  if (start === -1) {
    return `\`pnpm accuracy\` printed no summary (exit ${exitCode}): see its log in the run log.`
  }
  const end = lines.findIndex((line, at) => at > start && line.startsWith('Report: '))
  return lines
    .slice(start, end === -1 ? undefined : end)
    .join('\n')
    .trimEnd()
}

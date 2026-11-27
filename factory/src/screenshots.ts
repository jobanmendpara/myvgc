// Seen criteria, proven by screenshots (DEV-269, story 33). The Reviewer takes them in the sandbox
// with `pnpm preview` and `pnpm screenshots`, and says whether each criterion's shots match it. The
// host copies the shots to the run log, and once the push gate passes, pushes them to the orphan
// branch `factory-screenshots` under `DEV-N/<run>/`, so the PR comment can embed them by raw URL.
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Criterion } from './criteria.ts'
import type { Forge, Sandbox } from './ports.ts'
import type { Review, SeenRow } from './review.ts'

/** The orphan branch that holds every Run's screenshots, so PR comments can link them for good. */
export const SCREENSHOT_BRANCH = 'factory-screenshots'

/**
 * Where `pnpm screenshots` saves its shots. Only PNGs there are read: the path is the Reviewer's
 * text, so nothing else it names (another folder, a shell word) reaches the sandbox's shell.
 */
const SHOT = /^\.preview\/screenshots\/[\w.-]+\.png$/
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** A Seen row's shots once the host has copied them: the run-log copies, and how many it couldn't. */
export interface CopiedShots {
  files: string[]
  missing: number
}

/**
 * Copies each Seen row's screenshots out of the sandbox to `<logDir>/screenshots/`. A path outside
 * `.preview/screenshots/`, a file the sandbox doesn't have, or one that isn't a PNG counts as missing.
 */
export async function copyScreenshots(
  sandbox: Sandbox,
  review: Review,
  logDir: string,
): Promise<Map<string, CopiedShots>> {
  const copied = new Map<string, CopiedShots>()
  const folder = join(logDir, 'screenshots')
  for (const row of seenRows(review)) {
    const shots: CopiedShots = { files: [], missing: 0 }
    for (const path of row.screenshots) {
      const bytes = SHOT.test(path) ? await readShot(sandbox, path) : null
      if (!bytes) {
        shots.missing += 1
        continue
      }
      mkdirSync(folder, { recursive: true })
      const file = join(folder, basename(path))
      writeFileSync(file, bytes)
      shots.files.push(file)
    }
    copied.set(row.id, shots)
  }
  return copied
}

/** Sandcastle's exec returns text, so the shot comes out base64-encoded. */
async function readShot(sandbox: Sandbox, path: string): Promise<Buffer | null> {
  const result = await sandbox.exec(`base64 -w 0 -- '${path}'`)
  if (result.exitCode !== 0) return null
  const bytes = Buffer.from(result.stdout.trim(), 'base64')
  return bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ? bytes : null
}

export function seenRows(review: Review): SeenRow[] {
  return review.criteria.filter((row): row is SeenRow => row.kind === 'seen')
}

/** Why the push gate fails a ticket's Seen criteria, or nothing when their shots pass. */
export function seenGate(
  criteria: Criterion[],
  review: Review,
  copied: Map<string, CopiedShots>,
): string[] {
  const reasons: string[] = []
  for (const { id } of criteria.filter((criterion) => criterion.kind === 'seen')) {
    const row = seenRows(review).find((candidate) => candidate.id === id)
    const shots = copied.get(id)
    if (!row || !shots || shots.files.length === 0) {
      reasons.push(`${id} has no screenshot`)
      continue
    }
    if (shots.missing > 0) {
      reasons.push(
        `${id} has no screenshot for ${shots.missing} of the ${row.screenshots.length} paths the Reviewer gave (each must be a PNG in .preview/screenshots/)`,
      )
    }
    if (!row.matches) {
      reasons.push(
        `the Reviewer judged ${id}'s screenshots not matching${row.judgement ? `: ${row.judgement}` : ''}`,
      )
    }
  }
  return reasons
}

/**
 * Pushes the Seen rows' shots to `factory-screenshots` under `<ticket>/<run>/`, and returns each
 * run-log file's raw URL. Nothing is pushed when there are none.
 */
export async function pushScreenshots(
  forge: Forge,
  folder: string,
  copied: Map<string, CopiedShots>,
): Promise<Map<string, string>> {
  const files = [...new Set([...copied.values()].flatMap((shots) => shots.files))]
  if (files.length === 0) return new Map()
  const urls = await forge.pushFiles(
    SCREENSHOT_BRANCH,
    files.map((from) => ({ path: `${folder}/${basename(from)}`, from })),
  )
  return new Map(files.map((file, index) => [file, urls[index] ?? '']))
}

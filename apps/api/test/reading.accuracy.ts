import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type PokemonBuild, type TeamImageType, readSeenTeam } from '@myvgc/core'
import { afterAll, describe, expect, test } from 'vitest'
import { DEFAULT_TEAM_READER_MODEL } from '../src/config'
import { type TeamImage, anthropicTeamReader } from '../src/team-reader'

// The reading accuracy check (ADR 24, DEV-123), run by `pnpm accuracy`, never by `pnpm test` or
// CI. It sends each fixture case's screenshots to the real model and compares what
// `readSeenTeam` makes of the answer, which is what the User gets, with the Team's
// expected.json. A case passes only when every field of the draft matches exactly and the set of
// flag paths matches exactly. Each case runs as PNG and as JPEG (DEV-122's comparison).

const FIXTURES = fileURLToPath(new URL('reading-fixtures', import.meta.url))
const REPORTS = fileURLToPath(new URL('../.accuracy', import.meta.url))
// Like the app, the check reads with TEAM_READER_MODEL, or else the app's default model.
const MODEL = process.env.TEAM_READER_MODEL?.trim() || DEFAULT_TEAM_READER_MODEL
const REPEAT = Number(process.env.ACCURACY_REPEAT ?? 1)
const FORMATS = { png: 'image/png', jpg: 'image/jpeg' } as const satisfies Record<
  string,
  TeamImageType
>

/** US dollars per million input and output tokens, for prompts under 100K tokens. */
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5-5': { input: 4, output: 20 },
}

/** The fields a case's images can't show, so its expected draft leaves them out. */
type NotShown = 'replicaTeamId' | 'name' | Exclude<keyof PokemonBuild, 'species'>

/** A draft Team as `readSeenTeam` returns it, less its flags. `replicaTeamId` arrives with DEV-106. */
type Draft = Omit<ReturnType<typeof readSeenTeam>, 'flags'> & { replicaTeamId?: string }

/** A Team's expected.json, which the maintainer confirms against the game. */
interface Expected {
  /** The true Team, as a draft that every image showed would read. */
  team: Draft
  /** Each fixture image (`<name>.png` and `<name>.jpg`) and the screenshot it was made from. */
  images: Record<string, { source: string; paintTrainerName?: boolean }>
  /**
   * Each case: its images in upload order, the fields they can't show, and the flag paths
   * (joined with dots, such as `pokemon.0.item`) the decided behaviour gives. Not their wording.
   */
  cases: Record<string, { images: string[]; notShown: NotShown[]; flags: string[] }>
}

/** The true Team as a case whose images can't show `notShown` should read it. */
function expectedDraft(team: Draft, notShown: NotShown[]): Draft {
  const draft: Draft = structuredClone(team)
  for (const field of notShown) {
    if (field === 'name' || field === 'replicaTeamId') draft[field] = ''
    else
      for (const build of draft.pokemon) {
        if (field === 'moves') build.moves = []
        else if (field === 'statPoints')
          build.statPoints = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
        else delete build[field]
      }
  }
  return draft
}

const show = (value: unknown) => (value === undefined ? '(none)' : JSON.stringify(value))

/** Each field where `got` differs from `want`, such as `pokemon.0.nature: got (none), want "timid"`. */
function differences(got: unknown, want: unknown, path = ''): string[] {
  const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null
  if (isObject(got) && isObject(want) && Array.isArray(got) === Array.isArray(want)) {
    const keys = new Set([...Object.keys(got), ...Object.keys(want)])
    return [...keys].flatMap((key) =>
      differences(got[key], want[key], path ? `${path}.${key}` : key),
    )
  }
  return got === want ? [] : [`${path}: got ${show(got)}, want ${show(want)}`]
}

interface Run {
  team: string
  case: string
  format: keyof typeof FORMATS
  run: number
  passed: boolean
  differences: string[]
  model?: string
  inputTokens?: number
  outputTokens?: number
  cost?: number
  seconds: number
  error?: string
}

const runs: Run[] = []

for (const team of readdirSync(FIXTURES)) {
  const expected = JSON.parse(
    readFileSync(join(FIXTURES, team, 'expected.json'), 'utf8'),
  ) as Expected

  describe.concurrent(team, () => {
    for (const [name, spec] of Object.entries(expected.cases))
      for (const format of Object.keys(FORMATS) as (keyof typeof FORMATS)[])
        for (let run = 1; run <= REPEAT; run++)
          test(`${name} (${format})${REPEAT > 1 ? ` run ${run}` : ''}`, async () => {
            const result = await readCase(team, expected, name, spec, format, run)
            runs.push(result)
            console.log(describeRun(result))
            expect(result.differences).toEqual([])
          })
  })
}

async function readCase(
  team: string,
  expected: Expected,
  name: string,
  spec: Expected['cases'][string],
  format: keyof typeof FORMATS,
  run: number,
): Promise<Run> {
  let usage: { input_tokens: number; output_tokens: number } | undefined
  let servedModel: string | undefined
  // Wraps fetch to see the usage the reader itself doesn't return.
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const response = await globalThis.fetch(input, init)
    try {
      const body = (await response.clone().json()) as { usage?: typeof usage; model?: string }
      usage = body.usage
      servedModel = body.model
    } catch {
      // Not JSON: the reader reports the failure itself.
    }
    return response
  }
  const reader = anthropicTeamReader({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: MODEL,
    fetch,
  })
  const images: TeamImage[] = spec.images.map((image) => ({
    type: FORMATS[format],
    bytes: readFileSync(join(FIXTURES, team, `${image}.${format}`)),
  }))

  const started = performance.now()
  const base = { team, case: name, format, run }
  let problems: string[]
  let error: string | undefined
  try {
    const { flags, ...read }: Draft & { flags: { path: unknown[] }[] } = readSeenTeam(
      await reader.read(images),
    )
    // A blank Replica Team ID and none at all are the same draft.
    const draft = { ...read, replicaTeamId: read.replicaTeamId ?? '' }
    const gotFlags = new Set(flags.map((flag) => flag.path.join('.')))
    const wantFlags = new Set(spec.flags)
    problems = [
      ...differences(draft, expectedDraft(expected.team, spec.notShown)),
      ...[...gotFlags]
        .filter((path) => !wantFlags.has(path))
        .map((path) => `flag not expected: ${path}`),
      ...[...wantFlags]
        .filter((path) => !gotFlags.has(path))
        .map((path) => `flag missing: ${path}`),
    ]
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure)
    problems = [`read failed: ${error}`]
  }
  const seconds = Math.round((performance.now() - started) / 100) / 10
  const price = PRICES[servedModel ?? MODEL]
  return {
    ...base,
    passed: problems.length === 0,
    differences: problems,
    model: servedModel,
    inputTokens: usage?.input_tokens,
    outputTokens: usage?.output_tokens,
    cost:
      usage && price
        ? (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1e6
        : undefined,
    seconds,
    error,
  }
}

const dollars = (cost: number | undefined) => (cost === undefined ? '$?' : `$${cost.toFixed(4)}`)

function describeRun(run: Run): string {
  const head =
    `${run.passed ? 'PASS' : 'FAIL'} ${run.team} ${run.case} (${run.format})` +
    `${REPEAT > 1 ? ` run ${run.run}` : ''}: ${run.inputTokens ?? '?'} in, ` +
    `${run.outputTokens ?? '?'} out, ${dollars(run.cost)}, ${run.seconds} s`
  return [head, ...run.differences.map((line) => `  ${line}`)].join('\n')
}

afterAll(() => {
  if (runs.length === 0) return
  const order = (run: Run) => `${run.team} ${run.case} ${run.format} ${run.run}`
  runs.sort((a, b) => order(a).localeCompare(order(b)))
  const total = runs.reduce((sum, run) => sum + (run.cost ?? 0), 0)
  const passed = runs.filter((run) => run.passed).length
  const lines = runs.map(
    (run) =>
      `  ${run.passed ? 'PASS' : 'FAIL'}  ${`${run.team} ${run.case} (${run.format})`.padEnd(30)}` +
      `${REPEAT > 1 ? `run ${run.run}  ` : ''}${String(run.differences.length).padStart(3)} differences  ` +
      `${String(run.inputTokens ?? '?').padStart(6)} in  ${String(run.outputTokens ?? '?').padStart(5)} out  ` +
      `${dollars(run.cost)}  ${run.seconds} s`,
  )
  console.log(
    [
      `Reading accuracy, ${MODEL}: ${passed} of ${runs.length} passed, ${dollars(total)} in all`,
      ...lines,
    ].join('\n'),
  )
  mkdirSync(REPORTS, { recursive: true })
  const file = join(REPORTS, `${new Date().toISOString().replaceAll(':', '-')}.json`)
  writeFileSync(
    file,
    JSON.stringify({ model: MODEL, repeat: REPEAT, passed, total, runs }, null, 2),
  )
  console.log(`Report: ${file}`)
})

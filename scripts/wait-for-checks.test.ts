// Tests scripts/wait-for-checks.sh through its command line, with a stub `gh` (and `sleep`) first
// on PATH. Each case runs the script with a 3-second limit and checks its exit code, its output, how
// long it took and how often it called gh. Run with `pnpm test:scripts`.
import { execFile } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

const script = join(import.meta.dirname, 'wait-for-checks.sh')
const TIMEOUT = 3
// SECONDS counts whole seconds, and a busy runner starts processes slowly.
const SLACK = 2

// `gh pr checks` and `gh pr view` as the script calls them, printing what gh would after its --jq
// filter. GH_HANG names the one that never answers; `exec` keeps it a single process, as the real
// gh is.
const GH_STUB = `#!/usr/bin/env bash
command="$1 $2"
echo "$command" >>"$GH_CALLS"
if [[ $command == "\${GH_HANG:-}" ]]; then exec sleep 60; fi
case $command in
  'pr checks')
    if [[ -n \${GH_CHECKS_ERROR:-} ]]; then
      echo "$GH_CHECKS_ERROR" >&2
      exit 1
    fi
    printf '%b' "\${GH_CHECKS:-}"
    ;;
  'pr view') printf '%b\\n' "\${GH_VIEW:-}" ;;
esac
`

// Asked for SLEEP_STRETCH seconds, sleeps SLEEP_STRETCH_TO instead, as when the machine sleeps
// through the script's wait between polls. Any other sleep is the real one.
const SLEEP_STUB = `#!/usr/bin/env bash
if [[ -n \${SLEEP_STRETCH:-} && $1 == "$SLEEP_STRETCH" ]]; then exec /bin/sleep "$SLEEP_STRETCH_TO"; fi
exec /bin/sleep "$@"
`

const PASSING = 'pass\\tcheck\\npass\\tsmoke / smoke\\n'
const SMOKE_PASSED = 'pending\\tcheck\\npass\\tsmoke / smoke\\n'

let stub: string
let runs = 0

beforeAll(() => {
  stub = mkdtempSync(join(tmpdir(), 'wait-for-checks-'))
  for (const [name, body] of [
    ['gh', GH_STUB],
    ['sleep', SLEEP_STUB],
  ]) {
    writeFileSync(join(stub, name), body)
    chmodSync(join(stub, name), 0o755)
  }
})

afterAll(() => rmSync(stub, { recursive: true, force: true }))

interface Run {
  code: number
  output: string
  seconds: number
  ghCalls: number
}

function run(env: Record<string, string>): Promise<Run> {
  const calls = join(stub, `calls-${runs++}`)
  writeFileSync(calls, '')
  const started = Date.now()
  return new Promise((resolve) => {
    execFile(
      script,
      ['7'],
      {
        env: {
          ...process.env,
          PATH: `${stub}:${process.env.PATH}`,
          GH_CALLS: calls,
          WAIT_FOR_CHECKS_TIMEOUT: String(TIMEOUT),
          WAIT_FOR_CHECKS_INTERVAL: '1',
          ...env,
        },
      },
      (error, stdout, stderr) => {
        const lines = readFileSync(calls, 'utf8').split('\n').filter(Boolean)
        resolve({
          code: error ? Number(error.code) : 0,
          output: stdout + stderr,
          seconds: (Date.now() - started) / 1000,
          ghCalls: lines.length,
        })
      },
    )
  })
}

describe.concurrent('wait-for-checks.sh', { timeout: 20_000 }, () => {
  test('exits 0 with the merge commit once the PR is merged', async () => {
    const result = await run({ GH_CHECKS: PASSING, GH_VIEW: 'MERGED\\tfalse\\tabc123' })
    expect(result.code).toBe(0)
    expect(result.output).toContain('PR #7 merged as abc123')
  })

  test('exits 0 when both checks pass and no auto-merge is queued', async () => {
    const result = await run({ GH_CHECKS: PASSING, GH_VIEW: 'OPEN\\tfalse\\t' })
    expect(result.code).toBe(0)
    expect(result.output).toContain('no auto-merge queued')
  })

  test('exits 1 when a check fails', async () => {
    const result = await run({ GH_CHECKS: 'fail\\tcheck\\npass\\tsmoke / smoke\\n' })
    expect(result.code).toBe(1)
    expect(result.output).toContain('A check failed')
  })

  test('exits 3 when gh fails', async () => {
    const result = await run({ GH_CHECKS_ERROR: 'HTTP 401: Bad credentials' })
    expect(result.code).toBe(3)
    expect(result.output).toContain('HTTP 401')
  })

  test('exits 3 when gh pr view gives no state', async () => {
    const result = await run({ GH_CHECKS: PASSING, GH_VIEW: '' })
    expect(result.code).toBe(3)
    expect(result.output).toContain('no state')
  })

  // Every way of still waiting must exit 2 by the deadline, whatever gh does.
  test.each([
    ['a check is still pending', { GH_CHECKS: SMOKE_PASSED }],
    ['no checks are reported yet', { GH_CHECKS_ERROR: 'no checks reported on the branch' }],
    ['the auto-merge is still pending', { GH_CHECKS: PASSING, GH_VIEW: 'OPEN\\ttrue\\t' }],
    ['gh pr checks hangs', { GH_HANG: 'pr checks' }],
    ['gh pr view hangs', { GH_CHECKS: PASSING, GH_HANG: 'pr view' }],
  ])('exits 2 by the deadline when %s', async (_, env) => {
    const result = await run(env)
    expect(result.code).toBe(2)
    expect(result.output).toContain('Run this script again')
    expect(result.seconds).toBeLessThanOrEqual(TIMEOUT + SLACK)
  })

  // The wait after the first poll overruns the deadline, as when the machine sleeps through it.
  test.each([
    ['the checks', { GH_CHECKS: SMOKE_PASSED }, 1],
    ['the auto-merge', { GH_CHECKS: PASSING, GH_VIEW: 'OPEN\\ttrue\\t' }, 2],
  ])(
    'asks gh nothing more once it wakes past the deadline waiting for %s',
    async (_, env, ghCalls) => {
      const result = await run({ ...env, SLEEP_STRETCH: '1', SLEEP_STRETCH_TO: '5' })
      expect(result.code).toBe(2)
      expect(result.ghCalls).toBe(ghCalls)
    },
  )
})

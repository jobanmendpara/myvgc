// PROTOTYPE (DEV-251): one fix round for the spike's PR #434. Resumes the Implementer's saved session
// with the Reviewer's findings, runs the full checks, runs a fresh Reviewer, replays sabotage with
// Vitest's JSON reporter, and pushes to the same branch only if everything passes.
// Run from the repo root:  node .sandcastle/node_modules/.bin/tsx .sandcastle/fix-round.ts
import { createSandbox, claudeCode } from '@ai-hero/sandcastle'
import { docker } from '@ai-hero/sandcastle/sandboxes/docker'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const BRANCH = 'jobanmendpara/dev-173-ten-battle-only-forms-that-arent-in'
const IMPLEMENTER_SESSION = '8bd8f14d-2d43-4a48-9962-5d29523cbfe5'
const OUT = '.sandcastle/spike-out'
const first = JSON.parse(readFileSync(join(OUT, 'review.json'), 'utf8')) as { findings: unknown[] }
const token = readFileSync('.sandcastle/.env', 'utf8').match(/^CLAUDE_CODE_OAUTH_TOKEN=(.+)$/m)?.[1].trim()
if (!token) throw new Error('no token')
const agentEnv = { CLAUDE_CODE_OAUTH_TOKEN: token }

const report: Record<string, unknown> = { startedAt: new Date().toISOString(), steps: [] }
const steps = report.steps as unknown[]
const save = () => writeFileSync(join(OUT, 'fix-report.json'), JSON.stringify(report, null, 2))
async function timed<T>(name: string, f: () => Promise<T>, extra?: (r: T) => object): Promise<T> {
  const t = Date.now()
  console.log(`\n=== ${name} ===`)
  const r = await f()
  steps.push({ name, seconds: Math.round((Date.now() - t) / 1000), ...(extra ? extra(r) : {}) })
  save()
  return r
}
const tag = (s: string, n: string) => [...s.matchAll(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`, 'g'))].at(-1)?.[1].trim()
const sessions = (r: { iterations: { sessionId?: string }[] }) => ({ sessionIds: r.iterations.map((i) => i.sessionId) })

const FIX = `The Reviewer rejected your work. Fix every finding below on this branch, then commit (message ending
"Related to DEV-251"). Do NOT push or open a PR.

Reviewer findings:
${JSON.stringify(first.findings, null, 2)}

The maintainer's decision on the legality finding: the ten forms are not allowed in any Regulation. A Pokémon build
already saved with one of them is judged illegal and shows the existing illegal-Team warning (ADR 18). Switch legality
tests that use these forms to species that are in Champions. For AC-1.2, test a battle-only form whose base species
is in Champions (such as Charizard-Mega-X).

Before you finish, run the FULL suite: \`pnpm test\`, \`pnpm typecheck\` and \`pnpm lint\`, and make them pass.
Then print an updated PR body between <pr-body> and </pr-body> (same shape as before, with the
"## Acceptance criteria" table and "Closes DEV-173"), then <promise>COMPLETE</promise>.`

const REVIEW = readFileSync('.sandcastle/main.ts', 'utf8').match(/const REVIEW = `([\s\S]*?)`\n/)![1]
const TICKET = readFileSync('.sandcastle/main.ts', 'utf8').match(/const TICKET = `([\s\S]*?)`\n/)![1]
const REVIEW_PROMPT =
  REVIEW.replace('${TICKET}', TICKET) +
  `\n\nThe maintainer decided: the ten forms are not allowed in any Regulation; a saved build holding one is judged illegal and shows the existing warning. Run \`pnpm test\` and \`pnpm lint\` yourself as part of the review.`

const store = join(homedir(), '.cache/myvgc-sandcastle-pnpm')
mkdirSync(store, { recursive: true })
const sandbox = await timed('create sandbox (existing branch)', () =>
  createSandbox({
    branch: BRANCH,
    sandbox: docker({ imageName: 'sandcastle:myvgc-spike', cpus: 3, mounts: [{ hostPath: store, sandboxPath: '/home/agent/.local/share/pnpm/store' }] }),
  }),
)

try {
  const install = await timed('pnpm install', () => sandbox.exec('pnpm install --frozen-lockfile 2>&1 | tail -3'), (r) => ({ exitCode: r.exitCode }))
  if (install.exitCode !== 0) throw new Error('install failed')

  const fix = await timed(
    'implementer fix round (resumed session, sonnet-5-5, high)',
    () => sandbox.run({ name: 'implementer-fix', agent: claudeCode('claude-sonnet-5-5', { effort: 'high', env: agentEnv }), prompt: FIX, resumeSession: IMPLEMENTER_SESSION, idleTimeoutSeconds: 900 }),
    (r) => ({ commits: r.commits.length, ...sessions(r) }),
  )
  const prBody = tag(fix.stdout, 'pr-body')

  const check = await timed('host check: full pnpm test + typecheck + lint', () => sandbox.exec('pnpm test > /tmp/test.log 2>&1; t=$?; pnpm typecheck > /tmp/tc.log 2>&1; c=$?; pnpm lint > /tmp/lint.log 2>&1; l=$?; tail -12 /tmp/test.log; echo "test=$t typecheck=$c lint=$l"; [ $t -eq 0 ] && [ $c -eq 0 ] && [ $l -eq 0 ]'), (r) => ({ exitCode: r.exitCode, tail: r.stdout.slice(-1500) }))

  const rev = await timed(
    'reviewer (fresh, opus-5-5, high)',
    () => sandbox.run({ name: 'reviewer-2', agent: claudeCode('claude-opus-5-5', { effort: 'high', env: agentEnv }), prompt: REVIEW_PROMPT, idleTimeoutSeconds: 900 }),
    sessions,
  )
  const review = JSON.parse(tag(rev.stdout, 'review') ?? '{}') as { verdict: string; criteria: { id: string; tests: string; testCommand: string; sabotagePatch: string }[]; findings: unknown[] }
  writeFileSync(join(OUT, 'review-2.json'), JSON.stringify(review, null, 2))

  // Replay with Vitest's JSON reporter: confirmed only if a test failed with an assertion message.
  await sandbox.exec('git checkout -- . && git clean -fd -e node_modules')
  const replays: Record<string, unknown>[] = []
  for (const c of review.criteria ?? []) {
    const patch = c.sabotagePatch.endsWith('\n') ? c.sabotagePatch : c.sabotagePatch + '\n'
    const applied = await sandbox.exec('git apply --whitespace=nowarn -', { stdin: patch })
    let failures: string[] = []
    let failedTests = 0
    let suiteErrors: string[] = []
    if (applied.exitCode === 0) {
      await sandbox.exec(`rm -f /tmp/replay.json; ${c.testCommand} --reporter=json --outputFile=/tmp/replay.json > /dev/null 2>&1`)
      const raw = (await sandbox.exec('cat /tmp/replay.json')).stdout
      try {
        const j = JSON.parse(raw) as { numFailedTests: number; testResults: { message?: string; assertionResults: { status: string; failureMessages: string[] }[] }[] }
        failedTests = j.numFailedTests
        suiteErrors = j.testResults.map((t) => t.message ?? '').filter(Boolean)
        failures = j.testResults.flatMap((t) => t.assertionResults.filter((a) => a.status === 'failed').flatMap((a) => a.failureMessages.map((m) => m.split('\n')[0])))
      } catch {
        suiteErrors = ['no JSON report: ' + raw.slice(0, 200)]
      }
    }
    await sandbox.exec('git checkout -- .')
    const restored = await sandbox.exec(`${c.testCommand} > /dev/null 2>&1`)
    const assertion = failures.some((m) => /AssertionError|expected/i.test(m))
    const row = { id: c.id, patchApplied: applied.exitCode === 0, failedTests, firstFailure: failures[0], suiteErrors, assertion, passesRestored: restored.exitCode === 0 }
    replays.push({ ...row, confirmed: row.patchApplied && failedTests > 0 && suiteErrors.length === 0 && assertion && row.passesRestored })
    console.log(JSON.stringify(replays.at(-1)))
  }
  report.replays = replays
  report.verdict = review.verdict
  const allConfirmed = replays.length > 0 && replays.every((r) => r.confirmed)
  const ship = review.verdict === 'pass' && allConfirmed && check.exitCode === 0 && fix.commits.length > 0
  report.ship = ship
  save()

  if (ship && prBody) {
    const table = ['| Criterion | Tests | Sabotage replay |', '| - | - | - |', ...review.criteria.map((c, i) => `| ${c.id} | ${c.tests} | ${replays[i].confirmed ? `failed on an assertion (\`${String(replays[i].firstFailure).slice(0, 80)}\`), passes restored` : 'NOT confirmed'} |`)].join('\n')
    const body = `${prBody}\n\n## Factory spike review\n\nAfter one fix round (the Implementer's session resumed with the first Reviewer's findings). Full \`pnpm test\`, \`pnpm typecheck\` and \`pnpm lint\` pass in the sandbox. Fresh Reviewer verdict: **${review.verdict}**. Host replay via Vitest's JSON reporter: **all confirmed**.\n\n${table}\n\nOpened by the factory spike (Related to DEV-251). Not queued for auto-merge: the maintainer merges by hand.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`
    writeFileSync(join(OUT, 'pr-body-2.md'), body)
    await timed('push + update PR', async () => {
      execFileSync('git', ['push', 'https://jobanmendpara@github.com/jobanmendpara/myvgc.git', `${BRANCH}:${BRANCH}`], { stdio: 'inherit' })
      execFileSync('gh', ['pr', 'edit', '434', '--body-file', join(OUT, 'pr-body-2.md')], { stdio: 'inherit' })
    })
  } else {
    console.log('Not shipping: verdict, replay or checks failed. See fix-report.json and review-2.json.')
  }
} catch (e) {
  report.error = String(e)
  console.error(e)
} finally {
  report.finishedAt = new Date().toISOString()
  save()
  const closed = await sandbox.close()
  if (closed.preservedWorktreePath) console.log('Worktree kept at', closed.preservedWorktreePath)
}

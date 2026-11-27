// PROTOTYPE (DEV-251): finish the spike's PR #434 after the fix round hit the idle timeout. The host
// committed the Implementer's fixes (dffb0e1). This runs the full checks as host exec steps (no idle
// limit), a fresh Reviewer that runs only targeted tests, the JSON sabotage replay, and pushes only
// if everything passes.
// Run from the repo root:  node .sandcastle/node_modules/.bin/tsx .sandcastle/finish.ts
import { createSandbox, claudeCode } from '@ai-hero/sandcastle'
import { docker } from '@ai-hero/sandcastle/sandboxes/docker'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BRANCH = 'jobanmendpara/dev-173-ten-battle-only-forms-that-arent-in'
const OUT = '.sandcastle/spike-out'
const token = readFileSync('.sandcastle/.env', 'utf8').match(/^CLAUDE_CODE_OAUTH_TOKEN=(.+)$/m)?.[1].trim()
if (!token) throw new Error('no token')
const agentEnv = { CLAUDE_CODE_OAUTH_TOKEN: token }

const report: Record<string, unknown> = { startedAt: new Date().toISOString(), steps: [] }
const steps = report.steps as unknown[]
const save = () => writeFileSync(join(OUT, 'finish-report.json'), JSON.stringify(report, null, 2))
async function timed<T>(name: string, f: () => Promise<T>, extra?: (r: T) => object): Promise<T> {
  const t = Date.now()
  console.log(`\n=== ${name} ===`)
  const r = await f()
  steps.push({ name, seconds: Math.round((Date.now() - t) / 1000), ...(extra ? extra(r) : {}) })
  save()
  return r
}
const tag = (s: string, n: string) => [...s.matchAll(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`, 'g'))].at(-1)?.[1].trim()

const main = readFileSync('.sandcastle/main.ts', 'utf8')
const REVIEW = main.match(/const REVIEW = `([\s\S]*?)`\n/)![1]
const TICKET = main.match(/const TICKET = `([\s\S]*?)`\n/)![1]

const sandbox = await timed('create sandbox', () =>
  createSandbox({ branch: BRANCH, sandbox: docker({ imageName: 'sandcastle:myvgc-spike', cpus: 3 }) }),
)

try {
  const install = await timed('pnpm install', () => sandbox.exec('pnpm install --frozen-lockfile 2>&1 | tail -3'), (r) => ({ exitCode: r.exitCode }))
  if (install.exitCode !== 0) throw new Error('install failed')

  const check = await timed(
    'host check: full pnpm test + typecheck + lint',
    () => sandbox.exec('pnpm test > /tmp/test.log 2>&1; t=$?; pnpm typecheck > /tmp/tc.log 2>&1; c=$?; pnpm lint > /tmp/lint.log 2>&1; l=$?; grep -E "Test Files|Tests " /tmp/test.log; tail -5 /tmp/lint.log; echo "test=$t typecheck=$c lint=$l"; [ $t -eq 0 ] && [ $c -eq 0 ] && [ $l -eq 0 ]'),
    (r) => ({ exitCode: r.exitCode, tail: r.stdout.slice(-1500) }),
  )
  console.log(check.stdout)

  const REVIEW_PROMPT =
    REVIEW.replace('${TICKET}', TICKET) +
    `\n\nThe maintainer decided: the ten forms are not allowed in any Regulation; a saved build holding one is judged illegal and shows the existing illegal-Team warning (ADR 18). The host has already run the full \`pnpm test\`, \`pnpm typecheck\` and \`pnpm lint\` in this sandbox (result: ${check.exitCode === 0 ? 'all passed' : 'FAILED: ' + check.stdout.slice(-600)}). Do NOT run the full \`pnpm test\`: it takes about 10 minutes here. Run only the test files you need, one vitest file at a time.`

  const rev = await timed(
    'reviewer (fresh, opus-5-5, high)',
    () => sandbox.run({ name: 'reviewer-3', agent: claudeCode('claude-opus-5-5', { effort: 'high', env: agentEnv }), prompt: REVIEW_PROMPT, idleTimeoutSeconds: 1800 }),
    (r) => ({ sessionIds: r.iterations.map((i) => i.sessionId) }),
  )
  const review = JSON.parse(tag(rev.stdout, 'review') ?? '{}') as { verdict: string; criteria: { id: string; tests: string; testCommand: string; sabotagePatch: string }[]; findings: { severity: string; file: string; summary: string }[] }
  writeFileSync(join(OUT, 'review-3.json'), JSON.stringify(review, null, 2))

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
    const row = { id: c.id, patchApplied: applied.exitCode === 0, applyError: applied.exitCode === 0 ? undefined : applied.stderr.slice(0, 300), failedTests, firstFailure: failures[0], suiteErrors, assertion, passesRestored: restored.exitCode === 0 }
    replays.push({ ...row, confirmed: row.patchApplied && failedTests > 0 && suiteErrors.length === 0 && assertion && row.passesRestored })
    console.log(JSON.stringify(replays.at(-1)))
  }
  report.replays = replays
  report.verdict = review.verdict
  report.findings = review.findings
  const allConfirmed = replays.length > 0 && replays.every((r) => r.confirmed)
  const ship = review.verdict === 'pass' && allConfirmed && check.exitCode === 0
  report.ship = ship
  save()

  if (ship) {
    const table = ['| Criterion | Tests | Sabotage replay |', '| - | - | - |', ...review.criteria.map((c, i) => `| ${c.id} | ${c.tests} | ${replays[i].confirmed ? `failed on an assertion (\`${String(replays[i].firstFailure).replace(/\|/g, '\\|').slice(0, 80)}\`), passes restored` : 'NOT confirmed'} |`)].join('\n')
    const judgement = (review.findings ?? []).filter((f) => f.severity !== 'hard')
    const body = `## Summary
A battle-only form is in Champions only if the form it changes from is. This rejects Meloetta-Pirouette, Minior-Meteor, Cramorant-Gulping, Cramorant-Gorging, Eiscue-Noice, the four Ogerpon Tera forms and Terapagos-Terastal. Floette-Eternal and Floette-Mega stay, because their source form is in Champions. The names table drops from 392 to 382 species.

The ten forms are not allowed in any Regulation: a Pokémon build already saved with one is judged illegal and shows the existing illegal-Team warning (ADR 18). Legality tests that used them now use species in Champions. The preview seed's Cramorant-Gulping Team and Lead are gone (Basculegion takes the Lead), so the seed no longer has a species without a Sprite.

## Acceptance criteria
${table}

Closes DEV-173

## Factory spike review
The first Reviewer failed the first commit (the API's names count and the preview seed broke). One fix round followed: the Implementer's session resumed with those findings, then hit Sandcastle's idle timeout while running the full suite, and the host committed its work. In the sandbox, the full \`pnpm test\`, \`pnpm typecheck\` and \`pnpm lint\` pass. Fresh Reviewer verdict: **${review.verdict}**. Every sabotage was replayed by the host with Vitest's JSON reporter.
${judgement.length ? '\nJudgement calls from the Reviewer:\n' + judgement.map((f) => `- \`${f.file}\`: ${f.summary}`).join('\n') + '\n' : ''}
Opened by the factory spike (Related to DEV-251). Not queued for auto-merge: the maintainer merges by hand.

🤖 Generated with [Claude Code](https://claude.com/claude-code)`
    writeFileSync(join(OUT, 'pr-body-3.md'), body)
    await timed('push + update PR', async () => {
      execFileSync('git', ['push', 'https://jobanmendpara@github.com/jobanmendpara/myvgc.git', `${BRANCH}:${BRANCH}`], { stdio: 'inherit' })
      execFileSync('gh', ['pr', 'edit', '434', '--body-file', join(OUT, 'pr-body-3.md')], { stdio: 'inherit' })
    })
  } else {
    console.log('Not shipping: verdict, replay or checks failed. See finish-report.json and review-3.json.')
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

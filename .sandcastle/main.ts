// PROTOTYPE (DEV-251): throwaway factory spike. One real ticket (DEV-173) through
// Implementer -> Reviewer -> sabotage replay -> PR, in one Docker sandbox. Never merged.
// Run from the repo root:  node .sandcastle/node_modules/.bin/tsx .sandcastle/main.ts
import { createSandbox, claudeCode, type Sandbox } from '@ai-hero/sandcastle'
import { docker } from '@ai-hero/sandcastle/sandboxes/docker'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const BRANCH = 'jobanmendpara/dev-173-ten-battle-only-forms-that-arent-in'
const OUT = '.sandcastle/spike-out'
mkdirSync(OUT, { recursive: true })

const env = Object.fromEntries(
  readFileSync('.sandcastle/.env', 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const TOKEN = env.CLAUDE_CODE_OAUTH_TOKEN
if (!TOKEN) throw new Error('Put the token from `claude setup-token` in .sandcastle/.env first')
const agentEnv = { CLAUDE_CODE_OAUTH_TOKEN: TOKEN }

const report: Record<string, unknown> = { branch: BRANCH, startedAt: new Date().toISOString(), steps: [] }
const steps = report.steps as unknown[]
const save = () => writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
async function timed<T>(name: string, f: () => Promise<T>, extra?: (r: T) => object): Promise<T> {
  const t = Date.now()
  console.log(`\n=== ${name} ===`)
  const r = await f()
  steps.push({ name, seconds: Math.round((Date.now() - t) / 1000), ...(extra ? extra(r) : {}) })
  save()
  return r
}

const TICKET = `
Ticket: DEV-173 "Ten battle-only forms that aren't in Champions are accepted as species"

packages/core's inChampions rule (packages/core/src/champions.ts) accepts 10 battle-only forms that aren't
in Pokémon Champions: Meloetta-Pirouette, Minior-Meteor, Cramorant-Gulping, Cramorant-Gorging, Eiscue-Noice,
Ogerpon-Teal-Tera, Ogerpon-Wellspring-Tera, Ogerpon-Hearthflame-Tera, Ogerpon-Cornerstone-Tera and
Terapagos-Terastal. Their base species is marked Past in @pkmn/mods' champions mod, but the forms themselves
carry no isNonstandard mark, so the rule lets them through. A Pokémon build can therefore store one (for
example terapagosterastal), and the names table lists them.

Expected: a form is in Champions only if its base species is too.

User story 1: As a Player, I want only species that are in Pokémon Champions accepted, so that my Pokémon
builds can't hold a form the game doesn't have.

Acceptance criteria (all Tested):
- AC-1.1: Given each of the ten forms above, when core looks the species up as in Champions, then it is not found.
- AC-1.2: Given a form whose base species is in Champions (for example Rotom-Wash), when core looks it up,
  then it is still found.
- AC-1.3: Given the names table core builds for the web app, when it lists species, then none of the ten forms
  are in it.
`

const IMPLEMENT = `You are the Implementer in a factory run for the MyVGC repo. Follow CLAUDE.md, CONTEXT.md and the ADRs.
${TICKET}
Work test-first (the tdd skill) at the highest seam: packages/core's public interface, with Vitest in
packages/core/test. Every acceptance criterion needs at least one test that checks its behaviour through a
public interface. Run \`pnpm --filter @myvgc/core test\`, then \`pnpm typecheck\` and \`pnpm lint\` before you finish.

Commit your work on the current branch with a message that ends with the line "Related to DEV-251".
Do NOT push, open a PR, or touch Linear: the host does that.

When done, print a PR body between <pr-body> and </pr-body>. It must contain a "## Acceptance criteria"
table with columns Criterion | Test file | Test name, one row per criterion, and the line "Closes DEV-173".
Then print <promise>COMPLETE</promise>.`

const REVIEW = `You are the Reviewer in a factory run for the MyVGC repo. Review the commits on this branch since
origin/main (\`git diff origin/main...HEAD\`) against the ticket and CLAUDE.md. Do not commit anything; leave the working tree clean.
${TICKET}
For every acceptance criterion, design a SABOTAGE: the smallest change to the implementation (never to test
files) that breaks just that criterion's behaviour while everything still compiles. Try it: apply it, run the
criterion's tests and check they fail on an assertion (not an import, load or compile error), then undo it with
\`git checkout -- .\` and check they pass again. The host will replay your patches itself, so they must apply
with \`git apply\` to the committed branch.

Print exactly one JSON object between <review> and </review>, shaped:
{"verdict":"pass"|"fail",
 "criteria":[{"id":"AC-1.1","tests":"file › test name","testCommand":"pnpm --filter @myvgc/core exec vitest run <file> -t '<name>'","sabotagePatch":"<unified diff>","note":"..."}],
 "findings":[{"severity":"hard"|"judgement","file":"...","summary":"..."}]}
Use "fail" if any criterion lacks a test whose sabotage fails it, or any hard standards or spec finding.
Then print <promise>COMPLETE</promise>.`

function tag(stdout: string, name: string): string | undefined {
  const m = [...stdout.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g'))]
  return m.at(-1)?.[1].trim()
}
const usageOf = (r: { iterations: { sessionId?: string; usage?: unknown }[] }) => ({
  sessionIds: r.iterations.map((i) => i.sessionId),
  usage: r.iterations.map((i) => i.usage),
})

const store = join(homedir(), '.cache/myvgc-sandcastle-pnpm')
mkdirSync(store, { recursive: true })

const sandbox: Sandbox = await timed('create sandbox', () =>
  createSandbox({
    branch: BRANCH,
    baseBranch: 'origin/main',
    sandbox: docker({
      imageName: 'sandcastle:myvgc-spike',
      cpus: 3,
      mounts: [{ hostPath: store, sandboxPath: '/home/agent/.local/share/pnpm/store' }],
    }),
  }),
)
report.sandboxId = sandbox.sandboxId
report.worktreePath = sandbox.worktreePath

try {
  const install = await timed('pnpm install', () => sandbox.exec('pnpm install --frozen-lockfile 2>&1 | tail -15'), (r) => ({ exitCode: r.exitCode, tail: r.stdout.slice(-1500) }))
  if (install.exitCode !== 0) throw new Error('pnpm install failed')
  await timed('claude smoke', () => sandbox.exec(`claude --version`), (r) => ({ out: r.stdout.trim() }))

  const impl = await timed(
    'implementer (sonnet-5-5, medium)',
    () => sandbox.run({ name: 'implementer', agent: claudeCode('claude-sonnet-5-5', { effort: 'medium', env: agentEnv }), prompt: IMPLEMENT, idleTimeoutSeconds: 900 }),
    (r) => ({ commits: r.commits.length, logFilePath: r.logFilePath, ...usageOf(r) }),
  )
  const prBody = tag(impl.stdout, 'pr-body')
  if (!impl.commits.length || !prBody) throw new Error('Implementer made no commits or printed no PR body')
  writeFileSync(join(OUT, 'pr-body.md'), prBody)

  const check = await timed('host check: core tests + typecheck', () => sandbox.exec('pnpm --filter @myvgc/core test 2>&1 | tail -8 && pnpm typecheck 2>&1 | tail -5'), (r) => ({ exitCode: r.exitCode, tail: r.stdout.slice(-1200) }))

  const rev = await timed(
    'reviewer (opus-5-5, high)',
    () => sandbox.run({ name: 'reviewer', agent: claudeCode('claude-opus-5-5', { effort: 'high', env: agentEnv }), prompt: REVIEW, idleTimeoutSeconds: 900 }),
    (r) => ({ logFilePath: r.logFilePath, ...usageOf(r) }),
  )
  const reviewJson = tag(rev.stdout, 'review')
  if (!reviewJson) throw new Error('Reviewer printed no <review>')
  const review = JSON.parse(reviewJson) as { verdict: string; criteria: { id: string; testCommand: string; sabotagePatch: string; tests: string }[]; findings: unknown[] }
  writeFileSync(join(OUT, 'review.json'), JSON.stringify(review, null, 2))

  // Replay: the host, not the agent, proves each sabotage fails its test on an assertion.
  const replays = []
  await sandbox.exec('git checkout -- . && git clean -fd -e node_modules')
  for (const c of review.criteria) {
    const applied = await sandbox.exec('git apply --whitespace=nowarn -', { stdin: c.sabotagePatch.endsWith('\n') ? c.sabotagePatch : c.sabotagePatch + '\n' })
    const broken = applied.exitCode === 0 ? await sandbox.exec(`${c.testCommand} 2>&1`) : undefined
    await sandbox.exec('git checkout -- .')
    const restored = await sandbox.exec(`${c.testCommand} 2>&1`)
    const out = broken?.stdout ?? ''
    const assertionFailure = /AssertionError|expected .* to |toBe|toEqual|toContain/.test(out) && !/Cannot find module|SyntaxError|TypeError: .* is not a function|Failed to load/.test(out)
    const row = {
      id: c.id,
      patchApplied: applied.exitCode === 0,
      applyError: applied.exitCode === 0 ? undefined : applied.stderr.slice(0, 400),
      failedUnderSabotage: broken ? broken.exitCode !== 0 : undefined,
      assertionFailure: broken ? assertionFailure : undefined,
      passesRestored: restored.exitCode === 0,
      brokenTail: out.slice(-800),
    }
    row['confirmed' as never] = (row.patchApplied && row.failedUnderSabotage && row.assertionFailure && row.passesRestored) as never
    replays.push(row)
    console.log(c.id, JSON.stringify({ ...row, brokenTail: undefined }))
  }
  report.replays = replays
  report.verdict = review.verdict
  save()

  const confirmed = replays.every((r) => (r as Record<string, unknown>).confirmed)
  const table = ['| Criterion | Tests | Sabotage replay |', '| - | - | - |', ...review.criteria.map((c, i) => `| ${c.id} | ${c.tests} | ${(replays[i] as Record<string, unknown>).confirmed ? 'failed on an assertion, passes restored' : 'NOT confirmed'} |`)].join('\n')
  const body = `${prBody}\n\n## Factory spike review\n\nReviewer verdict: **${review.verdict}**. Host replay of every sabotage: **${confirmed ? 'all confirmed' : 'not all confirmed'}**.\n\n${table}\n\nOpened by the factory spike (Related to DEV-251). Not queued for auto-merge: the maintainer merges by hand.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`
  writeFileSync(join(OUT, 'pr-body-final.md'), body)

  // Host pushes over HTTPS (the form that dodges the global insteadOf rewrite) and opens the PR.
  await timed('push + PR', async () => {
    execFileSync('git', ['push', 'https://jobanmendpara@github.com/jobanmendpara/myvgc.git', `${BRANCH}:${BRANCH}`], { stdio: 'inherit' })
    const url = execFileSync('gh', ['pr', 'create', '--head', BRANCH, '--base', 'main', '--title', "Reject battle-only forms that aren't in Champions (DEV-173)", '--body-file', join(OUT, 'pr-body-final.md')], { encoding: 'utf8' }).trim()
    report.prUrl = url
    console.log(url)
  })
  report.checkExit = check.exitCode
} catch (e) {
  report.error = String(e)
  console.error(e)
} finally {
  report.finishedAt = new Date().toISOString()
  save()
  const closed = await sandbox.close()
  if (closed.preservedWorktreePath) console.log('Worktree kept at', closed.preservedWorktreePath)
}
if (!existsSync(join(OUT, 'report.json'))) save()
console.log(`\nReport: ${OUT}/report.json`)

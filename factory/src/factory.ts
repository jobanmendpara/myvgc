// `pnpm factory <spec> [--dry-run] [--only DEV-M]`: the command entry (DEV-269). Tests call
// factory() with fake ports; src/cli.ts calls it with the real ones.
//
// It checks that it may start (the set-up is complete, DEV-271 and DEV-272, and the issue is a spec
// the maintainer signed off), then reads the spec's frontier. `--dry-run` prints the frontier and
// each ticket's steps; working the tickets comes with DEV-278.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs, parseEnv } from 'node:util'
import { frontier, whyNotTakeable } from './frontier.ts'
import type { Ticket, Tracker } from './ports.ts'
import { STEPS, type Step } from './settings.ts'

export interface FactoryPorts {
  /** The checkout the factory runs from, which holds `.sandcastle/.env`. */
  repoDir: string
  /** The maintainer's factory config: `app.pem` and `config.env` (normally ~/.config/myvgc-factory). */
  configDir: string
  /** Makes the Tracker from the Linear API key in `config.env`. */
  tracker: (linearApiKey: string) => Tracker
  print: (line: string) => void
}

/** Exit codes. */
const READY = 0
const REFUSED = 1
const USAGE_ERROR = 64

const USAGE = 'Usage: pnpm factory <spec issue, such as DEV-269> [--dry-run] [--only DEV-M]'
const ISSUE_ID = /^[A-Z]+-\d+$/

export async function factory(args: string[], ports: FactoryPorts): Promise<number> {
  const command = readCommand(args)
  if (!command) {
    ports.print(USAGE)
    return USAGE_ERROR
  }

  const setup = readSetup(ports)
  if ('problems' in setup) {
    ports.print("The factory isn't set up yet:")
    for (const problem of setup.problems) ports.print(`- ${problem}`)
    return REFUSED
  }

  const { specId, dryRun, only } = command
  const tracker = ports.tracker(setup.linearApiKey)
  const spec = await tracker.getIssue(specId)
  if (!spec) {
    ports.print(`${specId} wasn't found in Linear.`)
    return REFUSED
  }
  if (!spec.labels.includes('spec')) {
    ports.print(`${specId} isn't a spec: it has no \`spec\` label.`)
    return REFUSED
  }
  if (!spec.labels.includes('signed-off')) {
    ports.print(
      `${specId} (${spec.title}) isn't signed off: only the maintainer adds \`signed-off\`.`,
    )
    return REFUSED
  }

  ports.print(`${specId} (${spec.title}) is signed off, and the factory is set up.`)

  const tickets = await tracker.getSubIssues(specId)
  let takeable = frontier(tickets)
  if (only) {
    const ticket = tickets.find((candidate) => candidate.id === only)
    if (!ticket) {
      ports.print(`${only} isn't a ticket of ${specId}.`)
      return REFUSED
    }
    const reasons = whyNotTakeable(ticket)
    if (reasons.length > 0) {
      ports.print(`${only} isn't takeable (${ticket.title}): ${reasons.join('; ')}.`)
      return REFUSED
    }
    takeable = [ticket]
  }

  printFrontier(ports, specId, takeable)
  if (dryRun) {
    ports.print('Dry run: nothing was changed.')
    return READY
  }
  ports.print("Working tickets isn't built yet (DEV-278), so nothing was changed. Use --dry-run.")
  return REFUSED
}

function printFrontier({ print }: FactoryPorts, specId: string, tickets: Ticket[]) {
  if (tickets.length === 0) {
    print(`Nothing on the frontier of ${specId}: no ticket is takeable now.`)
    return
  }
  print(`The frontier of ${specId}, in Linear's order:`)
  tickets.forEach((ticket, index) => {
    print(`${index + 1}. ${ticket.id} ${ticket.title}`)
    print(`   ${PLAN}`)
  })
}

const model = (step: Step) => `${STEPS[step].model}, ${STEPS[step].effort}`

/** The steps for one ticket (How a factory Run works, DEV-253), with each agent step's model. */
const PLAN =
  [
    'claim',
    'worktree and install',
    `Implementer (${model('implementer')})`,
    'host checks',
    `Reviewer (${model('reviewer')})`,
    'replay',
    'push gate',
    'push, PR and auto-merge',
    'wait for checks',
  ].join(' → ') +
  `; if the push gate fails: fix round 1 (${model('fixRound1')}), ` +
  `fix round 2 (${model('fixRound2')}), then park`

interface Command {
  specId: string
  dryRun: boolean
  /** The one ticket to work, from `--only`. */
  only: string | undefined
}

/** The parsed arguments, or null when they don't fit the usage. */
function readCommand(args: string[]): Command | null {
  let parsed
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: { 'dry-run': { type: 'boolean' }, only: { type: 'string' } },
    })
  } catch {
    return null
  }
  const [spec, ...rest] = parsed.positionals
  const { only } = parsed.values
  if (!spec || rest.length > 0 || !ISSUE_ID.test(spec)) return null
  if (only !== undefined && !ISSUE_ID.test(only)) return null
  return { specId: spec, dryRun: parsed.values['dry-run'] ?? false, only }
}

/** The set-up a Run needs, or what's missing or wrong in it, each naming where it belongs. */
type Setup = { linearApiKey: string } | { problems: string[] }

/** Checks the set-up from DEV-271 (the GitHub App) and DEV-272 (credentials). */
function readSetup({ repoDir, configDir }: FactoryPorts): Setup {
  const problems: string[] = []
  const configFile = join(configDir, 'config.env')
  const sandcastleFile = join(repoDir, '.sandcastle', '.env')
  const config = readEnvFile(configFile)
  const sandcastle = readEnvFile(sandcastleFile)

  if (!existsSync(join(configDir, 'app.pem'))) {
    problems.push(`GitHub App private key: ${join(configDir, 'app.pem')}`)
  }
  for (const [name, what] of [
    ['GITHUB_APP_ID', 'GitHub App ID'],
    ['GITHUB_INSTALLATION_ID', 'GitHub App installation ID'],
    ['LINEAR_API_KEY', 'Linear API key'],
  ] as const) {
    if (!config[name]) problems.push(`${what}: ${name} in ${configFile}`)
  }
  if (!sandcastle.CLAUDE_CODE_OAUTH_TOKEN && !sandcastle.ANTHROPIC_API_KEY) {
    problems.push(
      `Claude credential: CLAUDE_CODE_OAUTH_TOKEN (from \`claude setup-token\`) or ANTHROPIC_API_KEY in ${sandcastleFile}`,
    )
  }
  // It would override the effort every step sets for itself (src/settings.ts).
  if (sandcastle.CLAUDE_CODE_EFFORT_LEVEL !== undefined) {
    problems.push(
      `CLAUDE_CODE_EFFORT_LEVEL in ${sandcastleFile}: remove it, since it overrides every step's own effort`,
    )
  }
  if (problems.length > 0 || !config.LINEAR_API_KEY) return { problems }
  return { linearApiKey: config.LINEAR_API_KEY }
}

/** The variables in a `.env`-style file, or none when the file doesn't exist. */
function readEnvFile(path: string): Record<string, string | undefined> {
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {}
}

// `pnpm factory <spec> [--dry-run] [--only DEV-M]`: the command entry (DEV-269). Tests call
// factory() with fake ports; src/cli.ts calls it with the real ones.
//
// It checks that it may start (the set-up is complete, DEV-271 and DEV-272, and the issue is a spec
// the maintainer signed off), then reads the spec's frontier. `--dry-run` prints the frontier and
// each ticket's steps. `--only DEV-M` works that one ticket to a merged PR (src/run.ts); working
// the whole frontier comes with DEV-285.
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs, parseEnv } from 'node:util'
import { coveredIds, criteriaOf } from './criteria.ts'
import { frontier, whyNotTakeable } from './frontier.ts'
import type { Forge, GitHubApp, Sandboxes, Ticket, Tracker } from './ports.ts'
import { type RunContext, workTicket } from './run.ts'
import { type Settings, STEP_NAMES, ticketPlan, withOverrides } from './settings.ts'
import { describeWorkspace, workspacePackages } from './workspace.ts'

export interface FactoryPorts {
  /** The checkout the factory runs from, which holds `.sandcastle/.env`. */
  repoDir: string
  /** The maintainer's factory config: `app.pem` and `config.env` (normally ~/.config/myvgc-factory). */
  configDir: string
  /** Makes the Tracker from the Linear API key in `config.env`. */
  tracker: (linearApiKey: string) => Tracker
  /** Makes the Forge, which mints the App's installation token when the Run starts. */
  forge: (app: GitHubApp) => Forge
  sandboxes: Sandboxes
  now: () => Date
  print: (line: string) => void
}

/** Exit codes. */
const READY = 0
const REFUSED = 1
const USAGE_ERROR = 64

const USAGE =
  'Usage: pnpm factory <spec issue, such as DEV-269> [--dry-run] [--only DEV-M] [--<step> <model>]\n' +
  `  where <step> is ${STEP_NAMES.join(', ')} and <model> is such as opus-5-5`
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

  const { specId, dryRun, onlyTicketId, settings } = command
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
  let takeable: Ticket[]
  if (onlyTicketId) {
    const ticket = tickets.find((candidate) => candidate.id === onlyTicketId)
    if (!ticket) {
      ports.print(`${onlyTicketId} isn't a ticket of ${specId}.`)
      return REFUSED
    }
    const reasons = whyNotTakeable(ticket)
    if (reasons.length > 0) {
      ports.print(`${onlyTicketId} isn't takeable (${ticket.title}): ${reasons.join('; ')}.`)
      return REFUSED
    }
    takeable = [ticket]
  } else {
    takeable = frontier(tickets)
  }

  printFrontier(ports, specId, takeable, settings)
  if (dryRun) {
    ports.print('Dry run: nothing was changed.')
    return READY
  }
  const [ticket] = takeable
  if (!onlyTicketId || !ticket) {
    ports.print(
      "Working the whole frontier isn't built yet (DEV-285), so nothing was changed. Use --only.",
    )
    return REFUSED
  }

  const criteria = criteriaOf(spec.description)
  const covered = coveredIds(ticket.description)
  const unknown = covered.filter((id) => !criteria.has(id))
  // Parked before any agent runs (AC-14.2): the maintainer fixes the ticket or the spec.
  const unstartable =
    covered.length === 0
      ? `it has no "Covers:" line naming the criteria it covers`
      : unknown.length > 0
        ? `it covers ${unknown.join(', ')}, which ${specId} doesn't have`
        : undefined

  const runId = `${stamp(ports.now())}-${specId}`
  const runDir = join(ports.repoDir, '.factory', 'runs', runId)
  mkdirSync(runDir, { recursive: true })
  ports.print(`Run ${runId}: working ${ticket.id}. Its log is ${runDir}.`)
  const forge = ports.forge(setup.github)
  // Mints the installation token now, so a broken App key stops the Run before it claims anything.
  const author = await forge.botIdentity()
  const outcome = await workTicket(
    {
      runId,
      specId,
      runDir,
      tracker,
      forge,
      sandboxes: ports.sandboxes,
      sandboxEnv: setup.sandboxEnv,
      accuracyKey: setup.accuracyKey,
      author,
      settings,
      print: ports.print,
    },
    {
      ticket,
      specId,
      criteria: covered.flatMap((id) => criteria.get(id) ?? []),
      workspace: describeWorkspace(workspacePackages(ports.repoDir)),
    },
    unstartable,
  )
  ports.print(`Run ${runId} done: ${ticket.id} ${outcome}.`)
  return outcome === 'merged' ? READY : REFUSED
}

/** The local date and time as yyyy-mm-dd-hhmm, for Run IDs. */
function stamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

function printFrontier(
  { print }: FactoryPorts,
  specId: string,
  tickets: Ticket[],
  settings: Settings,
) {
  if (tickets.length === 0) {
    print(`Nothing on the frontier of ${specId}: no ticket is takeable now.`)
    return
  }
  print(`The frontier of ${specId}, in Linear's order:`)
  tickets.forEach((ticket, index) => {
    print(`${index + 1}. ${ticket.id} ${ticket.title}`)
    print(`   ${ticketPlan(settings)}`)
  })
}

interface Command {
  specId: string
  dryRun: boolean
  /** The one ticket to work, from `--only`. */
  onlyTicketId: string | undefined
  /** The step settings, with any `--<step> <model>` flags applied. */
  settings: Settings
}

/** The parsed arguments, or null when they don't fit the usage. */
function readCommand(args: string[]): Command | null {
  let parsed
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        'dry-run': { type: 'boolean' },
        only: { type: 'string' },
        ...Object.fromEntries(STEP_NAMES.map((step) => [step, { type: 'string' as const }])),
      },
    })
  } catch {
    return null
  }
  const [spec, ...rest] = parsed.positionals
  const { only } = parsed.values
  if (!spec || rest.length > 0 || !ISSUE_ID.test(spec)) return null
  if (only !== undefined && !ISSUE_ID.test(only)) return null
  const values = parsed.values as Record<string, string | boolean | undefined>
  const settings = withOverrides(
    Object.fromEntries(
      STEP_NAMES.map((step) => [step, values[step]]).filter(
        ([, model]) => typeof model === 'string',
      ),
    ),
  )
  if (!settings) return null
  return {
    specId: spec,
    dryRun: parsed.values['dry-run'] === true,
    onlyTicketId: typeof only === 'string' ? only : undefined,
    settings,
  }
}

/** The set-up a Run needs, or what's missing or wrong in it, each naming where it belongs. */
type Setup =
  | {
      linearApiKey: string
      github: GitHubApp
      sandboxEnv: Record<string, string>
      accuracyKey: RunContext['accuracyKey']
    }
  | { problems: string[] }

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
  const { LINEAR_API_KEY, GITHUB_APP_ID, GITHUB_INSTALLATION_ID } = config
  if (problems.length > 0 || !LINEAR_API_KEY || !GITHUB_APP_ID || !GITHUB_INSTALLATION_ID) {
    return { problems }
  }
  // The sandbox gets the Claude credential and nothing else: no GitHub token, no App key.
  const { CLAUDE_CODE_OAUTH_TOKEN, ANTHROPIC_API_KEY } = sandcastle
  const sandboxEnv: Record<string, string> = ANTHROPIC_API_KEY
    ? { ANTHROPIC_API_KEY }
    : { CLAUDE_CODE_OAUTH_TOKEN: CLAUDE_CODE_OAUTH_TOKEN ?? '' }
  return {
    linearApiKey: LINEAR_API_KEY,
    github: {
      keyPath: join(configDir, 'app.pem'),
      appId: GITHUB_APP_ID,
      installationId: GITHUB_INSTALLATION_ID,
    },
    sandboxEnv,
    // Optional: only a ticket that changes an ADR 24 path needs it, and parks without it.
    accuracyKey: { value: config.ANTHROPIC_API_KEY || undefined, home: configFile },
  }
}

/** The variables in a `.env`-style file, or none when the file doesn't exist. */
function readEnvFile(path: string): Record<string, string | undefined> {
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {}
}

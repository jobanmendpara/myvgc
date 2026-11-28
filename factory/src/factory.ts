// `pnpm factory <spec> [--dry-run] [--only DEV-M]`: the command entry (DEV-269). Tests call
// factory() with fake ports; src/cli.ts calls it with the real ones.
//
// It checks that it may start (the set-up is complete, DEV-271 and DEV-272, and the issue is a spec
// the maintainer signed off), then reads the spec's frontier. `--dry-run` prints the frontier and
// each ticket's steps. Without it, the Run works the whole frontier, two tickets at a time
// (src/slots.ts), each to a merged PR (src/run.ts); `--only DEV-M` works that one ticket. When the
// host died during an earlier Run of the spec, the same command takes that Run up again
// (src/recovery.ts): its unfinished tickets are adopted, each resuming from its last finished step.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs, parseEnv } from 'node:util'
import type { AccuracyKey } from './accuracy.ts'
import { coveredIds, criteriaOf } from './criteria.ts'
import { frontier, whyNotTakeable } from './frontier.ts'
import { RunCrash } from './notify.ts'
import type {
  Clock,
  Forge,
  GitHubApp,
  InstallationToken,
  Notifier,
  Sandboxes,
  Ticket,
  Tracker,
} from './ports.ts'
import { adoption } from './recovery.ts'
import { workTicket } from './run.ts'
import { RunLog } from './runlog.ts'
import { workFrontier } from './slots.ts'
import { endRun } from './summary.ts'
import { type Settings, STEP_NAMES, ticketPlan, withOverrides } from './settings.ts'
import { installationTokens } from './tokens.ts'
import { UsageLimit } from './usage.ts'
import { describeWorkspace, workspacePackages } from './workspace.ts'

export interface FactoryPorts {
  /** The checkout the factory runs from, which holds `.sandcastle/.env`. */
  repoDir: string
  /** The maintainer's factory config: `app.pem` and `config.env` (normally ~/.config/myvgc-factory). */
  configDir: string
  /** Makes the Tracker from the Linear API key in `config.env`. */
  tracker: (linearApiKey: string) => Tracker
  /**
   * Makes the Forge. It calls `token` before every GitHub call and makes the call with what it
   * gives: the App's current installation token, minted again when it is near its expiry.
   */
  forge: (app: GitHubApp, token: () => Promise<string>) => Forge
  /** Mints an installation token from the App's key. */
  mintToken: (app: GitHubApp) => Promise<InstallationToken>
  sandboxes: Sandboxes
  /** Interrupts the maintainer for what needs them (src/notify.ts). */
  notifier: Notifier
  clock: Clock
  /** This host process, which run.json records so a later Run can tell it died. */
  pid: number
  /** Whether a host process is still running. */
  isAlive: (pid: number) => boolean
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
  // A Run of the spec whose host died: its unfinished tickets are adopted, not claimed again.
  const adopted = adoption(ports.repoDir, specId, ports.isAlive, tickets, onlyTicketId)
  const checkpoints = new Map(
    adopted?.tickets.map(({ ticket, checkpoint }) => [ticket.id, checkpoint]),
  )
  for (const { ticket, checkpoint } of adopted?.tickets ?? []) {
    ports.print(
      `Run ${adopted?.record.runId}'s host died: adopting ${ticket.id} ${ticket.title}, from its last finished step (${checkpoint.step}).`,
    )
  }
  let takeable: Ticket[]
  if (adopted) {
    // Adopted first, then whatever else is takeable, as the dead Run would have gone on to.
    const rest = onlyTicketId
      ? []
      : frontier(tickets).filter((ticket) => !checkpoints.has(ticket.id))
    takeable = [...adopted.tickets.map(({ ticket }) => ticket), ...rest]
  } else if (onlyTicketId) {
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

  const criteria = criteriaOf(spec.description)
  const workspace = describeWorkspace(workspacePackages(ports.repoDir))
  const now = () => ports.clock.now()
  const runId = adopted?.record.runId ?? `${stamp(now())}-${specId}`
  const runDir = adopted?.dir ?? join(ports.repoDir, '.factory', 'runs', runId)
  const log = new RunLog(runDir, { runId, specId, pid: ports.pid }, now, adopted?.record)
  ports.print(
    `Run ${runId}: working ${onlyTicketId ?? `the frontier of ${specId}`}. Its log is ${runDir}.`,
  )
  const token = installationTokens(() => ports.mintToken(setup.github), ports.clock)
  const forge = ports.forge(setup.github, token)
  // One for the whole Run: a usage limit holds back every ticket's agent steps.
  const usage = new UsageLimit(ports.clock, log)
  /** What the Run threw, if it crashed: the first throw, from a ticket's turn or the Run's end. */
  let crashed: { error: unknown } | undefined
  let results: Awaited<ReturnType<typeof workFrontier>> = []
  try {
    // Minted now, so a broken App key stops the Run before it claims anything.
    await token()
    const author = await forge.botIdentity()
    results = await workFrontier({
      takeable,
      // `--only` works that one ticket, and the Run ends after it.
      reread: onlyTicketId ? undefined : () => tracker.getSubIssues(specId),
      sandboxes: ports.sandboxes,
      work: (ticket, sandboxes) => {
        const covered = coveredIds(ticket.description)
        return workTicket(
          {
            runId,
            specId,
            runDir,
            log,
            tracker,
            forge,
            clock: ports.clock,
            usage,
            sandboxes,
            notifier: ports.notifier,
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
            workspace,
          },
          unstartableReason(specId, covered, criteria),
          checkpoints.get(ticket.id),
        )
      },
    })
  } catch (error) {
    crashed = { error }
  }
  try {
    // Even when a ticket's turn throws, the Run ends with its summary: the ticket shows unfinished.
    await endRun(ports, tracker, log, { crashed: crashed !== undefined })
  } catch (error) {
    crashed ??= { error }
  }
  // Where the Run was, for src/cli.ts's crash notification, which replaces the end's.
  if (crashed) throw new RunCrash(log, crashed.error)
  // A PR waiting on `approved` is a hand-off to the maintainer, not a failure: the Run moved on.
  return results.every(({ outcome }) => outcome === 'merged' || outcome === 'waiting for approval')
    ? READY
    : REFUSED
}

/**
 * Why a ticket can't start, if it can't: it is parked before any agent runs (AC-14.2), and the
 * maintainer fixes the ticket or the spec.
 */
function unstartableReason(
  specId: string,
  covered: string[],
  criteria: ReadonlyMap<string, unknown>,
): string | undefined {
  const unknown = covered.filter((id) => !criteria.has(id))
  if (covered.length === 0) return `it has no "Covers:" line naming the criteria it covers`
  if (unknown.length > 0) return `it covers ${unknown.join(', ')}, which ${specId} doesn't have`
  return undefined
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
      accuracyKey: AccuracyKey
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

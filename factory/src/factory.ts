// `pnpm factory <spec> [--dry-run] [--only DEV-M]`: the command entry (DEV-269). Tests call
// factory() with fake ports; src/cli.ts calls it with the real ones.
//
// So far it only checks that it may start: the set-up is complete (DEV-271, DEV-272) and the issue
// is a spec the maintainer signed off. Reading the frontier and working tickets come in later
// tickets of DEV-269.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs, parseEnv } from 'node:util'
import type { Tracker } from './ports.ts'

export interface FactoryEnv {
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

export async function factory(args: string[], env: FactoryEnv): Promise<number> {
  const command = readCommand(args)
  if (!command) {
    env.print(USAGE)
    return USAGE_ERROR
  }

  const setup = readSetup(env)
  if (setup.problems.length > 0) {
    env.print("The factory isn't set up yet:")
    for (const problem of setup.problems) env.print(`- ${problem}`)
    return REFUSED
  }

  const spec = await env.tracker(setup.linearApiKey).getIssue(command.spec)
  if (!spec) {
    env.print(`${command.spec} wasn't found in Linear.`)
    return REFUSED
  }
  if (!spec.labels.includes('spec')) {
    env.print(`${command.spec} isn't a spec: it has no \`spec\` label.`)
    return REFUSED
  }
  if (!spec.labels.includes('signed-off')) {
    env.print(
      `${command.spec} (${spec.title}) isn't signed off: only the maintainer adds \`signed-off\`.`,
    )
    return REFUSED
  }

  env.print(`${command.spec} (${spec.title}) is signed off, and the factory is set up.`)
  return READY
}

interface Command {
  spec: string
  dryRun: boolean
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
  return { spec, dryRun: parsed.values['dry-run'] ?? false, only }
}

interface Setup {
  /** What's missing or wrong, each naming where it belongs. */
  problems: string[]
  linearApiKey: string
}

/** Checks the set-up from DEV-271 (the GitHub App) and DEV-272 (credentials). */
function readSetup({ repoDir, configDir }: FactoryEnv): Setup {
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
  return { problems, linearApiKey: config.LINEAR_API_KEY ?? '' }
}

/** The variables in a `.env`-style file, or none when the file doesn't exist. */
function readEnvFile(path: string): Record<string, string | undefined> {
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {}
}

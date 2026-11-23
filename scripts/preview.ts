// `pnpm preview`: runs the app from this checkout (any worktree) so an agent can look at its own UI
// changes (DEV-184). The API runs on a throwaway in-process database (apps/api/scripts/
// preview-server.ts) and the web app under `nuxt dev`, on free ports from PORT_RANGE. It never reads
// .env, never touches the dev database and never uses ports 3000 or 3001 (see
// docs/wiki/up-local-shares-dev-db.md).
//
//   pnpm preview          start in the background, sign up a User with one Team, print the address
//   pnpm preview status   print the address if it's running
//   pnpm preview:stop     stop it; the database goes with it
//
// What's running is kept in .preview/state.json, which `pnpm screenshots` reads. Logs are in
// .preview/api.log and .preview/web.log. Tested by scripts/preview.test.ts (`pnpm test:scripts`).
import { type ChildProcess, spawn } from 'node:child_process'
import { mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Ports the preview may use: never 3000 or 3001, which `pnpm dev` and `pnpm up:local` use. */
export const PORT_RANGE = { from: 3100, to: 3999 } as const
const READY_TIMEOUT_MS = 180_000

export const ROOT = fileURLToPath(new URL('..', import.meta.url))

export interface PreviewState {
  url: string
  apiPort: number
  webPort: number
  /** Process group leaders, one per server. */
  pids: number[]
  email: string
  password: string
  /** The seeded Team's page, which shows Sprites. */
  teamPath: string
}

export const previewDir = (root = ROOT) => join(root, '.preview')
const statePath = (root: string) => join(previewDir(root), 'state.json')

/** Whether nothing listens on `port`, on IPv4 or IPv6 localhost. */
export async function isFree(port: number): Promise<boolean> {
  for (const host of ['127.0.0.1', '::1']) {
    const free = await new Promise<boolean>((resolve) => {
      const server = createServer()
      server.once('error', (error: NodeJS.ErrnoException) =>
        // No IPv6 on this machine counts as free there.
        resolve(error.code === 'EADDRNOTAVAIL' || error.code === 'EAFNOSUPPORT'),
      )
      server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(true)))
    })
    if (!free) return false
  }
  return true
}

/**
 * `count` distinct free ports from PORT_RANGE, starting at a random one so two worktrees starting
 * at once are unlikely to race for the same port.
 */
export async function pickPorts(
  count: number,
  free: (port: number) => Promise<boolean> = isFree,
  start = PORT_RANGE.from + Math.floor(Math.random() * (PORT_RANGE.to - PORT_RANGE.from + 1)),
): Promise<number[]> {
  const size = PORT_RANGE.to - PORT_RANGE.from + 1
  const picked: number[] = []
  for (let i = 0; i < size && picked.length < count; i++) {
    const port = PORT_RANGE.from + ((start - PORT_RANGE.from + i) % size)
    if (await free(port)) picked.push(port)
  }
  if (picked.length < count) throw new Error(`No ${count} free ports between 3100 and 3999.`)
  return picked
}

export function readState(root = ROOT): PreviewState | undefined {
  try {
    return JSON.parse(readFileSync(statePath(root), 'utf8')) as PreviewState
  } catch {
    return undefined
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** The running preview, or undefined. Clears a state file whose servers have gone. */
export function runningPreview(root = ROOT): PreviewState | undefined {
  const state = readState(root)
  if (!state) return undefined
  if (state.pids.some(alive)) return state
  rmSync(statePath(root), { force: true })
  return undefined
}

/** Stops each process group, waiting up to 10 seconds before killing it. */
async function stopGroups(pids: number[]) {
  const signal = (pid: number, name: NodeJS.Signals) => {
    try {
      process.kill(-pid, name)
    } catch {
      // Already gone.
    }
  }
  pids.forEach((pid) => signal(pid, 'SIGTERM'))
  for (let waited = 0; waited < 10_000 && pids.some(alive); waited += 200) {
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  pids.filter(alive).forEach((pid) => signal(pid, 'SIGKILL'))
}

export async function stop(root = ROOT): Promise<string> {
  const state = readState(root)
  if (!state) return 'No preview is running.'
  await stopGroups(state.pids)
  rmSync(statePath(root), { force: true })
  return `Stopped the preview at ${state.url}.`
}

function startServer(command: string[], cwd: string, env: NodeJS.ProcessEnv, log: string) {
  const out = openSync(log, 'w')
  // Its own process group, so stopping it also stops pnpm's children (tsx, nuxt, vite).
  const child: ChildProcess = spawn(command[0]!, command.slice(1), {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ['ignore', out, out],
  })
  child.unref()
  return child.pid!
}

async function waitFor(url: string, deadline: number, log: string) {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`${url} didn't answer within ${READY_TIMEOUT_MS / 1000} s; see ${log}.`)
}

/** Signs up the preview User and gives them one Team, through the API like the web app. */
async function seed(root: string, url: string, apiPort: number) {
  const api = `http://localhost:${apiPort}`
  const email = 'preview@example.com'
  const password = 'preview-password'
  const signUp = await fetch(`${api}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: url },
    body: JSON.stringify({ email, password, name: 'Preview' }),
  })
  if (!signUp.ok) throw new Error(`Signing up the preview User failed: ${signUp.status}`)
  const cookie = signUp.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  // The 2026 World Championships winner's team list, as in the smoke test.
  const paste = readFileSync(
    join(root, 'packages/core/test/fixtures/worlds-2026-yamazaki-ots.txt'),
    'utf8',
  )
  const team = await fetch(`${api}/api/teams`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: url, cookie },
    body: JSON.stringify({ name: 'Preview Team', regulation: 'M-B', paste }),
  })
  if (!team.ok) throw new Error(`Creating the preview Team failed: ${team.status}`)
  const { team: created } = (await team.json()) as { team: { id: string } }
  return { email, password, teamPath: `/teams/${created.id}` }
}

export async function start(root = ROOT): Promise<PreviewState> {
  const running = runningPreview(root)
  if (running) return running

  mkdirSync(previewDir(root), { recursive: true })
  const [apiPort, webPort] = (await pickPorts(2)) as [number, number]
  const url = `http://localhost:${webPort}`
  const apiLog = join(previewDir(root), 'api.log')
  const webLog = join(previewDir(root), 'web.log')

  const pids = [
    startServer(
      ['pnpm', '--filter', '@myvgc/api', 'exec', 'tsx', 'scripts/preview-server.ts'],
      root,
      { PORT: String(apiPort), APP_URL: url },
      apiLog,
    ),
    startServer(
      ['pnpm', '--filter', '@myvgc/web', 'exec', 'nuxt', 'dev', '--port', String(webPort)],
      root,
      // The web app's dev proxy sends /api here (apps/web/nuxt.config.ts).
      { API_PORT: String(apiPort), PORT: String(webPort) },
      webLog,
    ),
  ]
  // Written now, so `pnpm preview:stop` can clean up even if starting fails.
  const partial = { url, apiPort, webPort, pids, email: '', password: '', teamPath: '' }
  writeFileSync(statePath(root), JSON.stringify(partial, null, 2))

  try {
    const deadline = Date.now() + READY_TIMEOUT_MS
    await waitFor(`http://localhost:${apiPort}/api/health`, deadline, apiLog)
    await waitFor(url, deadline, webLog)
    const state: PreviewState = { ...partial, ...(await seed(root, url, apiPort)) }
    writeFileSync(statePath(root), JSON.stringify(state, null, 2))
    return state
  } catch (error) {
    await stop(root)
    throw error
  }
}

function summary(state: PreviewState) {
  return [
    `Preview running at ${state.url} (API on ${state.apiPort}), with a throwaway database.`,
    `Log in as ${state.email} / ${state.password}. Their Team: ${state.url}${state.teamPath}`,
    'Screenshots: pnpm screenshots [path...]   Stop: pnpm preview:stop',
  ].join('\n')
}

async function main(command = 'start') {
  if (command === 'start') {
    process.on('SIGINT', () => void stop().then(() => process.exit(130)))
    console.log(summary(await start()))
  } else if (command === 'stop') {
    console.log(await stop())
  } else if (command === 'status') {
    const state = runningPreview()
    console.log(state ? summary(state) : 'No preview is running.')
  } else {
    console.error('Usage: pnpm preview [start|status|stop]')
    process.exit(64)
  }
}

if (import.meta.main) {
  main(process.argv[2]).catch((error: Error) => {
    console.error(error.message)
    process.exit(1)
  })
}

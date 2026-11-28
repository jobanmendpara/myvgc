// The real Sandboxes: Sandcastle's docker() provider (What Sandcastle needs to run MyVGC in Docker,
// DEV-248), on the image built from .sandcastle/Dockerfile. Thin on purpose, and not unit-tested:
// the pilot's first Run proves it (DEV-269). The spike's prototype/sandcastle-spike branch shows the
// same calls.
//
// Sandcastle mounts the repo's git folder into the sandbox so its commits land in the repo. An
// agent could therefore change the repo's git config or hooks, which the maintainer's own git
// commands would then run. So the commit author is set in the sandbox's environment, never with
// `git config`, and closing a sandbox refuses loudly if the config or a hook changed while it ran.
// Sandcastle has no memory limit, only `cpus` (the spike, DEV-251).
//
// Each ticket's Claude session folder is a folder of the Run's, mounted in the sandbox as Claude's
// projects folder and used by Sandcastle as its host store, so a session outlives the sandbox and
// the host process (DEV-286). An agent that stops short, killed by the idle timeout or reporting an
// error such as a 429, is handed back with `stopped`, with its session found in that folder.
import {
  claudeCode,
  claudeHostSessionPath,
  createSandbox,
  transferClaudeSession,
} from '@ai-hero/sandcastle'
import { docker } from '@ai-hero/sandcastle/sandboxes/docker'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { checkBranchName, continueFrom, hostGit } from './hostgit.ts'
import { type AgentResult, type AgentStop, type Sandboxes, STORE_DIR } from './ports.ts'

export const IMAGE = 'sandcastle:myvgc'
/** Each sandbox's share of the Docker VM (8 CPUs, about 7.7 GiB): two run at once. */
const CPUS = 3
/** Claude Code's projects folder in the image, where it writes each session's JSONL. */
const SANDBOX_PROJECTS = '/home/agent/.claude/projects'

export function sandcastleSandboxes(repoDir: string): Sandboxes {
  return {
    async create({ branch, base, env, author, sessions }) {
      requireImage()
      const gitDir = commonGitDir(repoDir)
      // So `base` is today's main, not whatever the host last fetched.
      const [remote = 'origin', ...rest] = base.split('/')
      checkBranchName(branch)
      hostGit(repoDir, ['fetch', remote, rest.join('/')])
      const start = continueFrom(repoDir, remote, branch) ?? base
      // The host keeps pnpm's store, so each sandbox's install reuses what the last one fetched.
      const store = join(homedir(), '.cache', 'myvgc-factory', 'pnpm-store')
      mkdirSync(store, { recursive: true })
      mkdirSync(sessions, { recursive: true })
      const sandbox = await createSandbox({
        branch,
        baseBranch: start,
        cwd: repoDir,
        sandbox: docker({
          imageName: IMAGE,
          cpus: CPUS,
          env: {
            GIT_AUTHOR_NAME: author.name,
            GIT_AUTHOR_EMAIL: author.email,
            GIT_COMMITTER_NAME: author.name,
            GIT_COMMITTER_EMAIL: author.email,
          },
          mounts: [
            { hostPath: store, sandboxPath: STORE_DIR },
            { hostPath: sessions, sandboxPath: SANDBOX_PROJECTS },
          ],
        }),
      })
      // Taken once Sandcastle has made the worktree, and before any agent runs.
      const before = fingerprint(gitDir)
      return {
        worktreePath: sandbox.worktreePath,
        async exec(command, options) {
          const { stdin, env } = options ?? {}
          const result = env
            ? await sandbox.exec(...withEnv(command, env, stdin))
            : await sandbox.exec(command, stdin === undefined ? undefined : { stdin })
          return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr }
        },
        async runAgent(step): Promise<AgentResult> {
          const startedAt = Date.now()
          let result
          try {
            result = await sandbox.run({
              name: step.name,
              agent: claudeCode(step.model, {
                effort: step.effort,
                env,
                sessionStorage: { hostProjectsDir: sessions, sandboxProjectsDir: SANDBOX_PROJECTS },
              }),
              prompt: step.prompt,
              idleTimeoutSeconds: step.idleTimeoutSeconds,
              ...(step.resumeSession ? { resumeSession: step.resumeSession } : {}),
            })
          } catch (error) {
            const stopped = stopOf(error)
            if (!stopped) throw error
            return {
              stdout: '',
              stopped,
              ...sessionLeft(sessions, startedAt, sandbox.worktreePath, step.resumeSession),
            }
          }
          const last = result.iterations.at(-1)
          // Sandcastle captures the session JSONL to the host; the Run saves and costs it.
          const path = last?.sessionFilePath
          return {
            stdout: result.stdout,
            sessionId: last?.sessionId,
            ...(path && existsSync(path) ? { session: readFileSync(path, 'utf8') } : {}),
          }
        },
        async close() {
          await sandbox.close()
          if (fingerprint(gitDir) !== before) {
            throw new Error(
              `The repo's git config or hooks in ${gitDir} changed while a sandbox ran. Check ` +
                `them before running git in this checkout: an agent may have planted a command.`,
            )
          }
        },
      }
    },
  }
}

/**
 * Sandcastle's exec takes no environment, so the values go in on stdin, one per line, and the
 * shell exports them for this command alone. They never show in the command line, so not in `ps`
 * or a log of commands.
 */
function withEnv(
  command: string,
  env: Record<string, string>,
  stdin: string | undefined,
): [string, { stdin: string }] {
  if (stdin !== undefined) throw new Error('A command given env takes no stdin of its own.')
  const names = Object.keys(env)
  for (const [name, value] of Object.entries(env)) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(name) || value.includes('\n')) {
      throw new Error(`${name} can't be passed to a sandbox command.`)
    }
  }
  const exports = names.map((name) => `IFS= read -r ${name} && export ${name}`).join(' && ')
  return [
    // Grouped, so a command holding `;` or `||` still runs only once the exports have.
    `${exports} && exec </dev/null && { ${command}\n}`,
    { stdin: names.map((name) => `${env[name]}\n`).join('') },
  ]
}

/** The git folder the checkout and all its worktrees share. */
function commonGitDir(repoDir: string): string {
  const dir = hostGit(repoDir, ['rev-parse', '--git-common-dir']).trim()
  return isAbsolute(dir) ? dir : join(repoDir, dir)
}

/** A hash of the repo's git config and hooks, the parts that make git run commands. */
function fingerprint(gitDir: string): string {
  const hash = createHash('sha256')
  const config = join(gitDir, 'config')
  hash.update(existsSync(config) ? readFileSync(config) : '')
  const hooks = join(gitDir, 'hooks')
  if (existsSync(hooks)) {
    for (const name of readdirSync(hooks).sort()) {
      hash.update(name)
      hash.update(readFileSync(join(hooks, name)))
    }
  }
  return hash.digest('hex')
}

/**
 * Why an agent stopped short, from Sandcastle's error, or undefined for any other failure.
 * `sandbox.run()` rejects with Effect's FiberFailure, which holds the tagged error in its cause
 * and names it "(FiberFailure) AgentError": the tag is read from either.
 */
function stopOf(error: unknown): AgentStop | undefined {
  const failure = error as
    | (Error & { _tag?: string } & Record<symbol, { _tag?: string; error?: unknown } | undefined>)
    | null
  if (!failure || typeof failure !== 'object') return undefined
  const cause = failure[Symbol.for('effect/Runtime/FiberFailure/Cause')]
  const inner = (cause?._tag === 'Fail' ? cause.error : failure) as {
    _tag?: string
    message?: string
  }
  const tag = inner._tag ?? /^\(FiberFailure\) (\w+)/.exec(failure.name)?.[1]
  if (tag === 'AgentIdleTimeoutError') return { kind: 'idle timeout' }
  if (tag === 'AgentError')
    return { kind: 'error', message: String(inner.message ?? failure.message) }
  return undefined
}

/**
 * The session an agent that stopped short was writing, from the mounted folder: the one it resumed,
 * or the newest written since it started. Sandcastle captures a session only when its agent
 * finishes, so it is put where Sandcastle looks for one to resume, keyed by the host's worktree.
 */
function sessionLeft(
  sessions: string,
  since: number,
  hostCwd: string,
  resumed: string | undefined,
): { sessionId?: string; session?: string } {
  const files = readdirSync(sessions, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      readdirSync(join(sessions, entry.name))
        .filter((name) => name.endsWith('.jsonl'))
        .map((name) => join(sessions, entry.name, name)),
    )
    .map((path) => ({ path, written: statSync(path).mtimeMs }))
    .filter(({ path, written }) =>
      resumed ? basename(path, '.jsonl') === resumed : written >= since,
    )
    .sort((a, b) => b.written - a.written)
  const newest = files[0]
  if (!newest) return {}
  const sessionId = basename(newest.path, '.jsonl')
  const session = readFileSync(newest.path, 'utf8')
  const hostPath = claudeHostSessionPath(hostCwd, sessionId, sessions)
  if (hostPath !== newest.path) {
    const cwd = /"cwd":"([^"]+)"/.exec(session)?.[1]
    mkdirSync(dirname(hostPath), { recursive: true })
    writeFileSync(hostPath, cwd ? transferClaudeSession(session, cwd, hostCwd) : session)
  }
  return { sessionId, session }
}

function requireImage() {
  try {
    execFileSync('docker', ['image', 'inspect', IMAGE], { stdio: 'ignore' })
  } catch {
    throw new Error(
      `The Docker image ${IMAGE} isn't built: run \`docker build -t ${IMAGE} .sandcastle\`.`,
    )
  }
}

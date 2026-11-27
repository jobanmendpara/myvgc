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
import { claudeCode, createSandbox } from '@ai-hero/sandcastle'
import { docker } from '@ai-hero/sandcastle/sandboxes/docker'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { type Sandboxes, STORE_DIR } from './ports.ts'

export const IMAGE = 'sandcastle:myvgc'
/** Each sandbox's share of the Docker VM (8 CPUs, about 7.7 GiB): two run at once. */
const CPUS = 3

export function sandcastleSandboxes(repoDir: string): Sandboxes {
  return {
    async create({ branch, base, env, author }) {
      requireImage()
      const gitDir = commonGitDir(repoDir)
      // So `base` is today's main, not whatever the host last fetched.
      const [remote = 'origin', ...rest] = base.split('/')
      git(repoDir, ['fetch', remote, rest.join('/')])
      const start = continueFrom(repoDir, remote, branch) ?? base
      // The host keeps pnpm's store, so each sandbox's install reuses what the last one fetched.
      const store = join(homedir(), '.cache', 'myvgc-factory', 'pnpm-store')
      mkdirSync(store, { recursive: true })
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
          mounts: [{ hostPath: store, sandboxPath: STORE_DIR }],
        }),
      })
      // Taken once Sandcastle has made the worktree, and before any agent runs.
      const before = fingerprint(gitDir)
      return {
        worktreePath: sandbox.worktreePath,
        async exec(command, options) {
          const result = await sandbox.exec(
            command,
            options?.stdin === undefined ? undefined : { stdin: options.stdin },
          )
          return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr }
        },
        async runAgent(step) {
          const result = await sandbox.run({
            name: step.name,
            agent: claudeCode(step.model, { effort: step.effort, env }),
            prompt: step.prompt,
            idleTimeoutSeconds: step.idleTimeoutSeconds,
          })
          return { stdout: result.stdout }
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

/** Host git with the repo's hooks and fsmonitor turned off, in case an agent planted one. */
function git(cwd: string, args: string[], stderr: 'inherit' | 'ignore' = 'inherit'): string {
  return execFileSync(
    'git',
    ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', stderr] },
  )
}

/**
 * Where a branch pushed before (a parked ticket's) continues from, so the Run builds on its pushed
 * state, maintainer's commits included. Returns the remote branch when there's no local one, and
 * moves a local one up to it when the local one is behind. A local branch with commits the remote
 * lacks, as when GitHub turned the push down, stays as it is. Undefined for a branch never pushed.
 */
function continueFrom(repoDir: string, remote: string, branch: string): string | undefined {
  const pushed = `${remote}/${branch}`
  if (!succeeds(repoDir, ['fetch', remote, branch])) return undefined
  if (!succeeds(repoDir, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]))
    return pushed
  if (succeeds(repoDir, ['merge-base', '--is-ancestor', branch, pushed])) {
    git(repoDir, ['branch', '--force', branch, pushed])
  }
  return undefined
}

function succeeds(cwd: string, args: string[]): boolean {
  try {
    git(cwd, args, 'ignore')
    return true
  } catch {
    return false
  }
}

/** The git folder the checkout and all its worktrees share. */
function commonGitDir(repoDir: string): string {
  const dir = git(repoDir, ['rev-parse', '--git-common-dir']).trim()
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

function requireImage() {
  try {
    execFileSync('docker', ['image', 'inspect', IMAGE], { stdio: 'ignore' })
  } catch {
    throw new Error(
      `The Docker image ${IMAGE} isn't built: run \`docker build -t ${IMAGE} .sandcastle\`.`,
    )
  }
}

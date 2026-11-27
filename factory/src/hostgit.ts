// Git on the host, for the real adapters. Sandcastle mounts the repo's git folder into each
// sandbox, so an agent can plant config or hooks there. Every host git command here runs with the
// settings that make git run a command of the repo's choosing turned off, and only over the
// protocols the factory uses: hooks, fsmonitor, credential helpers, a custom ssh command, and
// transports such as ext:: or a local path (whose upload-pack the repo config could name).
import { execFileSync } from 'node:child_process'

/** The transports the factory's own git commands use: origin over SSH, the App over HTTPS. */
export const PROTOCOLS = 'ssh:https'

const UNTRUSTING = [
  'core.hooksPath=/dev/null',
  'core.fsmonitor=false',
  'credential.helper=',
  'core.sshCommand=ssh',
]

/** Runs git in `cwd` without trusting the repo's config. Throws when git exits non-zero. */
export function hostGit(
  cwd: string,
  args: string[],
  { protocols = PROTOCOLS, quiet = false }: { protocols?: string; quiet?: boolean } = {},
): string {
  return execFileSync('git', [...UNTRUSTING.flatMap((setting) => ['-c', setting]), ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', quiet ? 'ignore' : 'inherit'],
    env: { ...process.env, GIT_ALLOW_PROTOCOL: protocols, GIT_TERMINAL_PROMPT: '0' },
  })
}

function succeeds(cwd: string, args: string[], protocols: string): boolean {
  try {
    hostGit(cwd, args, { protocols, quiet: true })
    return true
  } catch {
    return false
  }
}

/**
 * Checks a branch name from Linear before it reaches a git command line: a name starting with `-`
 * would be read as an option.
 */
export function checkBranchName(branch: string): void {
  if (
    branch.startsWith('-') ||
    !succeeds('.', ['check-ref-format', '--branch', branch], PROTOCOLS)
  ) {
    throw new Error(`Linear's branch name ${JSON.stringify(branch)} isn't a usable git branch.`)
  }
}

/**
 * Where a ticket's branch continues from, when it was pushed before (a parked ticket's), so the Run
 * builds on its pushed state, the maintainer's commits included:
 * - never pushed: undefined, and the caller forks the base;
 * - pushed, with no local branch: the pushed branch;
 * - the local branch behind the pushed one: the local branch is moved up to it, and undefined;
 * - the local branch ahead, as after GitHub turned its push down: kept as it is, and undefined.
 * It throws when the two have diverged, or when the local branch must move but is checked out in a
 * worktree Sandcastle kept: both need the maintainer.
 */
export function continueFrom(
  repoDir: string,
  remote: string,
  branch: string,
  protocols = PROTOCOLS,
): string | undefined {
  checkBranchName(branch)
  const local = `refs/heads/${branch}`
  const pushed = `refs/remotes/${remote}/${branch}`
  if (!succeeds(repoDir, ['fetch', remote, `+${local}:${pushed}`], protocols)) return undefined
  if (!succeeds(repoDir, ['rev-parse', '--verify', '--quiet', local], protocols)) {
    return `${remote}/${branch}`
  }
  if (succeeds(repoDir, ['merge-base', '--is-ancestor', local, pushed], protocols)) {
    const worktrees = hostGit(repoDir, ['worktree', 'list', '--porcelain'], { protocols })
    const checkedOut = worktrees.split('\n\n').find((entry) => entry.includes(`\nbranch ${local}`))
    if (
      checkedOut &&
      hostGit(repoDir, ['rev-parse', local], { protocols }) !==
        hostGit(repoDir, ['rev-parse', pushed], { protocols })
    ) {
      const path = /^worktree (.+)$/m.exec(checkedOut)?.[1]
      throw new Error(
        `${branch} is checked out in ${path}, so it can't take the pushed commits: commit or remove that worktree first.`,
      )
    }
    hostGit(repoDir, ['update-ref', local, pushed], { protocols })
    return undefined
  }
  if (succeeds(repoDir, ['merge-base', '--is-ancestor', pushed, local], protocols)) return undefined
  throw new Error(
    `${branch} and ${remote}/${branch} have diverged: merge them by hand, then send the ticket back.`,
  )
}

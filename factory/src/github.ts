// The real Forge: GitHub as the `myvgc-factory` App (Give factory agents their own GitHub identity,
// DEV-256). Before every GitHub call it asks the Run for the installation token (src/tokens.ts
// mints a new one near its expiry), and passes it to `gh` and wait-for-checks.sh as GH_TOKEN and
// to `git push` in an HTTP header, never on a command line.
//
// Sandcastle mounts the repo's git folder into each sandbox, so an agent can write the repo's git
// config and hooks. Nothing here trusts them: the repo is read once, when the Forge is made, before
// any agent runs; `gh` and wait-for-checks.sh run outside the checkout with GH_REPO; and `git push`
// runs with hooks, fsmonitor and credential helpers turned off, its header only for github.com.
//
// Thin on purpose, and not unit-tested: the pilot's first Run proves it (DEV-269).
import { execFile, execFileSync, spawn } from 'node:child_process'
import { createSign } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { hostGit } from './hostgit.ts'
import type { Forge, GitHubApp, GitIdentity, InstallationToken } from './ports.ts'

const run = promisify(execFile)
const API = 'https://api.github.com'

export function githubForge(
  app: GitHubApp,
  repoDir: string,
  installationToken: () => Promise<string>,
): Forge {
  const repo = repoOf(
    execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: repoDir, encoding: 'utf8' }),
  )
  const [owner] = repo.split('/')
  if (!owner) throw new Error(`origin names no repo owner: ${repo}`)
  const ghEnv = async () => ({ ...process.env, GH_TOKEN: await installationToken(), GH_REPO: repo })
  const gh = async (args: string[], stdin?: string) => {
    const child = run('gh', args, { cwd: tmpdir(), env: await ghEnv() })
    if (stdin !== undefined) {
      child.child.stdin?.end(stdin)
    }
    return (await child).stdout.trim()
  }

  // The user name in the URL keeps the host's global `insteadOf` rewrite to SSH from matching (the
  // spike, DEV-251), and the token goes in a header set through the environment.
  const remote = `https://x-access-token@github.com/${repo}.git`
  const pushEnv = async (): Promise<Record<string, string>> => {
    const header = Buffer.from(`x-access-token:${await installationToken()}`).toString('base64')
    const untrusted = [
      ['core.hooksPath', '/dev/null'],
      ['core.fsmonitor', 'false'],
      ['credential.helper', ''],
      ['core.sshCommand', 'ssh'],
      ['http.https://github.com/.extraHeader', `Authorization: Basic ${header}`],
    ]
    return {
      GIT_TERMINAL_PROMPT: '0',
      // Only HTTPS, so planted config can't send the push through ext:: or a local path.
      GIT_ALLOW_PROTOCOL: 'https',
      GIT_ASKPASS: '',
      GIT_CONFIG_COUNT: String(untrusted.length),
      ...Object.fromEntries(
        untrusted.flatMap(([key, value], index) => [
          [`GIT_CONFIG_KEY_${index}`, key],
          [`GIT_CONFIG_VALUE_${index}`, value],
        ]),
      ),
    }
  }
  let identity: Promise<GitIdentity> | undefined
  const botIdentity = () =>
    (identity ??= (async () => {
      const { slug } = await githubApi<{ slug: string }>('/app', `Bearer ${appJwt(app)}`)
      const name = `${slug}[bot]`
      const { id } = await githubApi<{ id: number }>(`/users/${encodeURIComponent(name)}`)
      return { name, email: `${id}+${name}@users.noreply.github.com` }
    })().catch((error: unknown) => {
      // Not cached: the next call asks GitHub again.
      identity = undefined
      throw error
    }))

  return {
    botIdentity,

    async push(cwd, branch, options) {
      try {
        await run(
          'git',
          [
            'push',
            '--no-verify',
            // Leased to the commit GitHub had: a push made since is never overwritten.
            ...(options
              ? [`--force-with-lease=refs/heads/${branch}:${options.forceWithLease}`]
              : []),
            remote,
            `HEAD:refs/heads/${branch}`,
          ],
          { cwd, env: { ...process.env, ...(await pushEnv()) } },
        )
      } catch (error) {
        // GitHub's answer when an App without the Workflows permission changes .github/workflows/.
        if (
          /refusing to allow a GitHub App to create or update workflow/.test(
            String((error as { stderr?: string }).stderr),
          )
        ) {
          return 'workflows refused'
        }
        throw error
      }
      return 'pushed'
    },

    maintainer() {
      return owner
    },

    async openPr({ branch, title, body, draft }) {
      // A parked ticket's branch may have a draft PR already: the Run that takes it up again
      // brings that one up to date, and marks it ready when the ticket is.
      const [existing] = JSON.parse(
        await gh([
          'pr',
          'list',
          '--head',
          branch,
          '--state',
          'open',
          '--json',
          'number,url,isDraft',
        ]),
      ) as { number: number; url: string; isDraft: boolean }[]
      if (existing) {
        await gh(
          ['pr', 'edit', String(existing.number), '--title', title, '--body-file', '-'],
          body,
        )
        if (!draft && existing.isDraft) await gh(['pr', 'ready', String(existing.number)])
        // A parked ticket's PR that was ready, as after CI failed twice: no auto-merge for it.
        if (draft && !existing.isDraft) {
          // It fails when no auto-merge is queued, which is what's wanted anyway.
          await gh(['pr', 'merge', String(existing.number), '--disable-auto']).catch(() => '')
          await gh(['pr', 'ready', String(existing.number), '--undo'])
        }
        return { number: existing.number, url: existing.url }
      }
      const url = await gh(
        [
          'pr',
          'create',
          '--head',
          branch,
          '--base',
          'main',
          '--title',
          title,
          '--body-file',
          '-',
          ...(draft ? ['--draft'] : []),
        ],
        body,
      )
      const number = Number(/\/pull\/(\d+)/.exec(url)?.[1])
      if (!number) throw new Error(`gh pr create printed no PR URL: ${url}`)
      return { number, url }
    },

    async commentOnPr(pr, body) {
      await gh(['pr', 'comment', String(pr), '--body-file', '-'], body)
    },

    async queueAutoMerge(pr) {
      await gh(['pr', 'merge', String(pr), '--auto', '--merge', '--delete-branch'])
    },

    // Only what the Implementer reads, so it isn't tested: a wrong line here costs a fix round its
    // log, never a wrong merge or park.
    async failedCheckLogs(pr) {
      // Check runs (Actions) carry `name`, `conclusion` and `detailsUrl`; status contexts carry
      // `context`, `state` and `targetUrl`.
      const { statusCheckRollup } = JSON.parse(
        await gh(['pr', 'view', String(pr), '--json', 'statusCheckRollup']),
      ) as {
        statusCheckRollup: {
          name?: string
          context?: string
          conclusion?: string
          state?: string
          detailsUrl?: string
          targetUrl?: string
        }[]
      }
      const failed = statusCheckRollup
        .map((check) => ({
          name: check.name ?? check.context ?? 'a check',
          result: check.conclusion ?? check.state ?? '',
          url: check.detailsUrl ?? check.targetUrl ?? '',
        }))
        .filter(({ result }) =>
          ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'STARTUP_FAILURE'].includes(result),
        )
      const logs: string[] = []
      for (const { name, result, url } of failed) {
        logs.push(`## ${name}: ${result.toLowerCase()} (${url})`)
        const job = /\/actions\/runs\/\d+\/job\/(\d+)/.exec(url)?.[1]
        // Reading a job's log needs the App's Actions: read permission; without it, the link alone.
        logs.push(
          job
            ? await gh(['run', 'view', '--job', job, '--log-failed']).catch(
                () => "(GitHub didn't give the log: open the link)",
              )
            : '(no job log: open the link)',
        )
      }
      return logs.join('\n')
    },

    async waitForChecks(pr) {
      const env = await ghEnv()
      return await new Promise<number>((resolve, reject) => {
        const child = spawn(join(repoDir, 'scripts', 'wait-for-checks.sh'), [String(pr)], {
          cwd: tmpdir(),
          env,
          stdio: 'inherit',
        })
        child.on('error', reject)
        // Killed by a signal: not a result to wait again on.
        child.on('exit', (code) => resolve(code ?? 1))
      })
    },

    async pushFiles(branch, files) {
      // A throwaway bare repo, so nothing touches the checkout or its git folder. The new commit
      // goes on top of the branch as GitHub has it; another Run pushing first means a retry.
      const author = await botIdentity()
      const dir = mkdtempSync(join(tmpdir(), 'factory-files-'))
      const index = join(dir, 'files.index')
      const git = (args: string[], env: Record<string, string> = {}) =>
        hostGit(dir, args, { protocols: 'https', env }).trim()
      try {
        git(['init', '--bare', '--quiet'])
        for (let attempt = 1; ; attempt += 1) {
          const auth = await pushEnv()
          // No such branch yet: this commit starts it. A failed ls-remote throws, as it should.
          const exists = git(['ls-remote', '--heads', remote, `refs/heads/${branch}`], auth) !== ''
          let parent: string | undefined
          if (exists) {
            git(
              [
                'fetch',
                '--quiet',
                '--depth=1',
                remote,
                `+refs/heads/${branch}:refs/heads/${branch}`,
              ],
              auth,
            )
            parent = git(['rev-parse', `refs/heads/${branch}`])
          }
          rmSync(index, { force: true })
          const withIndex = { GIT_INDEX_FILE: index }
          if (parent) git(['read-tree', parent], withIndex)
          for (const { path, from } of files) {
            const blob = git(['hash-object', '-w', '--', from])
            git(['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`], withIndex)
          }
          const tree = git(['write-tree'], withIndex)
          const commit = git(
            [
              'commit-tree',
              tree,
              ...(parent ? ['-p', parent] : []),
              '-m',
              `Add ${files.length} files`,
            ],
            {
              GIT_AUTHOR_NAME: author.name,
              GIT_AUTHOR_EMAIL: author.email,
              GIT_COMMITTER_NAME: author.name,
              GIT_COMMITTER_EMAIL: author.email,
            },
          )
          try {
            git(['push', '--quiet', '--no-verify', remote, `${commit}:refs/heads/${branch}`], auth)
            break
          } catch (error) {
            if (attempt === 3) throw error
          }
        }
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
      const encoded = (path: string) => path.split('/').map(encodeURIComponent).join('/')
      return files.map(
        ({ path }) => `https://raw.githubusercontent.com/${repo}/${branch}/${encoded(path)}`,
      )
    },
  }
}

/** owner/name from a GitHub remote URL, over SSH or HTTPS. */
function repoOf(remote: string): string {
  const match = /github\.com[:/](.+?)(?:\.git)?\s*$/.exec(remote)
  if (!match?.[1]) throw new Error(`origin isn't a GitHub remote: ${remote.trim()}`)
  return match[1]
}

/** A 9-minute JWT signed with the App's private key, for the App's own endpoints. */
function appJwt(app: GitHubApp): string {
  const now = Math.floor(Date.now() / 1000)
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  // Backdated a minute for clock drift, as GitHub's docs advise.
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: now - 60, exp: now + 540, iss: app.appId })}`
  const signature = createSign('RSA-SHA256')
    .update(unsigned)
    .sign(readFileSync(app.keyPath), 'base64url')
  return `${unsigned}.${signature}`
}

/** A new installation token, which GitHub gives for an hour, with its expiry. */
export async function mintInstallationToken(app: GitHubApp): Promise<InstallationToken> {
  const { token, expires_at } = await githubApi<{ token: string; expires_at: string }>(
    `/app/installations/${app.installationId}/access_tokens`,
    `Bearer ${appJwt(app)}`,
    'POST',
  )
  return { token, expiresAt: new Date(expires_at) }
}

async function githubApi<T>(path: string, authorization?: string, method = 'GET'): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(authorization ? { Authorization: authorization } : {}),
    },
  })
  if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${method} ${path}.`)
  return (await response.json()) as T
}

// The real Forge: GitHub as the `myvgc-factory` App (Give factory agents their own GitHub identity,
// DEV-256). It mints an installation token from the App's key when the Run starts (botIdentity),
// and passes it to `gh` as GH_TOKEN and to `git push` in an HTTP header, never on a command line.
//
// Sandcastle mounts the repo's git folder into each sandbox, so an agent can write the repo's git
// config and hooks. Nothing here trusts them: the repo is read once, when the Forge is made, before
// any agent runs; `gh` and wait-for-checks.sh run outside the checkout with GH_REPO; and `git push`
// runs with hooks, fsmonitor and credential helpers turned off, its header only for github.com.
//
// Thin on purpose, and not unit-tested: the pilot's first Run proves it (DEV-269).
import { execFile, execFileSync, spawn } from 'node:child_process'
import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Forge, GitHubApp } from './ports.ts'

const run = promisify(execFile)
const API = 'https://api.github.com'

export function githubForge(app: GitHubApp, repoDir: string): Forge {
  let token: Promise<string> | undefined
  const installationToken = () => (token ??= mintInstallationToken(app))
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

  return {
    async botIdentity() {
      await installationToken()
      const { slug } = await githubApi<{ slug: string }>('/app', `Bearer ${appJwt(app)}`)
      const name = `${slug}[bot]`
      const { id } = await githubApi<{ id: number }>(`/users/${encodeURIComponent(name)}`)
      return { name, email: `${id}+${name}@users.noreply.github.com` }
    },

    async push(cwd, branch) {
      // The user name in the URL keeps the host's global `insteadOf` rewrite to SSH from matching
      // (the spike, DEV-251), and the token goes in a header set through the environment.
      const header = Buffer.from(`x-access-token:${await installationToken()}`).toString('base64')
      const untrusted = [
        ['core.hooksPath', '/dev/null'],
        ['core.fsmonitor', 'false'],
        ['credential.helper', ''],
        ['core.sshCommand', 'ssh'],
        ['http.https://github.com/.extraHeader', `Authorization: Basic ${header}`],
      ]
      try {
        await run(
          'git',
          [
            'push',
            '--no-verify',
            `https://x-access-token@github.com/${repo}.git`,
            `HEAD:refs/heads/${branch}`,
          ],
          {
            cwd,
            env: {
              ...process.env,
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
            },
          },
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

async function mintInstallationToken(app: GitHubApp): Promise<string> {
  const { token } = await githubApi<{ token: string }>(
    `/app/installations/${app.installationId}/access_tokens`,
    `Bearer ${appJwt(app)}`,
    'POST',
  )
  return token
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

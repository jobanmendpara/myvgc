// The real Forge: GitHub as the `myvgc-factory` App (Give factory agents their own GitHub identity,
// DEV-256). It mints an installation token from the App's key when the Run first needs one, and
// passes it to `gh` as GH_TOKEN and to `git push` in an HTTP header, never on a command line.
// Thin on purpose, and not unit-tested: the pilot's first Run proves it (DEV-269).
import { execFile, spawn } from 'node:child_process'
import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { GitHubApp } from './factory.ts'
import type { Forge } from './ports.ts'

const run = promisify(execFile)
const API = 'https://api.github.com'

export function githubForge(app: GitHubApp, repoDir: string): Forge {
  let token: Promise<string> | undefined
  const installationToken = () => (token ??= mintInstallationToken(app))
  const repo = async () =>
    repoOf((await run('git', ['remote', 'get-url', 'origin'], { cwd: repoDir })).stdout)
  const gh = async (args: string[], stdin?: string) => {
    const env = { ...process.env, GH_TOKEN: await installationToken() }
    const child = run('gh', [...args, '--repo', await repo()], { cwd: repoDir, env })
    if (stdin !== undefined) {
      child.child.stdin?.end(stdin)
    }
    return (await child).stdout.trim()
  }

  return {
    async botIdentity() {
      const { slug } = await githubApi<{ slug: string }>('/app', `Bearer ${appJwt(app)}`)
      const name = `${slug}[bot]`
      const { id } = await githubApi<{ id: number }>(`/users/${encodeURIComponent(name)}`)
      return { name, email: `${id}+${name}@users.noreply.github.com` }
    },

    async push(cwd, branch) {
      // The user name in the URL keeps the host's global `insteadOf` rewrite to SSH from matching
      // (the spike, DEV-251), and the token goes in a header set through the environment.
      const header = Buffer.from(`x-access-token:${await installationToken()}`).toString('base64')
      await run(
        'git',
        [
          'push',
          `https://x-access-token@github.com/${await repo()}.git`,
          `HEAD:refs/heads/${branch}`,
        ],
        {
          cwd,
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
            GIT_CONFIG_COUNT: '1',
            GIT_CONFIG_KEY_0: 'http.extraHeader',
            GIT_CONFIG_VALUE_0: `Authorization: Basic ${header}`,
          },
        },
      )
    },

    async openPr({ branch, title, body }) {
      const url = await gh(
        ['pr', 'create', '--head', branch, '--base', 'main', '--title', title, '--body-file', '-'],
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
      const env = { ...process.env, GH_TOKEN: await installationToken() }
      return await new Promise<number>((resolve, reject) => {
        const child = spawn(join(repoDir, 'scripts', 'wait-for-checks.sh'), [String(pr)], {
          cwd: repoDir,
          env,
          stdio: 'inherit',
        })
        child.on('error', reject)
        child.on('exit', (code) => resolve(code ?? 3))
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

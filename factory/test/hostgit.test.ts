// Tests where a ticket's branch continues from (src/hostgit.ts) against real git: a bare "remote"
// and a clone in temporary folders, reached over the file protocol.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { checkBranchName, continueFrom } from '../src/hostgit.ts'

const BRANCH = 'jobanmendpara/dev-2-the-refusals'
const folders: string[] = []
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    env: { ...process.env, GIT_ALLOW_PROTOCOL: 'file' },
  }).trim()

function commit(cwd: string, name: string) {
  writeFileSync(join(cwd, name), name)
  git(cwd, 'add', name)
  git(cwd, 'commit', '-qm', name)
}

/** A bare remote, a clone with one commit on main, and a second clone standing for the maintainer. */
function repos() {
  const root = mkdtempSync(join(tmpdir(), 'hostgit-'))
  folders.push(root)
  const remote = join(root, 'remote.git')
  const repo = join(root, 'repo')
  const maintainer = join(root, 'maintainer')
  git(root, 'init', '-q', '--bare', '-b', 'main', remote)
  git(root, 'clone', '-q', remote, repo)
  commit(repo, 'main.txt')
  git(repo, 'push', '-q', 'origin', 'HEAD:main')
  git(root, 'clone', '-q', remote, maintainer)
  return { root, repo, maintainer }
}

const head = (cwd: string, ref: string) => git(cwd, 'rev-parse', ref)
const from = (repo: string) => continueFrom(repo, 'origin', BRANCH, 'file')

describe('continueFrom', () => {
  test('leaves a branch never pushed to fork the base', () => {
    const { repo } = repos()
    expect(from(repo)).toBeUndefined()
  })

  test('continues from the pushed branch when there is no local one', () => {
    const { repo, maintainer } = repos()
    git(maintainer, 'switch', '-qc', BRANCH)
    commit(maintainer, 'work.txt')
    git(maintainer, 'push', '-q', 'origin', BRANCH)
    expect(from(repo)).toBe(`origin/${BRANCH}`)
  })

  test("moves a local branch up to the pushed one, with the maintainer's commits", () => {
    const { repo, maintainer } = repos()
    git(repo, 'switch', '-qc', BRANCH)
    commit(repo, 'factory.txt')
    git(repo, 'push', '-q', 'origin', BRANCH)
    git(repo, 'switch', '-q', 'main')
    git(maintainer, 'fetch', '-q', 'origin')
    git(maintainer, 'switch', '-q', BRANCH)
    commit(maintainer, 'maintainer.txt')
    git(maintainer, 'push', '-q', 'origin', BRANCH)
    expect(from(repo)).toBeUndefined()
    expect(head(repo, BRANCH)).toBe(head(maintainer, 'HEAD'))
  })

  test('keeps a local branch with commits the pushed one lacks', () => {
    const { repo } = repos()
    git(repo, 'switch', '-qc', BRANCH)
    commit(repo, 'pushed.txt')
    git(repo, 'push', '-q', 'origin', BRANCH)
    commit(repo, 'refused.txt')
    const local = head(repo, BRANCH)
    git(repo, 'switch', '-q', 'main')
    expect(from(repo)).toBeUndefined()
    expect(head(repo, BRANCH)).toBe(local)
  })

  test('refuses branches that have diverged', () => {
    const { repo, maintainer } = repos()
    git(repo, 'switch', '-qc', BRANCH)
    commit(repo, 'factory.txt')
    git(repo, 'push', '-q', 'origin', BRANCH)
    commit(repo, 'local-only.txt')
    git(repo, 'switch', '-q', 'main')
    git(maintainer, 'fetch', '-q', 'origin')
    git(maintainer, 'switch', '-q', BRANCH)
    commit(maintainer, 'maintainer.txt')
    git(maintainer, 'push', '-q', 'origin', BRANCH)
    expect(() => from(repo)).toThrow(/diverged/)
  })

  test('refuses to move a branch checked out in a kept worktree', () => {
    const { root, repo, maintainer } = repos()
    git(repo, 'switch', '-qc', BRANCH)
    commit(repo, 'factory.txt')
    git(repo, 'push', '-q', 'origin', BRANCH)
    git(repo, 'switch', '-q', 'main')
    git(repo, 'worktree', 'add', '-q', join(root, 'kept'), BRANCH)
    git(maintainer, 'fetch', '-q', 'origin')
    git(maintainer, 'switch', '-q', BRANCH)
    commit(maintainer, 'maintainer.txt')
    git(maintainer, 'push', '-q', 'origin', BRANCH)
    expect(() => from(repo)).toThrow(/checked out in/)
  })
})

describe('checkBranchName', () => {
  test.each(['--upload-pack=touch /tmp/x', '-x', 'a..b', 'with space'])('refuses %j', (branch) => {
    expect(() => checkBranchName(branch)).toThrow(/isn't a usable git branch/)
  })

  test('accepts a Linear branch name', () => {
    expect(() => checkBranchName(BRANCH)).not.toThrow()
  })
})

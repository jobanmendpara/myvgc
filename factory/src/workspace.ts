// The pnpm workspace's packages and which depend on which, for the Implementer's prompt: a change
// to one package must be tested in every package that depends on it (the spike, DEV-251, lesson 2).
import { existsSync, globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

interface Package {
  name: string
  dependsOn: string[]
}

/** The workspace's packages, read from pnpm-workspace.yaml's `packages:` globs. */
export function workspacePackages(repoDir: string): Package[] {
  const workspaceFile = join(repoDir, 'pnpm-workspace.yaml')
  if (!existsSync(workspaceFile)) return []
  const globs = [...readFileSync(workspaceFile, 'utf8').matchAll(/^ {2}- (.+)$/gm)].map(
    ([, glob]) => glob?.trim() ?? '',
  )
  const manifests = globs.flatMap((glob) => globSync(`${glob}/package.json`, { cwd: repoDir }))
  const packages = manifests.sort().map((manifest) => {
    const json = JSON.parse(readFileSync(join(repoDir, manifest), 'utf8')) as {
      name: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    return { name: json.name, deps: { ...json.dependencies, ...json.devDependencies } }
  })
  const names = new Set(packages.map((pkg) => pkg.name))
  return packages.map(({ name, deps }) => ({
    name,
    dependsOn: Object.keys(deps).filter((dep) => names.has(dep)),
  }))
}

/** One line per package, such as "@myvgc/api depends on @myvgc/core". */
export function describeWorkspace(packages: Package[]): string {
  return packages
    .map(({ name, dependsOn }) =>
      dependsOn.length > 0 ? `- ${name} depends on ${dependsOn.join(', ')}` : `- ${name}`,
    )
    .join('\n')
}

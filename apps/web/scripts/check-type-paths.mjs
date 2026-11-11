// Fails when the type paths Nuxt generated point outside this repo.
//
// Nuxt resolves some packages for its tsconfig paths (vite/client, @vue/runtime-core, defu and
// others) by walking up from apps/web/node_modules. pnpm doesn't put them there, so a stray
// node_modules folder in a parent directory, such as ~/node_modules, wins and typecheck runs
// against its old Vue and Vite types. Local results then differ from CI (DEV-99).
import { readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoDir = resolve(webDir, '../..')
const buildDir = resolve(webDir, '.nuxt')

const escaped = new Set()
for (const name of ['app', 'server', 'shared', 'node']) {
  const file = resolve(buildDir, `tsconfig.${name}.json`)
  const paths = JSON.parse(readFileSync(file, 'utf8')).compilerOptions?.paths ?? {}
  for (const targets of Object.values(paths)) {
    for (const target of targets) {
      const absolute = resolve(buildDir, target)
      if (relative(repoDir, absolute).startsWith('..')) escaped.add(absolute)
    }
  }
}

if (escaped.size > 0) {
  const strays = new Set([...escaped].map((path) => path.split(`${sep}node_modules${sep}`)[0]))
  console.error(
    'Nuxt resolved these types from outside the repo, so typecheck would differ from CI:',
  )
  for (const path of escaped) console.error(`  ${path}`)
  for (const stray of strays) {
    console.error(`Move ${join(stray, 'node_modules')} out of the way, then rerun.`)
  }
  process.exit(1)
}

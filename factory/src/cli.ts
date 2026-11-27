// `pnpm factory`: runs factory() with the real ports. The maintainer's config lives in
// ~/.config/myvgc-factory (DEV-271, DEV-272); the checkout is the one this file is in.
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { factory } from './factory.ts'
import { githubForge } from './github.ts'
import { linearTracker } from './linear.ts'
import { sandcastleSandboxes } from './sandcastle.ts'

const repoDir = fileURLToPath(new URL('../..', import.meta.url))

process.exitCode = await factory(process.argv.slice(2), {
  repoDir,
  configDir: join(homedir(), '.config', 'myvgc-factory'),
  tracker: linearTracker,
  forge: (app) => githubForge(app, repoDir),
  sandboxes: sandcastleSandboxes(repoDir),
  now: () => new Date(),
  print: (line) => console.log(line),
})

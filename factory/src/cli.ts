// `pnpm factory`: runs factory() with the real ports. The maintainer's config lives in
// ~/.config/myvgc-factory (DEV-271, DEV-272); the checkout is the one this file is in.
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { factory } from './factory.ts'
import { linearTracker } from './linear.ts'

process.exitCode = await factory(process.argv.slice(2), {
  repoDir: fileURLToPath(new URL('../..', import.meta.url)),
  configDir: join(homedir(), '.config', 'myvgc-factory'),
  tracker: linearTracker,
  print: (line) => console.log(line),
})

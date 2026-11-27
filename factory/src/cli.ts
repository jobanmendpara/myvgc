// `pnpm factory`: runs factory() with the real ports. The maintainer's config lives in
// ~/.config/myvgc-factory (DEV-271, DEV-272); the checkout is the one this file is in.
//
// It is also the wrapper of DEV-287: it keeps the Mac awake while it runs (`caffeinate -i`), and
// when the host process crashes it notifies where the Run was (crashNotification, src/notify.ts).
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { factory } from './factory.ts'
import { githubForge } from './github.ts'
import { linearTracker } from './linear.ts'
import { crashNotification, macNotifier } from './notify.ts'
import { sandcastleSandboxes } from './sandcastle.ts'

const repoDir = fileURLToPath(new URL('../..', import.meta.url))
/** EX_SOFTWARE: the factory itself failed. */
const CRASHED = 70

// No idle sleep until this process exits (`-w`). Off macOS there's no caffeinate, and that's fine.
spawn('caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore', detached: true })
  .on('error', () => {})
  .unref()

const crash = async (error: unknown) => {
  console.error(error)
  await macNotifier.notify(crashNotification(error))
  process.exit(CRASHED)
}
// A throw outside factory()'s own promise, such as in a stream's callback, crashes the host too.
process.on('uncaughtException', crash)
process.on('unhandledRejection', crash)

try {
  process.exitCode = await factory(process.argv.slice(2), {
    repoDir,
    configDir: join(homedir(), '.config', 'myvgc-factory'),
    tracker: linearTracker,
    forge: (app) => githubForge(app, repoDir),
    sandboxes: sandcastleSandboxes(repoDir),
    notifier: macNotifier,
    now: () => new Date(),
    print: (line) => console.log(line),
  })
} catch (error) {
  await crash(error)
}

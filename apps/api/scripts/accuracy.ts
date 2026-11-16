// `pnpm accuracy [--repeat n] [filter...]`: runs vitest.accuracy.config.ts (DEV-123). `--repeat`
// isn't a Vitest option, so it's taken here and handed to the cases as ACCURACY_REPEAT; anything
// else goes to Vitest as test file filters.
import { existsSync } from 'node:fs'
import { startVitest } from 'vitest/node'

// The config refuses to start without a key too; this says so without Vite's stack trace.
const env = new URL('../../../.env', import.meta.url)
if (existsSync(env)) process.loadEnvFile(env)
if (!process.env.ANTHROPIC_API_KEY?.trim()) {
  console.error(
    'pnpm accuracy runs the real model, so it needs ANTHROPIC_API_KEY (in .env or the environment).',
  )
  process.exit(1)
}

const args = process.argv.slice(2)
const at = args.indexOf('--repeat')
if (at !== -1) {
  const repeat = Number(args[at + 1])
  if (!Number.isInteger(repeat) || repeat < 1) {
    console.error('--repeat takes a whole number of runs, such as --repeat 3.')
    process.exit(1)
  }
  process.env.ACCURACY_REPEAT = String(repeat)
  args.splice(at, 2)
}

const vitest = await startVitest('test', args, {
  config: 'vitest.accuracy.config.ts',
  run: true,
  watch: false,
})
await vitest.close()

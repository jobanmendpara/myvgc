import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// `pnpm accuracy` (ADR 24, DEV-123): runs the real image reader on the committed fixture
// screenshots. It costs money and needs a key, so it's never part of `pnpm test` or CI.
const env = fileURLToPath(new URL('../../.env', import.meta.url))
if (existsSync(env)) process.loadEnvFile(env)
if (!process.env.ANTHROPIC_API_KEY?.trim())
  throw new Error(
    'pnpm accuracy runs the real model, so it needs ANTHROPIC_API_KEY (in .env or the environment).',
  )

export default defineConfig({
  test: {
    include: ['test/**/*.accuracy.ts'],
    // One read of eight images takes about 10 s; leave room for a slow one.
    testTimeout: 180_000,
    hookTimeout: 30_000,
  },
})

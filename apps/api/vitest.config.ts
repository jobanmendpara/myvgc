import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // PGlite boots a WebAssembly Postgres, which takes a few seconds on a cold start.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})

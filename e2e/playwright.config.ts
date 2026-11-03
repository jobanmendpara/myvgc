import { defineConfig, devices } from '@playwright/test'

// Runs against an app that is already running, normally the built image started with
// Compose (see .github/workflows/smoke.yml). Set BASE_URL to point somewhere else.
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'phone',
      // Phone first: the smoke test runs at 375 px wide in Chromium.
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 800 } },
    },
  ],
})

import { test as base } from '@playwright/test'

export { expect } from '@playwright/test'

// Tests started so far in this worker process.
let started = 0

/**
 * Each test as a client of its own. Every test runs from this one machine, and the app limits
 * sign-ups and log-ins per client (DEV-72), so together they would trip the limit. A forwarded
 * address, as a reverse proxy sends, from 198.18.0.0/15 (set aside for testing), tells them apart.
 */
export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use, testInfo) => {
    started++
    await use({
      ...extraHTTPHeaders,
      'x-forwarded-for': `198.18.${testInfo.workerIndex % 256}.${started % 256}`,
    })
  },
})

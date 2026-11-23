// The API for `pnpm preview` (DEV-184): the app on a throwaway in-process Postgres (PGlite) with the
// migrations applied, and uploads kept in memory. It never reads .env or DATABASE_URL, so it can't
// touch the dev database; everything is gone when it stops. scripts/preview.ts starts it with PORT
// and APP_URL set.
import { randomBytes } from 'node:crypto'
import { serve } from '@hono/node-server'
import { createApp } from '../src/app'
import { memoryStorage } from '../src/storage'
import { createTestDb } from '../test/db'

const port = Number(process.env.PORT)
const appUrl = process.env.APP_URL
if (!Number.isInteger(port) || !appUrl) {
  console.error('preview-server needs PORT and APP_URL; start it with `pnpm preview`.')
  process.exit(1)
}

const { db, client } = await createTestDb()
const app = createApp({
  db,
  storage: memoryStorage(),
  auth: {
    secret: randomBytes(32).toString('base64'),
    appUrl,
    allowSignups: true,
    // Screenshots log in again on every run.
    rateLimit: false,
  },
})

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Preview API listening on http://localhost:${info.port}`)
})

function shutdown() {
  server.close(() => {
    void client.close().then(() => process.exit(0))
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadConfig } from './config'
import { connectPostgres, migratePostgres } from './db/client'
import { openDiskStorage } from './storage'

// Paths are relative to this file, which sits one folder below apps/api both as
// source (src/server.ts) and when bundled (dist/server.js).
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))
const webDir = fileURLToPath(new URL('../../web/.output/public', import.meta.url))

const config = (() => {
  try {
    return loadConfig()
  } catch (error) {
    // A readable message for self-hosters, not a stack trace.
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
})()

const storage = await openDiskStorage(config.UPLOADS_DIR).catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})

await migratePostgres(config.DATABASE_URL, migrationsFolder)
console.log('Database migrations applied.')

const { db, close } = connectPostgres(config.DATABASE_URL)
const app = createApp({
  db,
  storage,
  webDir,
  auth: {
    secret: config.BETTER_AUTH_SECRET,
    appUrl: config.APP_URL,
    allowSignups: config.ALLOW_SIGNUPS,
  },
})

const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`MyVGC listening on http://localhost:${info.port}`)
})

function shutdown() {
  server.close(() => {
    void close().then(() => process.exit(0))
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

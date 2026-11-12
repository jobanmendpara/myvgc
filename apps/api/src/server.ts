import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadConfig } from './config'
import { connectPostgres, migratePostgres } from './db/client'
import { openStorage } from './storage'
import { anthropicTeamReader } from './team-reader'

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

// Disk unless S3_BUCKET is set (ADR 27).
const storage = await openStorage(config).catch((error: Error) => {
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
  // Off unless an operator sets a key (ADR 2, ADR 24).
  imageReading: config.ANTHROPIC_API_KEY
    ? {
        reader: anthropicTeamReader({
          apiKey: config.ANTHROPIC_API_KEY,
          model: config.TEAM_READER_MODEL,
        }),
        dailyLimit: config.TEAM_READER_DAILY_LIMIT,
      }
    : undefined,
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

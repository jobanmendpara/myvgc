import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadConfig } from './config'
import { connectPostgres, migratePostgres } from './db/client'

// Paths are relative to this file, which sits one folder below apps/api both as
// source (src/server.ts) and when bundled (dist/server.js).
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))
const webDir = fileURLToPath(new URL('../../web/.output/public', import.meta.url))

const config = loadConfig()

await migratePostgres(config.DATABASE_URL, migrationsFolder)
console.log('Database migrations applied.')

const { db, close } = connectPostgres(config.DATABASE_URL)
const app = createApp({ db, webDir })

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

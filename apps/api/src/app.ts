import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Database } from './db/types'
import { mountWeb } from './static'

export interface AppOptions {
  db: Database
  /** Folder holding the generated web app. Leave out to serve only the API. */
  webDir?: string
}

export function createApp({ db, webDir }: AppOptions): Hono {
  const app = new Hono()

  app.get('/api/health', async (c) => {
    try {
      await db.execute(sql`select 1`)
      return c.json({ status: 'ok' })
    } catch (error) {
      console.error('Health check failed:', error)
      return c.json({ status: 'error' }, 503)
    }
  })

  app.notFound((c) =>
    c.req.path.startsWith('/api') ? c.json({ error: 'Not found' }, 404) : c.text('Not found', 404),
  )

  if (webDir) mountWeb(app, webDir)

  return app
}

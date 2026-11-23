import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import type { Env, Hono } from 'hono'

// Files a browser must ask the server about every time, so a new version reaches installed apps
// (ADR 17). The rest of the app shell has hashed names or is kept by the service worker.
const NEVER_STALE = new Set(['/sw.js', '/manifest.webmanifest'])

/**
 * Serves the generated Nuxt single-page app from `webDir`. Any GET outside `/api`
 * that doesn't match a file gets `index.html` with a 200, never a redirect, so client-side
 * routes survive a reload and the service worker's navigation fallback works on iOS.
 */
export function mountWeb<E extends Env>(app: Hono<E>, webDir: string): void {
  const indexPath = join(webDir, 'index.html')
  if (!existsSync(indexPath)) {
    console.warn(`Web app not found at ${webDir}; serving the API only.`)
    return
  }
  const indexHtml = readFileSync(indexPath, 'utf8')

  app.use('*', async (c, next) => {
    await next()
    if (NEVER_STALE.has(c.req.path)) c.header('Cache-Control', 'no-cache')
  })
  app.use('*', serveStatic({ root: webDir }))
  app.get('*', (c) => {
    if (c.req.path === '/api' || c.req.path.startsWith('/api/')) return c.notFound()
    return c.html(indexHtml)
  })
}

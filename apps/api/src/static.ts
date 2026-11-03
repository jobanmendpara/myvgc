import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import type { Hono } from 'hono'

/**
 * Serves the generated Nuxt single-page app from `webDir`. Any GET outside `/api`
 * that doesn't match a file gets `index.html`, so client-side routes survive a reload.
 */
export function mountWeb(app: Hono, webDir: string): void {
  const indexPath = join(webDir, 'index.html')
  if (!existsSync(indexPath)) {
    console.warn(`Web app not found at ${webDir}; serving the API only.`)
    return
  }
  const indexHtml = readFileSync(indexPath, 'utf8')

  app.use('*', serveStatic({ root: webDir }))
  app.get('*', (c) => {
    if (c.req.path === '/api' || c.req.path.startsWith('/api/')) return c.notFound()
    return c.html(indexHtml)
  })
}

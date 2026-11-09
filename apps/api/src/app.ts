import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { type AuthOptions, type SessionUser, createAuth, withClientAddress } from './auth'
import type { Database } from './db/types'
import { REGULATION_PERIODS, SEASONS, championsNames, currentRegulation, today } from '@myvgc/core'
import { accountRoutes } from './routes/account'
import { teamRoutes } from './routes/teams'
import { dashboardRoutes } from './routes/dashboard'
import { dataRoutes } from './routes/data'
import { noteEntryRoutes } from './routes/note-entries'
import { opponentRoutes } from './routes/opponents'
import { roundRoutes } from './routes/rounds'
import { teamsheetAttachmentRoutes } from './routes/teamsheet-attachment'
import { tournamentRoutes } from './routes/tournaments'
import { mountWeb } from './static'
import type { FileStorage } from './storage'

export interface AppOptions {
  db: Database
  auth: Omit<AuthOptions, 'db'>
  /** Where uploaded files are kept (ADR 27). */
  storage: FileStorage
  /** Folder holding the generated web app. Leave out to serve only the API. */
  webDir?: string
}

export type AppEnv = { Variables: { user: SessionUser } }

// Routes under /api that work without a session.
const PUBLIC_API = ['/api/health', '/api/auth']

export function createApp({ db, auth: authOptions, storage, webDir }: AppOptions): Hono<AppEnv> {
  const auth = createAuth({ db, ...authOptions })
  const app = new Hono<AppEnv>()

  app.get('/api/health', async (c) => {
    try {
      await db.execute(sql`select 1`)
      return c.json({ status: 'ok' })
    } catch (error) {
      console.error('Health check failed:', error)
      return c.json({ status: 'error' }, 503)
    }
  })

  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(withClientAddress(c)))

  // Everything else under /api needs a session. Unknown /api routes also answer 401 to
  // logged-out callers, so they can't probe which routes exist.
  app.use('/api/*', async (c, next) => {
    if (PUBLIC_API.some((path) => c.req.path === path || c.req.path.startsWith(`${path}/`))) {
      return next()
    }
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: 'Not logged in' }, 401)
    c.set('user', session.user)
    return next()
  })

  app.get('/api/me', (c) => {
    const { id, name, email, role } = c.get('user')
    return c.json({ id, name, email, role })
  })

  app.route('/api/account', accountRoutes(db))
  app.route('/api/teams', teamRoutes(db))
  app.route('/api/tournaments/:tournamentId/rounds', roundRoutes(db))
  app.route('/api/tournaments/:tournamentId/teamsheet', teamsheetAttachmentRoutes(db, storage))
  app.route('/api/tournaments', tournamentRoutes(db, storage))
  app.route('/api/opponents', opponentRoutes(db))
  app.route('/api/note-entries', noteEntryRoutes(db))
  app.route('/api/dashboard', dashboardRoutes(db))
  app.route('/api', dataRoutes(db))

  // Seasons and Regulation dates ship with the app (ADR 16). The web app reads them from here
  // so it never has to load `@myvgc/core`, and "today" is the server's day.
  app.get('/api/calendar', (c) => {
    const on = today()
    return c.json({
      today: on,
      currentRegulation: currentRegulation(on),
      regulations: REGULATION_PERIODS,
      seasons: SEASONS,
    })
  })

  // The names list for pickers (ADR 17). The web app caches it on the device, so pickers work
  // with no signal, and never loads Showdown's full data. Stored values stay Showdown IDs (ADR 14).
  app.get('/api/names', (c) => c.json(championsNames()))

  app.notFound((c) =>
    c.req.path.startsWith('/api') ? c.json({ error: 'Not found' }, 404) : c.text('Not found', 404),
  )

  if (webDir) mountWeb(app, webDir)

  return app
}

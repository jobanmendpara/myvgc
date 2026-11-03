import type { PGlite } from '@electric-sql/pglite'
import type { Hono } from 'hono'
import { type AppEnv, createApp } from '../src/app'
import type { Database } from '../src/db/types'
import { createTestDb } from './db'

export const APP_URL = 'http://localhost:3000'

export interface TestApp {
  app: Hono<AppEnv>
  db: Database
  client: PGlite
}

/** The app on a fresh in-process Postgres with migrations applied. */
export async function createTestApp(
  options: { allowSignups?: boolean; webDir?: string } = {},
): Promise<TestApp> {
  const { db, client } = await createTestDb()
  const app = createApp({
    db,
    webDir: options.webDir,
    auth: {
      secret: 'test-secret-that-is-at-least-32-characters-long',
      appUrl: APP_URL,
      allowSignups: options.allowSignups ?? true,
    },
  })
  return { app, db, client }
}

/** Sends a JSON request the way the web app does, from the app's own origin. */
export function post(app: Hono<AppEnv>, path: string, body: unknown, cookie?: string) {
  return app.request(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: APP_URL,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

/** The cookie header to send back, built from a response's Set-Cookie headers. */
export function cookieFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

export async function signUp(app: Hono<AppEnv>, email: string, password = 'correct horse battery') {
  const res = await post(app, '/api/auth/sign-up/email', {
    email,
    password,
    name: email.split('@')[0],
  })
  return { res, cookie: cookieFrom(res) }
}

export async function me(app: Hono<AppEnv>, cookie: string) {
  return app.request('/api/me', { headers: { cookie } })
}

/** A response's JSON body, untyped, for reading fields in assertions. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function json(res: Response): Promise<any> {
  return res.json()
}

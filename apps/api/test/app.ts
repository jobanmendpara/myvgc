import type { PGlite } from '@electric-sql/pglite'
import type { Hono } from 'hono'
import { type AppEnv, createApp } from '../src/app'
import type { ImageReading } from '../src/routes/team-reading'
import type { Database } from '../src/db/types'
import { type FileStorage, memoryStorage } from '../src/storage'
import { createTestDb } from './db'

export const APP_URL = 'http://localhost:3000'

export interface TestApp {
  app: Hono<AppEnv>
  db: Database
  client: PGlite
  storage: FileStorage
}

/** The app on a fresh in-process Postgres with migrations applied. */
export async function createTestApp(
  options: {
    allowSignups?: boolean
    webDir?: string
    rateLimit?: boolean
    imageReading?: ImageReading
  } = {},
): Promise<TestApp> {
  const { db, client } = await createTestDb()
  const storage = memoryStorage()
  const app = createApp({
    db,
    storage,
    webDir: options.webDir,
    imageReading: options.imageReading,
    auth: {
      secret: 'test-secret-that-is-at-least-32-characters-long',
      appUrl: APP_URL,
      allowSignups: options.allowSignups ?? true,
      rateLimit: options.rateLimit,
    },
  })
  return { app, db, client, storage }
}

/** Sends a request the way the web app does, from the app's own origin, with an optional JSON body. */
export function send(
  app: Hono<AppEnv>,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  options: { body?: unknown; cookie?: string } = {},
) {
  return app.request(path, {
    method,
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      origin: APP_URL,
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
}

export const post = (app: Hono<AppEnv>, path: string, body: unknown, cookie?: string) =>
  send(app, 'POST', path, { body, cookie })
export const patch = (app: Hono<AppEnv>, path: string, body: unknown, cookie?: string) =>
  send(app, 'PATCH', path, { body, cookie })
export const put = (app: Hono<AppEnv>, path: string, body: unknown, cookie?: string) =>
  send(app, 'PUT', path, { body, cookie })
export const get = (app: Hono<AppEnv>, path: string, cookie?: string) =>
  send(app, 'GET', path, { cookie })
export const del = (app: Hono<AppEnv>, path: string, cookie?: string) =>
  send(app, 'DELETE', path, { cookie })

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

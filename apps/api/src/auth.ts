import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { getConnInfo } from '@hono/node-server/conninfo'
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { admin } from 'better-auth/plugins'
import { count } from 'drizzle-orm'
import type { Context } from 'hono'
import * as schema from './db/schema'
import type { Database } from './db/types'

export interface AuthOptions {
  db: Database
  secret: string
  /** The address people use to reach the app, such as http://localhost:3000. */
  appUrl: string
  /** When false, sign-up is refused, except for the very first account (ADR 5). */
  allowSignups: boolean
  /** Rate limiting is on in production; tests turn it on to check it. */
  rateLimit?: boolean
}

// Where the app tells Better Auth the address of the client's connection. A client can't set
// it: `withClientAddress` replaces whatever arrives under this name.
const CLIENT_ADDRESS_HEADER = 'x-myvgc-client-address'

/**
 * The request with the address of the connection it came on, so rate limiting can tell clients
 * apart when nothing in front of the app sets `X-Forwarded-For` (DEV-72). Without it, every
 * client shares one limit.
 */
export function withClientAddress(c: Context): Request {
  const headers = new Headers(c.req.raw.headers)
  headers.delete(CLIENT_ADDRESS_HEADER)
  const address = (() => {
    try {
      return getConnInfo(c).remote.address
    } catch {
      // Not served by Node, as when tests call the app directly.
      return undefined
    }
  })()
  if (address) headers.set(CLIENT_ADDRESS_HEADER, address)
  return new Request(c.req.raw, { headers })
}

export function createAuth({ db, secret, appUrl, allowSignups, rateLimit }: AuthOptions) {
  const hasUsers = async () => {
    const [row] = await db.select({ users: count() }).from(schema.user)
    return (row?.users ?? 0) > 0
  }

  return betterAuth({
    secret,
    baseURL: appUrl,
    basePath: '/api/auth',
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    // Email verification and password reset need SMTP, which is optional (ADR 7) and out of
    // this slice, so accounts are usable as soon as they're created.
    emailAndPassword: { enabled: true, autoSignIn: true },
    plugins: [admin()],
    rateLimit: { enabled: rateLimit },
    // A reverse proxy's `X-Forwarded-For` names the client; without one, the connection does.
    advanced: { ipAddress: { ipAddressHeaders: ['x-forwarded-for', CLIENT_ADDRESS_HEADER] } },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-up/email' && !allowSignups && (await hasUsers())) {
          throw new APIError('FORBIDDEN', { message: 'Sign-ups are turned off on this install.' })
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // The first account on an install becomes its admin (ADR 5). Two sign-ups at the
          // same instant on a brand-new install could both see an empty table; that window
          // is accepted for now.
          before: async (user) => ({
            data: { ...user, role: (await hasUsers()) ? 'user' : 'admin' },
          }),
        },
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
export type SessionUser = Auth['$Infer']['Session']['user']

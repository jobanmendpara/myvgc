import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { admin } from 'better-auth/plugins'
import { count } from 'drizzle-orm'
import * as schema from './db/schema'
import type { Database } from './db/types'

export interface AuthOptions {
  db: Database
  secret: string
  /** The address people use to reach the app, such as http://localhost:3000. */
  appUrl: string
  /** When false, sign-up is refused, except for the very first account (ADR 5). */
  allowSignups: boolean
}

export function createAuth({ db, secret, appUrl, allowSignups }: AuthOptions) {
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

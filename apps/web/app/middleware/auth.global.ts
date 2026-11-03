import { authClient } from '@/lib/auth-client'

// Pages a logged-out visitor may see. Everything else sends them to /login.
const PUBLIC_PAGES = new Set(['/login', '/signup'])

// How long to wait for the API before showing "Can't reach the server". Without a limit, an
// API that isn't running (for example in `pnpm dev`) leaves every page blank.
const SESSION_TIMEOUT_MS = 8_000

async function currentSession() {
  try {
    const { data, error } = await authClient.getSession({
      fetchOptions: { timeout: SESSION_TIMEOUT_MS },
    })
    // A logged-out visitor gets `data: null` with no error; an error means no answer.
    return error ? { reachable: false as const } : { reachable: true as const, session: data }
  } catch {
    return { reachable: false as const }
  }
}

export default defineNuxtRouteMiddleware(async (to) => {
  const result = await currentSession()
  if (!result.reachable) {
    return abortNavigation(
      createError({ statusCode: 503, statusMessage: "Can't reach the MyVGC server", fatal: true }),
    )
  }
  const isPublic = PUBLIC_PAGES.has(to.path)

  if (!result.session && !isPublic) {
    return navigateTo({ path: '/login', query: to.fullPath === '/' ? {} : { next: to.fullPath } })
  }
  if (result.session && isPublic) return navigateTo('/')
})

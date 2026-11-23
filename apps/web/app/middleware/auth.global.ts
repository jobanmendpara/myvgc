import { authClient } from '@/lib/auth-client'
import {
  forgetDevice,
  type LastKnownUser,
  lastKnownUser,
  persistCacheFor,
  saveLastKnownUser,
} from '@/lib/device-cache'
import { readSessionCheck, type SessionCheck, startAs } from '@/lib/session-check'

// Pages a logged-out visitor may see. Everything else sends them to /login.
const PUBLIC_PAGES = new Set(['/login', '/signup'])

// How long to wait for the API before treating it as unreachable. Without a limit, an API that
// isn't running (for example in `pnpm dev`) leaves every page blank.
const SESSION_TIMEOUT_MS = 8_000

async function checkSession(): Promise<SessionCheck> {
  try {
    return readSessionCheck(
      await authClient.getSession({ fetchOptions: { timeout: SESSION_TIMEOUT_MS } }),
    )
  } catch {
    return readSessionCheck(undefined)
  }
}

let askedToKeepStorage = false

/** Asks the browser not to evict the device's data, once per page load. */
function keepStorage() {
  if (askedToKeepStorage) return
  askedToKeepStorage = true
  navigator.storage?.persist?.().catch(() => {})
}

function sameUser(a: LastKnownUser | null, b: LastKnownUser) {
  return a?.id === b.id && a.email === b.email && a.name === b.name
}

export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  const queryClient = nuxtApp.$queryClient
  const currentUser = useCurrentUser()
  const isPublic = PUBLIC_PAGES.has(to.path)
  // Navigation helpers need the Nuxt app, which isn't found on its own after an `await` here.
  const inApp = <T>(fn: () => T) => nuxtApp.runWithContext(fn)

  /** Acts on the server's answer; returns where to go instead, if anywhere. */
  async function settle(check: SessionCheck) {
    const start = startAs(check, check.kind === 'unreachable' ? await lastKnownUser() : undefined)
    if (start.kind === 'unreachable') {
      return inApp(() =>
        abortNavigation(
          createError({
            statusCode: 503,
            statusMessage: "Can't reach the MyVGC server",
            fatal: true,
          }),
        ),
      )
    }
    if (start.kind === 'logged-out') {
      // Also how a deleted account's data leaves a device: its next answer is "logged out".
      currentUser.value = null
      await forgetDevice(queryClient)
      if (isPublic) return
      const query = to.fullPath === '/' ? {} : { next: to.fullPath }
      return inApp(() => navigateTo({ path: '/login', query }))
    }
    if (!start.offline && !sameUser(currentUser.value, start.user)) {
      await saveLastKnownUser(start.user)
    }
    currentUser.value = start.user
    await persistCacheFor(queryClient, start.user.id)
    keepStorage()
    if (isPublic) return inApp(() => navigateTo('/'))
  }

  // Once the app is open as a User, page changes don't wait for the server: with no connection
  // each would take until the timeout. The check still runs, and a "logged out" answer, or
  // another User signed in elsewhere, takes effect when it arrives.
  if (currentUser.value && !isPublic) {
    void checkSession().then(async (check) => {
      if (check.kind === 'unreachable') return
      if (check.kind === 'signed-in' && sameUser(currentUser.value, check.user)) return
      await settle(check)
    })
    return
  }

  return settle(await checkSession())
})

import { adminClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

// The API serves the web app, and Nuxt proxies /api in development, so auth is always
// on the page's own origin.
export const authClient = createAuthClient({
  baseURL: typeof window === 'undefined' ? undefined : window.location.origin,
  basePath: '/api/auth',
  plugins: [adminClient()],
})

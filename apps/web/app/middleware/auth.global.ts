import { authClient } from '@/lib/auth-client'

// Pages a logged-out visitor may see. Everything else sends them to /login.
const PUBLIC_PAGES = new Set(['/login', '/signup'])

export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session } = await authClient.getSession()
  const isPublic = PUBLIC_PAGES.has(to.path)

  if (!session && !isPublic) {
    return navigateTo({ path: '/login', query: to.fullPath === '/' ? {} : { next: to.fullPath } })
  }
  if (session && isPublic) return navigateTo('/')
})

import { checkForUpdates } from '@/lib/update-checks'

// Once the service worker is registered, look for a new version when the app becomes visible and
// every hour while it's open. UpdateBanner offers it; nothing reloads on its own (ADR 17).
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hooks.hook('service-worker:registered', ({ registration }) => {
    if (registration) checkForUpdates(registration)
  })
})

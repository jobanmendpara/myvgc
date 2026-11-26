import { OFFLINE_READY_KEY, watchOfflineReady } from '@/lib/offline-ready'
import { readStored, writeStored } from '@/lib/storage'

// On a device's first visit, says while the service worker downloads the app's files, then that
// the app is ready to use offline, once (DEV-246). `nuxt dev` registers no service worker, so it
// shows only in the built app.
export default defineNuxtPlugin((nuxtApp) => {
  if (!('serviceWorker' in navigator)) return
  // Read now, before a first visit's service worker takes the page over (`clientsClaim`).
  const controlled = !!navigator.serviceWorker.controller
  const notice = useOfflineReady()
  let timer: ReturnType<typeof setTimeout> | undefined

  nuxtApp.hooks.hook('service-worker:registered', ({ registration }) => {
    if (!registration) return
    watchOfflineReady(
      registration,
      {
        controlled,
        told: () => readStored(OFFLINE_READY_KEY) !== null,
        rememberTold: () => writeStored(OFFLINE_READY_KEY, new Date().toISOString()),
      },
      (next) => {
        clearTimeout(timer)
        notice.value = next
        if (next === 'ready') timer = setTimeout(() => (notice.value = 'none'), READY_SHOWN_FOR)
      },
    )
  })
})

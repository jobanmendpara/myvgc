/** What the offline notice shows: nothing, "Getting ready for offline…" or "Ready to use offline". */
export type OfflineReadyNotice = 'none' | 'busy' | 'ready'

/** Where the device keeps that it has been told, so it is told once (DEV-246). */
export const OFFLINE_READY_KEY = 'myvgc-offline-ready'

/** The parts of a service worker the notice follows. */
export interface WatchedWorker {
  readonly state: string
  addEventListener(type: 'statechange', listener: () => void): void
  removeEventListener(type: 'statechange', listener: () => void): void
}

/** The parts of a service worker registration the notice follows. */
export interface WatchedRegistration {
  readonly installing: WatchedWorker | null
  readonly waiting: WatchedWorker | null
  readonly active: WatchedWorker | null
  addEventListener(type: 'updatefound', listener: () => void): void
  removeEventListener(type: 'updatefound', listener: () => void): void
}

/** The parts of the device the notice reads, so tests can pass their own. */
export interface OfflineReadyEnvironment {
  /** Whether a service worker already controlled the page when it loaded. */
  readonly controlled: boolean
  /** Whether this device has already been told it is ready to use offline. */
  told(): boolean
  rememberTold(): void
}

/**
 * Tells the User, once per device, when the app is ready to use offline (DEV-246, ADR 17).
 *
 * On a device's first visit no service worker controls the page. While the service worker
 * downloads the app's files the notice is busy; once that version is activated, and so has taken
 * over the page (`clientsClaim`), it is ready and the device remembers it was told. A page that
 * reloads mid-download is still uncontrolled, so it is busy again until the download finishes, or
 * ready at once if it finished during the reload. A failed download (the worker becomes
 * redundant) takes the busy notice away and tells nothing. A page a service worker already
 * controlled is an existing install or an update, which stays quiet: the update banner covers
 * those.
 *
 * Returns a function that stops following the service worker.
 */
export function watchOfflineReady(
  registration: WatchedRegistration,
  env: OfflineReadyEnvironment,
  show: (notice: OfflineReadyNotice) => void,
): () => void {
  if (env.controlled) {
    if (!env.told()) env.rememberTold()
    return () => {}
  }
  if (env.told()) return () => {}

  let followed: WatchedWorker | null = null
  let finished = false
  let shownBusy = false
  const onStateChange = () => check()

  function follow(worker: WatchedWorker | null) {
    if (worker === followed) return
    followed?.removeEventListener('statechange', onStateChange)
    followed = worker
    followed?.addEventListener('statechange', onStateChange)
  }

  function check() {
    if (finished) return
    const worker = registration.installing ?? registration.waiting ?? registration.active
    follow(worker)
    if (!worker) return
    if (worker.state === 'activated') {
      finished = true
      stop()
      env.rememberTold()
      show('ready')
    } else if (worker.state === 'redundant') {
      follow(null)
      show('none')
    } else if (!shownBusy) {
      shownBusy = true
      show('busy')
    }
  }

  const onUpdateFound = () => {
    shownBusy = false
    check()
  }
  registration.addEventListener('updatefound', onUpdateFound)
  function stop() {
    registration.removeEventListener('updatefound', onUpdateFound)
    follow(null)
  }

  check()
  return () => {
    finished = true
    stop()
  }
}

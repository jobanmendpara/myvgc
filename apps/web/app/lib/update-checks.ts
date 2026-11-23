// How often the open app asks the server for a new version.
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/** The parts of a service worker registration the update checks use. */
export interface UpdatableRegistration {
  readonly installing: unknown
  update(): Promise<unknown>
}

/** The parts of the browser the update checks use, so tests can pass their own. */
export interface UpdateCheckEnvironment {
  visibilityState(): DocumentVisibilityState
  onVisibilityChange(listener: () => void): () => void
  isOnline(): boolean
  every(ms: number, callback: () => void): () => void
}

/**
 * Asks the browser to look for a new service worker whenever the app becomes visible and every
 * hour while it is visible. An installed iPhone app only checks by itself on a cold launch, not
 * when brought back from the background (ADR 17). A check never loads the new version: the
 * browser installs it and it waits until the User chooses to reload.
 *
 * Returns a function that stops the checks.
 */
export function checkForUpdates(
  registration: UpdatableRegistration,
  env: UpdateCheckEnvironment = browserEnvironment(),
): () => void {
  function check() {
    // A check while one is installing, or with no signal, has nothing to gain.
    if (registration.installing || !env.isOnline()) return
    // With no answer from the server, the next check tries again.
    registration.update().catch(() => {})
  }

  const stopListening = env.onVisibilityChange(() => {
    if (env.visibilityState() === 'visible') check()
  })
  const stopTimer = env.every(UPDATE_CHECK_INTERVAL_MS, () => {
    if (env.visibilityState() === 'visible') check()
  })
  return () => {
    stopListening()
    stopTimer()
  }
}

function browserEnvironment(): UpdateCheckEnvironment {
  return {
    visibilityState: () => document.visibilityState,
    onVisibilityChange(listener) {
      document.addEventListener('visibilitychange', listener)
      return () => document.removeEventListener('visibilitychange', listener)
    },
    isOnline: () => navigator.onLine,
    every(ms, callback) {
      const id = setInterval(callback, ms)
      return () => clearInterval(id)
    },
  }
}

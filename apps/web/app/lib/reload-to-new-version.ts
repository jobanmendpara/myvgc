// How long Reload waits for the new version to take over before reloading anyway.
export const RELOAD_TIMEOUT_MS = 3000

/** The parts of a waiting service worker that Reload watches. */
export interface WaitingWorker {
  readonly state: string
  addEventListener(type: 'statechange', listener: () => void): void
  removeEventListener(type: 'statechange', listener: () => void): void
}

/** The parts of the browser Reload uses, so tests can pass their own. */
export interface ReloadEnvironment {
  /** The new version waiting to take over, or null when none is waiting any more. */
  waitingWorker(): Promise<WaitingWorker | null>
  /** Asks the waiting version to take over. */
  skipWaiting(): Promise<unknown>
  onControllerChange(listener: () => void): () => void
  after(ms: number, callback: () => void): () => void
  reload(): void
}

/**
 * Loads the new version once the User has tapped Reload (ADR 17), and only then.
 *
 * Asks the waiting version to take over, then reloads the page as soon as that version is
 * activated or takes control of the page, whichever comes first. A page the service worker never
 * controlled gets no `controllerchange`, so activation alone is enough. With no version waiting
 * any more it reloads at once, and if neither event comes it reloads after a short wait, so Reload
 * always finishes.
 */
export async function reloadToNewVersion(env: ReloadEnvironment): Promise<void> {
  const worker = await env.waitingWorker().catch(() => null)
  if (!worker || worker.state === 'activated') {
    env.reload()
    return
  }

  let done = false
  const stops: (() => void)[] = []
  function reloadOnce() {
    if (done) return
    done = true
    for (const stop of stops) stop()
    env.reload()
  }

  const onStateChange = () => {
    if (worker.state === 'activated' || worker.state === 'redundant') reloadOnce()
  }
  worker.addEventListener('statechange', onStateChange)
  stops.push(() => worker.removeEventListener('statechange', onStateChange))
  stops.push(env.onControllerChange(reloadOnce))
  stops.push(env.after(RELOAD_TIMEOUT_MS, reloadOnce))

  // A failed request still ends in a reload when the wait runs out.
  await env.skipWaiting().catch(() => {})
}

/** The real browser, with `skipWaiting` asking through the PWA module. */
export function browserReloadEnvironment(skipWaiting: () => Promise<unknown>): ReloadEnvironment {
  return {
    async waitingWorker() {
      const registration = await navigator.serviceWorker?.getRegistration()
      return registration?.waiting ?? null
    },
    skipWaiting,
    onControllerChange(listener) {
      navigator.serviceWorker?.addEventListener('controllerchange', listener)
      return () => navigator.serviceWorker?.removeEventListener('controllerchange', listener)
    },
    after(ms, callback) {
      const id = setTimeout(callback, ms)
      return () => clearTimeout(id)
    },
    reload: () => window.location.reload(),
  }
}

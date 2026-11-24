import { describe, expect, it, vi } from 'vitest'
import {
  reloadToNewVersion,
  RELOAD_TIMEOUT_MS,
  type ReloadEnvironment,
  type WaitingWorker,
} from '../app/lib/reload-to-new-version'

/**
 * A browser with a waiting version. `controlled` says whether the service worker controls the
 * page: only then does taking over fire `controllerchange`.
 */
function setUp(options: { waiting?: boolean; controlled?: boolean; activates?: boolean } = {}) {
  const { waiting = true, controlled = true, activates = true } = options
  const stateListeners = new Set<() => void>()
  const worker: WaitingWorker & { state: string } = {
    state: 'installed',
    addEventListener: (_type, listener) => stateListeners.add(listener),
    removeEventListener: (_type, listener) => stateListeners.delete(listener),
  }
  const controllerListeners = new Set<() => void>()
  const timers = new Map<number, () => void>()
  const reload = vi.fn()

  function takeOver() {
    worker.state = 'activating'
    for (const listener of [...stateListeners]) listener()
    if (controlled) for (const listener of [...controllerListeners]) listener()
    worker.state = 'activated'
    for (const listener of [...stateListeners]) listener()
  }

  const env: ReloadEnvironment = {
    waitingWorker: () => Promise.resolve(waiting ? worker : null),
    skipWaiting: vi.fn(async () => {
      if (activates) takeOver()
    }),
    onControllerChange(listener) {
      controllerListeners.add(listener)
      return () => controllerListeners.delete(listener)
    },
    after(ms, callback) {
      timers.set(ms, callback)
      return () => timers.delete(ms)
    },
    reload,
  }
  return {
    env,
    reload,
    timeRunsOut: () => timers.get(RELOAD_TIMEOUT_MS)?.(),
    hasTimer: () => timers.has(RELOAD_TIMEOUT_MS),
  }
}

describe('reloading to the new version', () => {
  it('reloads once the new version takes control of the page', async () => {
    const browser = setUp({ controlled: true })
    await reloadToNewVersion(browser.env)
    expect(browser.env.skipWaiting).toHaveBeenCalledTimes(1)
    expect(browser.reload).toHaveBeenCalledTimes(1)
    expect(browser.hasTimer()).toBe(false)
  })

  it('reloads once the new version is activated, on a page with no service worker in control', async () => {
    const browser = setUp({ controlled: false })
    await reloadToNewVersion(browser.env)
    expect(browser.reload).toHaveBeenCalledTimes(1)
    expect(browser.hasTimer()).toBe(false)
  })

  it('reloads at once when no version is waiting any more', async () => {
    const browser = setUp({ waiting: false })
    await reloadToNewVersion(browser.env)
    expect(browser.env.skipWaiting).not.toHaveBeenCalled()
    expect(browser.reload).toHaveBeenCalledTimes(1)
  })

  it('reloads anyway when the new version never takes over', async () => {
    const browser = setUp({ activates: false })
    await reloadToNewVersion(browser.env)
    expect(browser.reload).not.toHaveBeenCalled()
    browser.timeRunsOut()
    expect(browser.reload).toHaveBeenCalledTimes(1)
  })

  it('reloads anyway when asking the new version to take over fails', async () => {
    const browser = setUp({ activates: false })
    vi.mocked(browser.env.skipWaiting).mockRejectedValueOnce(new Error('no registration'))
    await reloadToNewVersion(browser.env)
    browser.timeRunsOut()
    expect(browser.reload).toHaveBeenCalledTimes(1)
  })
})

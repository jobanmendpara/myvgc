import { describe, expect, it, vi } from 'vitest'
import {
  checkForUpdates,
  UPDATE_CHECK_INTERVAL_MS,
  type UpdatableRegistration,
  type UpdateCheckEnvironment,
} from '../app/lib/update-checks'

function setUp(options: { installing?: boolean; update?: () => Promise<unknown> } = {}) {
  const registration: UpdatableRegistration & { update: ReturnType<typeof vi.fn> } = {
    installing: options.installing ? {} : null,
    update: vi.fn(options.update ?? (() => Promise.resolve())),
  }
  let visibility: DocumentVisibilityState = 'visible'
  let online = true
  const listeners = new Set<() => void>()
  const timers = new Map<number, () => void>()
  const env: UpdateCheckEnvironment = {
    visibilityState: () => visibility,
    onVisibilityChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    isOnline: () => online,
    every(ms, callback) {
      timers.set(ms, callback)
      return () => timers.delete(ms)
    },
  }
  const stop = checkForUpdates(registration, env)
  return {
    registration,
    stop,
    setOnline: (value: boolean) => (online = value),
    becomes(state: DocumentVisibilityState) {
      visibility = state
      for (const listener of listeners) listener()
    },
    anHourPasses() {
      timers.get(UPDATE_CHECK_INTERVAL_MS)?.()
    },
  }
}

describe('checking for a new version', () => {
  it('checks when the app becomes visible', () => {
    const app = setUp()
    app.becomes('hidden')
    expect(app.registration.update).not.toHaveBeenCalled()
    app.becomes('visible')
    expect(app.registration.update).toHaveBeenCalledTimes(1)
  })

  it('checks every hour while the app is visible', () => {
    const app = setUp()
    app.anHourPasses()
    app.anHourPasses()
    expect(app.registration.update).toHaveBeenCalledTimes(2)
  })

  it('skips the hourly check while the app is hidden', () => {
    const app = setUp()
    app.becomes('hidden')
    app.anHourPasses()
    expect(app.registration.update).not.toHaveBeenCalled()
  })

  it('skips checks with no signal', () => {
    const app = setUp()
    app.setOnline(false)
    app.becomes('visible')
    app.anHourPasses()
    expect(app.registration.update).not.toHaveBeenCalled()
  })

  it('skips checks while a new version is installing', () => {
    const app = setUp({ installing: true })
    app.becomes('visible')
    expect(app.registration.update).not.toHaveBeenCalled()
  })

  it('shrugs off a check the server never answers', async () => {
    const app = setUp({ update: () => Promise.reject(new TypeError('Failed to fetch')) })
    app.becomes('visible')
    await Promise.resolve()
    expect(app.registration.update).toHaveBeenCalledTimes(1)
  })

  it('stops checking once stopped', () => {
    const app = setUp()
    app.stop()
    app.becomes('visible')
    app.anHourPasses()
    expect(app.registration.update).not.toHaveBeenCalled()
  })
})

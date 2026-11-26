import { describe, expect, it } from 'vitest'
import {
  type OfflineReadyNotice,
  watchOfflineReady,
  type WatchedRegistration,
  type WatchedWorker,
} from '../app/lib/offline-ready'

class FakeWorker implements WatchedWorker {
  private listeners = new Set<() => void>()
  constructor(public state: string) {}
  addEventListener(_type: 'statechange', listener: () => void) {
    this.listeners.add(listener)
  }
  removeEventListener(_type: 'statechange', listener: () => void) {
    this.listeners.delete(listener)
  }
  becomes(state: string) {
    this.state = state
    for (const listener of [...this.listeners]) listener()
  }
}

class FakeRegistration implements WatchedRegistration {
  installing: FakeWorker | null = null
  waiting: FakeWorker | null = null
  active: FakeWorker | null = null
  private listeners = new Set<() => void>()
  addEventListener(_type: 'updatefound', listener: () => void) {
    this.listeners.add(listener)
  }
  removeEventListener(_type: 'updatefound', listener: () => void) {
    this.listeners.delete(listener)
  }
  /** The browser starts downloading a version. */
  finds(worker: FakeWorker) {
    this.installing = worker
    for (const listener of [...this.listeners]) listener()
  }
}

function watch(
  registration: FakeRegistration,
  device: { controlled?: boolean; told?: boolean } = {},
) {
  const notices: OfflineReadyNotice[] = []
  const state = { told: device.told ?? false }
  const stop = watchOfflineReady(
    registration,
    {
      controlled: device.controlled ?? false,
      told: () => state.told,
      rememberTold: () => (state.told = true),
    },
    (notice) => notices.push(notice),
  )
  return { notices, state, stop }
}

describe('telling the User when the app is ready to use offline', () => {
  it('on a first visit, says it is getting ready while the files download, then that it is ready', () => {
    const registration = new FakeRegistration()
    const worker = new FakeWorker('installing')
    registration.installing = worker
    const device = watch(registration)
    expect(device.notices).toEqual(['busy'])

    worker.becomes('installed')
    worker.becomes('activating')
    expect(device.notices).toEqual(['busy'])
    worker.becomes('activated')
    expect(device.notices).toEqual(['busy', 'ready'])
    expect(device.state.told).toBe(true)
  })

  it('waits for the download to start when the service worker has only just registered', () => {
    const registration = new FakeRegistration()
    const device = watch(registration)
    expect(device.notices).toEqual([])

    const worker = new FakeWorker('installing')
    registration.finds(worker)
    expect(device.notices).toEqual(['busy'])
    worker.becomes('activated')
    expect(device.notices).toEqual(['busy', 'ready'])
  })

  it('says it is ready at once when the download finished while the page reloaded', () => {
    const registration = new FakeRegistration()
    registration.active = new FakeWorker('activated')
    const device = watch(registration)
    expect(device.notices).toEqual(['ready'])
    expect(device.state.told).toBe(true)
  })

  it('takes the busy notice away, without saying it is ready, when the download fails', () => {
    const registration = new FakeRegistration()
    const worker = new FakeWorker('installing')
    registration.installing = worker
    const device = watch(registration)

    worker.becomes('redundant')
    expect(device.notices).toEqual(['busy', 'none'])
    expect(device.state.told).toBe(false)
  })

  it('says nothing once the device has been told', () => {
    const registration = new FakeRegistration()
    registration.installing = new FakeWorker('installing')
    const device = watch(registration, { told: true })
    registration.installing.becomes('activated')
    expect(device.notices).toEqual([])
  })

  it('says nothing about an update, and remembers the device is ready', () => {
    const registration = new FakeRegistration()
    registration.active = new FakeWorker('activated')
    const device = watch(registration, { controlled: true })
    const update = new FakeWorker('installing')
    registration.finds(update)
    update.becomes('installed')
    expect(device.notices).toEqual([])
    expect(device.state.told).toBe(true)
  })

  it('stops listening when stopped', () => {
    const registration = new FakeRegistration()
    const worker = new FakeWorker('installing')
    registration.installing = worker
    const device = watch(registration)
    device.stop()
    worker.becomes('activated')
    expect(device.notices).toEqual(['busy'])
  })
})

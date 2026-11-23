import { QueryClient } from '@tanstack/vue-query'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CACHE_MAX_AGE,
  CACHE_VERSION,
  forgetDevice,
  lastKnownUser,
  persistCacheFor,
  saveLastKnownUser,
  stopPersisting,
} from '../app/lib/device-cache'
import {
  closeDeviceDatabase,
  DATABASE_NAME,
  DATABASE_VERSION,
  deviceStore,
} from '../app/lib/device-database'

const ash = { id: 'u1', email: 'ash@example.com', name: 'Ash' }
const misty = { id: 'u2', email: 'misty@example.com', name: 'Misty' }
const opponents = [{ id: 'o1', displayName: 'Wolfe Glick', aliases: ['Wolfey'] }]

/** A QueryClient as the app has it after a restart: new and empty. */
const freshClient = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })

/** Waits until the throttled save has written the cache to the device. */
async function saved() {
  await vi.advanceTimersByTimeAsync(1500)
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  await closeDeviceDatabase()
  vi.stubGlobal('indexedDB', new IDBFactory())
})

afterEach(async () => {
  stopPersisting()
  await closeDeviceDatabase()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('The last known User', () => {
  it('is kept on the device', async () => {
    expect(await lastKnownUser()).toBeUndefined()
    await saveLastKnownUser({ ...ash, extra: 'not kept' } as typeof ash)
    expect(await lastKnownUser()).toEqual(ash)
  })

  it('is removed with the rest of the device’s data', async () => {
    await saveLastKnownUser(ash)
    await forgetDevice(freshClient())
    expect(await lastKnownUser()).toBeUndefined()
  })

  it('reads as none when storage can’t be opened', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('blocked')
      },
    })
    expect(await lastKnownUser()).toBeUndefined()
    await expect(saveLastKnownUser(ash)).resolves.toBeUndefined()
  })
})

describe('The saved query cache', () => {
  it('survives a restart, so the cached Opponents list is there to search offline', async () => {
    const before = freshClient()
    await persistCacheFor(before, ash.id)
    before.setQueryData(['opponents', 'list'], opponents)
    await saved()
    stopPersisting()

    const after = freshClient()
    await persistCacheFor(after, ash.id)
    expect(after.getQueryData(['opponents', 'list'])).toEqual(opponents)
  })

  it('comes back stale, so pages show it at once but ask the server again', async () => {
    const before = freshClient()
    await persistCacheFor(before, ash.id)
    before.setQueryData(['opponents', 'list'], opponents)
    await saved()
    stopPersisting()

    // Restarted straight away, well inside any staleTime: the server may still have changed.
    const after = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, staleTime: 60_000 } },
    })
    await persistCacheFor(after, ash.id)
    expect(after.getQueryData(['opponents', 'list'])).toEqual(opponents)
    expect(
      after
        .getQueryCache()
        .find({ queryKey: ['opponents', 'list'] })
        ?.isStale(),
    ).toBe(true)
  })

  it('is kept per User, so one User never sees another’s data', async () => {
    const client = freshClient()
    await persistCacheFor(client, ash.id)
    client.setQueryData(['opponents', 'list'], opponents)
    await saved()

    await persistCacheFor(client, misty.id)
    expect(client.getQueryData(['opponents', 'list'])).toBeUndefined()
    stopPersisting()

    const ashAgain = freshClient()
    await persistCacheFor(ashAgain, ash.id)
    expect(ashAgain.getQueryData(['opponents', 'list'])).toEqual(opponents)
  })

  it('is thrown away when it was saved by another version of the app', async () => {
    await deviceStore('query-cache').set(ash.id, {
      buster: `${CACHE_VERSION}-old`,
      timestamp: Date.now(),
      clientState: {
        mutations: [],
        queries: [
          {
            queryKey: ['opponents', 'list'],
            queryHash: '["opponents","list"]',
            state: { data: opponents, dataUpdatedAt: Date.now(), status: 'success' },
          },
        ],
      },
    })
    const client = freshClient()
    await persistCacheFor(client, ash.id)
    expect(client.getQueryData(['opponents', 'list'])).toBeUndefined()
  })

  it('lasts more than a week without the app being opened, but not forever', async () => {
    expect(CACHE_MAX_AGE).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000)

    const before = freshClient()
    await persistCacheFor(before, ash.id)
    before.setQueryData(['opponents', 'list'], opponents)
    await saved()
    stopPersisting()

    vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000)
    const week = freshClient()
    await persistCacheFor(week, ash.id)
    expect(week.getQueryData(['opponents', 'list'])).toEqual(opponents)
    stopPersisting()

    vi.setSystemTime(Date.now() + CACHE_MAX_AGE + 1)
    const tooOld = freshClient()
    await persistCacheFor(tooOld, ash.id)
    expect(tooOld.getQueryData(['opponents', 'list'])).toBeUndefined()
  })

  it('leaves out the names list, which has its own copy on the device', async () => {
    const before = freshClient()
    await persistCacheFor(before, ash.id)
    before.setQueryData(['names'], { species: {} })
    before.setQueryData(['opponents', 'list'], opponents)
    await saved()
    stopPersisting()

    const after = freshClient()
    await persistCacheFor(after, ash.id)
    expect(after.getQueryData(['names'])).toBeUndefined()
  })

  it('is removed, and stays removed, when the device’s data is cleared', async () => {
    const client = freshClient()
    await persistCacheFor(client, ash.id)
    client.setQueryData(['opponents', 'list'], opponents)
    await saved()

    // A change still waiting to be saved must not bring the cache back.
    client.setQueryData(['opponents', 'list'], [...opponents, { id: 'o2' }])
    await forgetDevice(client)
    expect(client.getQueryData(['opponents', 'list'])).toBeUndefined()
    await saved()

    const after = freshClient()
    await persistCacheFor(after, ash.id)
    expect(after.getQueryData(['opponents', 'list'])).toBeUndefined()
  })
})

describe('The device database', () => {
  it('has a store per kind of data, so another can be added beside them later', async () => {
    await saveLastKnownUser(ash)
    await closeDeviceDatabase()
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    expect(db.version).toBe(DATABASE_VERSION)
    expect([...db.objectStoreNames].sort()).toEqual(['outbox', 'query-cache', 'user'])
    db.close()
  })

  it('adds a missing store on an upgrade and keeps what the others hold', async () => {
    await closeDeviceDatabase()
    // A device on the first version: only the query cache and the last known User.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore('query-cache')
        request.result.createObjectStore('user').put(ash, 'last')
      }
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
    expect(await lastKnownUser()).toEqual(ash)
    await deviceStore('outbox').set(['u1', 1, 'w1'], { id: 'w1' })
    expect(await deviceStore('outbox').getAll()).toEqual([{ id: 'w1' }])
  })

  it('never touches the outbox when the query cache is cleared', async () => {
    await deviceStore('outbox').set(['u1', 1, 'w1'], { id: 'w1' })
    await forgetDevice(freshClient())
    expect(await deviceStore('outbox').getAll()).toEqual([{ id: 'w1' }])
  })
})

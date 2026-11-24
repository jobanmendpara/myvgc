import {
  type PersistedClient,
  type Persister,
  persistQueryClient,
} from '@tanstack/query-persist-client-core'
import type { Query, QueryClient } from '@tanstack/vue-query'
import { deviceStore } from './device-database'

// What the app keeps on this device so it can open with no connection (ADR 17): the last known
// User and that User's query cache. Both are a copy of what the server holds, so clearing them
// loses nothing. Pending writes are not here: they belong to the outbox (DEV-48).

/**
 * The query cache's version. Bump it when the API's answers change shape, so a cache saved by an
 * older version of the app is thrown away rather than shown. It never touches the outbox.
 */
export const CACHE_VERSION = '1'

/** How long a saved query cache is kept without the app being opened. */
export const CACHE_MAX_AGE = 14 * 24 * 60 * 60 * 1000

/** How often, at most, the query cache is written to the device. */
const SAVE_INTERVAL = 1000

/** The User the app last saw signed in on this device. */
export interface LastKnownUser {
  id: string
  email: string
  name: string
}

const userStore = deviceStore<LastKnownUser>('user')
const cacheStore = deviceStore<PersistedClient>('query-cache')
const LAST_USER = 'last'

function isLastKnownUser(value: unknown): value is LastKnownUser {
  const user = value as LastKnownUser | undefined
  return (
    typeof user?.id === 'string' && typeof user.email === 'string' && typeof user.name === 'string'
  )
}

/** The User last signed in on this device, if any is saved and storage can be read. */
export async function lastKnownUser(): Promise<LastKnownUser | undefined> {
  try {
    const saved = await userStore.get(LAST_USER)
    return isLastKnownUser(saved) ? saved : undefined
  } catch {
    return undefined
  }
}

/** Saves the signed-in User, so the app can open as them without a connection. */
export async function saveLastKnownUser({ id, email, name }: LastKnownUser) {
  try {
    await userStore.set(LAST_USER, { id, email, name })
  } catch {
    // Storage can't be written: the app just can't open offline.
  }
}

/** Saves the query cache under the user id, at most once every {@link SAVE_INTERVAL}. */
function cachePersister(userId: string) {
  let pending: PersistedClient | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  const cancel = () => {
    clearTimeout(timer)
    timer = undefined
    pending = undefined
  }
  const persister: Persister = {
    persistClient(client) {
      pending = client
      timer ??= setTimeout(() => {
        const latest = pending
        timer = undefined
        pending = undefined
        if (latest) cacheStore.set(userId, latest).catch(() => {})
      }, SAVE_INTERVAL)
    },
    restoreClient: () => cacheStore.get(userId),
    removeClient: () => {
      cancel()
      return cacheStore.delete(userId)
    },
  }
  return { persister, cancel }
}

/**
 * Whether a query is saved on the device: any query that has data, even when its last fetch
 * failed (DEV-209). A failed refetch with no signal, or on venue Wi-Fi with no internet, must not
 * make the next save forget a list the app already has. The names list is left out: it has its
 * own copy on the device and is the same for every User.
 */
function shouldSaveQuery(query: Query): boolean {
  return query.state.data !== undefined && query.queryKey[0] !== 'names'
}

let persisting: { userId: string; stop: () => void; restored: Promise<void> } | undefined

/**
 * Restores `userId`'s saved query cache into `queryClient` and keeps saving it from then on.
 * Calling it again for the same User does nothing more; for another User, what is cached for the
 * first is dropped from memory first, so one User never sees another's data.
 */
export function persistCacheFor(queryClient: QueryClient, userId: string): Promise<void> {
  if (persisting?.userId === userId) return persisting.restored
  if (persisting) {
    stopPersisting()
    queryClient.clear()
  }
  const { persister, cancel } = cachePersister(userId)
  const [unsubscribe, restoring] = persistQueryClient({
    queryClient,
    persister,
    buster: CACHE_VERSION,
    maxAge: CACHE_MAX_AGE,
    dehydrateOptions: { shouldDehydrateQuery: shouldSaveQuery },
  })
  const restored = restoring.then(
    // What comes from the device is a copy that may be out of date, however recently it was
    // saved: pages show it at once and still ask the server, when it can be reached.
    () =>
      queryClient.invalidateQueries({
        predicate: (query) => shouldSaveQuery(query),
        refetchType: 'none',
      }),
    // A cache that can't be read is thrown away; the app then fetches as usual.
    () => {},
  )
  persisting = {
    userId,
    restored,
    stop: () => {
      unsubscribe()
      cancel()
    },
  }
  return restored
}

/** Stops saving the query cache. What is already saved stays. */
export function stopPersisting() {
  persisting?.stop()
  persisting = undefined
}

/**
 * Removes everything the app keeps on this device for any User: the last known User and every
 * saved query cache, and empties `queryClient`. Used on logging out, on the server answering
 * "logged out", and by Settings' "Clear data on this device".
 */
export async function forgetDevice(queryClient: QueryClient) {
  stopPersisting()
  queryClient.clear()
  await Promise.all([userStore.clear(), cacheStore.clear()]).catch(() => {})
}

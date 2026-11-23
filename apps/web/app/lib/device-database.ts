// The app's IndexedDB database on this device (ADR 17). Each kind of data has its own object
// store, so clearing or versioning one never touches another: the query cache, the last known
// User and the outbox of pending writes each have their own.

export const DATABASE_NAME = 'myvgc'

/**
 * Every object store and how it is created. To add one, add it here and bump
 * {@link DATABASE_VERSION}: opening the database then creates any store that is missing and
 * leaves the others, and what is in them, as they are.
 */
export const STORES = {
  /** The saved query cache, one entry per User, keyed by user id. */
  'query-cache': {},
  /** The last known User, under the key `last`. */
  user: {},
  /** Writes not yet sent to the server, one record per write, keyed `[userId, order, id]`. */
  outbox: {},
} satisfies Record<string, IDBObjectStoreParameters>

export type StoreName = keyof typeof STORES

export const DATABASE_VERSION = 2

let connection: Promise<IDBDatabase> | undefined

function open(): Promise<IDBDatabase> {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const [name, options] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, options)
      }
    }
    request.onsuccess = () => {
      const db = request.result
      // A newer version of the app opened in another tab: let it upgrade, and open again next time.
      db.onversionchange = () => {
        db.close()
        connection = undefined
      }
      resolve(db)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('The device database is open in an older tab.'))
  }).catch((error: unknown) => {
    connection = undefined
    throw error
  })
  return connection
}

/** Closes the connection; the next call opens it again. */
export async function closeDeviceDatabase() {
  const current = connection
  connection = undefined
  if (current) (await current.catch(() => undefined))?.close()
}

async function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(store, mode)
    const request = action(transaction.objectStore(store))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onerror = () => reject(transaction.error ?? request.error)
    transaction.onabort = () => reject(transaction.error ?? new Error('Transaction aborted'))
  })
}

/**
 * Reads and writes one object store. Every call can reject: IndexedDB may be unavailable or
 * full, so callers decide what a failure means.
 */
export function deviceStore<T>(name: StoreName) {
  return {
    get: (key: IDBValidKey) =>
      run(name, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>),
    /** Every value whose key is in `range`, in key order. */
    getAll: (range?: IDBKeyRange) =>
      run(name, 'readonly', (s) => s.getAll(range) as IDBRequest<T[]>),
    set: async (key: IDBValidKey, value: T) => {
      await run(name, 'readwrite', (s) => s.put(value, key))
    },
    delete: async (key: IDBValidKey | IDBKeyRange) => {
      await run(name, 'readwrite', (s) => s.delete(key))
    },
    clear: async () => {
      await run(name, 'readwrite', (s) => s.clear())
    },
  }
}

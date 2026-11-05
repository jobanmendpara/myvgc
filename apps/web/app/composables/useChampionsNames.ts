import { type ChampionsNames, NAME_KINDS } from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'
import { readStored, removeStored, writeStored } from '@/lib/storage'

// Bump when the shape of the names list changes, so old copies on devices are ignored.
const STORAGE_KEY = 'myvgc-names-v2'
const OLD_STORAGE_KEY = 'myvgc-names-v1'
const DAY = 24 * 60 * 60 * 1000

interface StoredNames {
  savedAt: number
  names: ChampionsNames
}

function readStoredNames(): StoredNames | undefined {
  removeStored(OLD_STORAGE_KEY)
  try {
    const parsed = JSON.parse(readStored(STORAGE_KEY) ?? 'null') as StoredNames | null
    const complete =
      typeof parsed?.savedAt === 'number' &&
      typeof parsed.names?.abilitiesBySpecies === 'object' &&
      NAME_KINDS.every((kind) => typeof parsed.names?.[kind] === 'object')
    return complete ? parsed : undefined
  } catch {
    return undefined
  }
}

// Read from storage once per page load; after that the query cache holds the list.
// `null` means not read yet.
let storedNames: StoredNames | undefined | null = null
function cached(): StoredNames | undefined {
  if (storedNames === null) storedNames = readStoredNames()
  return storedNames
}

/** Drops the copy kept on this device, so local data stays disposable (ADR 17). */
export function forgetChampionsNames() {
  removeStored(STORAGE_KEY)
  removeStored(OLD_STORAGE_KEY)
  storedNames = undefined
}

/**
 * The names list for pickers: display names for every Champions species, move, item and
 * ability, keyed by Showdown ID, and each species' abilities (ADR 17). The last copy is kept on
 * the device, so pickers work with no signal; when online it is refreshed once a day. Store the
 * IDs, show the names (ADR 14).
 * Like the rest of the device's data it is cleared on logout; it is the same for every User,
 * so it needs no User in its key.
 */
export function useChampionsNames() {
  return useQuery({
    queryKey: ['names'],
    queryFn: async () => {
      const names = await $fetch<ChampionsNames>('/api/names')
      writeStored(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), names }))
      return names
    },
    initialData: () => cached()?.names,
    initialDataUpdatedAt: () => cached()?.savedAt,
    staleTime: DAY,
    gcTime: Infinity,
  })
}

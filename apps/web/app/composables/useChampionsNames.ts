import { type ChampionsNames, NAME_KINDS } from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'
import { readStored, writeStored } from '@/lib/storage'

// Bump when the shape of the names list changes, so old copies on devices are ignored.
const STORAGE_KEY = 'myvgc-names-v1'
const DAY = 24 * 60 * 60 * 1000

interface StoredNames {
  savedAt: number
  names: ChampionsNames
}

function readStoredNames(): StoredNames | undefined {
  try {
    const parsed = JSON.parse(readStored(STORAGE_KEY) ?? 'null') as StoredNames | null
    const complete =
      typeof parsed?.savedAt === 'number' &&
      NAME_KINDS.every((kind) => typeof parsed.names?.[kind] === 'object')
    return complete ? parsed : undefined
  } catch {
    return undefined
  }
}

// Read from storage once per page load; after that the query cache holds the list.
let stored: { value: StoredNames | undefined } | undefined
const cached = () => (stored ??= { value: readStoredNames() }).value

/**
 * The names list for pickers: display names for every Champions species, move, item and
 * ability, keyed by Showdown ID (ADR 17). The last copy is kept on the device, so pickers work
 * with no signal; when online it is refreshed once a day. Store the IDs, show the names (ADR 14).
 * The list isn't private, so it isn't keyed by User or cleared on logout.
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

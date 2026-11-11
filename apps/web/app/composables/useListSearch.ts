import type { ListStyles } from '@myvgc/core/schema'

/**
 * The search over one loaded list (DEV-82). Matching runs in the browser, so it works offline.
 * The query lasts for the session: it survives opening an item, going Back and switching
 * tabs, but not a reload, and it stays out of the address.
 */
export function useListSearch<T>(
  list: keyof ListStyles,
  items: () => T[] | undefined,
  search: (items: T[], query: string) => T[],
) {
  const query = useState(`list-search-${list}`, () => '')
  const searching = computed(() => query.value.trim() !== '')
  const results = computed(() => search(items() ?? [], query.value))
  /** A search found nothing, in a list that has something in it. */
  const noMatches = computed(
    () => searching.value && results.value.length === 0 && Boolean(items()?.length),
  )
  return { query, searching, results, noMatches }
}

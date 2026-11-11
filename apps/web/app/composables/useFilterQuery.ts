import { EVENT_TIERS, type EventTier } from '@myvgc/core/schema'

/** The dashboard's filters, also used by Statistics, as the address holds them. */
export interface FilterQuery {
  regulation?: string
  season?: string
  from?: string
  to?: string
  setting?: string
  eventTier: EventTier[]
}

export type FilterChanges = Record<string, string | string[] | undefined>

const one = (value: unknown) => (typeof value === 'string' && value ? value : undefined)

/**
 * The dashboard's filters, plus any `extra` ones, read from the address and written back to it,
 * so a filtered view can be bookmarked and survives a reload.
 */
export function useFilterQuery<K extends string = never>(extra: readonly K[] = []) {
  const route = useRoute()
  const router = useRouter()
  const query = computed(() => ({
    regulation: one(route.query.regulation),
    season: one(route.query.season),
    from: one(route.query.from),
    to: one(route.query.to),
    setting: one(route.query.setting),
    eventTier: ([] as unknown[])
      .concat(route.query.eventTier ?? [])
      .filter((t): t is EventTier => EVENT_TIERS.includes(t as EventTier)),
    ...(Object.fromEntries(extra.map((key) => [key, one(route.query[key])])) as Partial<
      Record<K, string>
    >),
  }))
  function setFilters(changes: FilterChanges) {
    const next = { ...query.value, ...changes }
    const clean = Object.fromEntries(
      Object.entries(next).filter(([, v]) => (Array.isArray(v) ? v.length : v)),
    )
    router.replace({ query: clean })
  }
  return { query, setFilters }
}

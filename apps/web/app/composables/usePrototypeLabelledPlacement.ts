/**
 * PROTOTYPE (DEV-233), throwaway: never merge to main. Compares two placements of the Labelled
 * Type icon style's pills on the Pokémon build card:
 * - A, "top right": pills stacked at the top right; with Stacked tiles, left of the Sprite
 *   (DEV-218, DEV-226, PR #388).
 * - B, "under the item": a row of pills under the item, in every Sprite style (DEV-233, PR #404).
 *
 * The page's placement lives in `?placement=A|B` (B by default, as on main). One card can be
 * flipped on its own; changing the page's placement clears those flips. `?long=1` shows long
 * item names on the cards, on screen only: nothing is saved.
 */
export type Placement = 'A' | 'B'

export const PLACEMENT_LABELS: Record<Placement, string> = {
  A: 'Top right',
  B: 'Under the item',
}

const LONG_ITEMS = [
  { item: 'terrainextender', name: 'Terrain Extender' },
  { item: 'charizarditex', name: 'Charizardite X' },
  { item: 'kangaskhanite', name: 'Kangaskhanite' },
] as const

export function usePrototypeLabelledPlacement() {
  const route = useRoute()
  const router = useRouter()
  const overrides = useState<Record<string, Placement>>('prototype-placement-overrides', () => ({}))

  const placement = computed<Placement>(() => (route.query.placement === 'A' ? 'A' : 'B'))
  const longItems = computed(() => route.query.long === '1')

  function setPlacement(value: Placement) {
    overrides.value = {}
    router.replace({ query: { ...route.query, placement: value } })
  }

  function setLongItems(value: boolean) {
    router.replace({ query: { ...route.query, long: value ? '1' : undefined } })
  }

  function cardPlacement(key: string): Placement {
    return overrides.value[key] ?? placement.value
  }

  function flipCard(key: string) {
    const next: Placement = cardPlacement(key) === 'A' ? 'B' : 'A'
    overrides.value = { ...overrides.value, [key]: next }
  }

  function longItemFor(index: number) {
    return LONG_ITEMS[index % LONG_ITEMS.length]!
  }

  return {
    placement,
    overrides,
    longItems,
    setPlacement,
    setLongItems,
    cardPlacement,
    flipCard,
    longItemFor,
  }
}

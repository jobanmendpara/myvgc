// PROTOTYPE (DEV-218): throwaway. Which icon variant is showing (?variant=A|B|C), and the
// type lookups the real build would get from the names list. Never merged.
export const ICON_VARIANTS = ['A', 'B', 'C'] as const
export type IconVariant = (typeof ICON_VARIANTS)[number]
export const ICON_VARIANT_NAMES: Record<IconVariant, string> = {
  A: 'Corner row',
  B: 'Corner column, edge chips',
  C: 'Labelled pills',
}

export function usePrototypeIcons() {
  const route = useRoute()
  const variant = computed<IconVariant>(() => {
    const value = String(route.query.variant ?? 'A').toUpperCase()
    return (ICON_VARIANTS as readonly string[]).includes(value) ? (value as IconVariant) : 'A'
  })
  const names = useChampionsNames()
  const speciesTypes = (species: string) => names.data.value?.typesBySpecies?.[species]
  const moveType = (move: string) => names.data.value?.moveTypes?.[move]
  return { variant, speciesTypes, moveType }
}

export const TYPE_NAMES: Record<string, string> = Object.fromEntries(
  'normal fighting flying poison ground rock bug ghost steel fire water grass electric psychic ice dragon dark fairy'
    .split(' ')
    .map((id) => [id, id[0]!.toUpperCase() + id.slice(1)]),
)

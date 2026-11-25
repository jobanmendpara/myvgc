// PROTOTYPE (DEV-218): throwaway, never merged.
// The Type icon style (a Device setting, chosen on Settings; ?variant= overrides it for a quick
// look) and the move layout under test (?moves=fit|list), plus the type lookups the real build
// would get from the names list.
import { readStored, writeStored } from '@/lib/storage'

export const ICON_VARIANTS = ['A', 'B', 'C'] as const
export type IconVariant = (typeof ICON_VARIANTS)[number]
export const ICON_VARIANT_NAMES: Record<IconVariant, string> = {
  A: 'Compact',
  B: 'Badges',
  C: 'Labelled',
}
export const MOVE_LAYOUTS = ['fit', 'list'] as const
export type MoveLayout = (typeof MOVE_LAYOUTS)[number]
export const MOVE_LAYOUT_NAMES: Record<MoveLayout, string> = {
  fit: 'Two columns when they fit',
  list: 'One move per row',
}

const STORAGE_KEY = 'myvgc-prototype-type-icon-style'
const stored = ref<IconVariant>(
  (ICON_VARIANTS as readonly string[]).includes(readStored(STORAGE_KEY) ?? '')
    ? (readStored(STORAGE_KEY) as IconVariant)
    : 'A',
)

export function usePrototypeIcons() {
  const route = useRoute()
  const variant = computed<IconVariant>(() => {
    const value = String(route.query.variant ?? '').toUpperCase()
    return (ICON_VARIANTS as readonly string[]).includes(value) ? (value as IconVariant) : stored.value
  })
  const moveLayout = computed<MoveLayout>(() =>
    route.query.moves === 'list' ? 'list' : 'fit',
  )
  function setStyle(style: IconVariant) {
    stored.value = style
    writeStored(STORAGE_KEY, style)
  }
  const names = useChampionsNames()
  const speciesTypes = (species: string) => names.data.value?.typesBySpecies?.[species]
  const moveType = (move: string) => names.data.value?.moveTypes?.[move]
  return { variant, stored, setStyle, moveLayout, speciesTypes, moveType }
}

export const TYPE_NAMES: Record<string, string> = Object.fromEntries(
  'normal fighting flying poison ground rock bug ghost steel fire water grass electric psychic ice dragon dark fairy'
    .split(' ')
    .map((id) => [id, id[0]!.toUpperCase() + id.slice(1)]),
)

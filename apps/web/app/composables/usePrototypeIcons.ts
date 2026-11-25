// PROTOTYPE (DEV-218): throwaway, never merged.
// Two page preferences chosen with the Sprite style, kept per page on the device: the Type icon
// style (Compact by default) and the move layout (one column by default). ?variant=A|B|C still
// overrides the style for a quick look. Plus the type and move lookups the real build would get
// from the names list.
import { spritePageOf } from '@/lib/sprites'
import { readStored, writeStored } from '@/lib/storage'

export const ICON_VARIANTS = ['A', 'B', 'C'] as const
export type IconVariant = (typeof ICON_VARIANTS)[number]
export const ICON_VARIANT_NAMES: Record<IconVariant, string> = {
  A: 'Compact',
  B: 'Badges',
  C: 'Labelled',
}
export const MOVE_LAYOUTS = ['list', 'grid'] as const
export type MoveLayout = (typeof MOVE_LAYOUTS)[number]
export const MOVE_LAYOUT_NAMES: Record<MoveLayout, string> = {
  list: 'One column',
  grid: 'Two columns',
}

const STORAGE_KEY = 'myvgc-prototype-card-prefs'
type Prefs = Record<string, { icons?: IconVariant; moves?: MoveLayout }>
function read(): Prefs {
  try {
    return JSON.parse(readStored(STORAGE_KEY) ?? '{}') as Prefs
  } catch {
    return {}
  }
}
const prefs = ref<Prefs>(read())

export function usePrototypeIcons() {
  const route = useRoute()
  const page = computed(() => spritePageOf(route.path))
  const pagePrefs = computed(() => (page.value && prefs.value[page.value]) || {})
  const stored = computed<IconVariant>(() => pagePrefs.value.icons ?? 'A')
  const variant = computed<IconVariant>(() => {
    const value = String(route.query.variant ?? '').toUpperCase()
    return (ICON_VARIANTS as readonly string[]).includes(value) ? (value as IconVariant) : stored.value
  })
  const moveLayout = computed<MoveLayout>(() => pagePrefs.value.moves ?? 'list')
  function save(change: { icons?: IconVariant; moves?: MoveLayout }) {
    if (!page.value) return
    prefs.value = { ...prefs.value, [page.value]: { ...pagePrefs.value, ...change } }
    writeStored(STORAGE_KEY, JSON.stringify(prefs.value))
  }
  const names = useChampionsNames()
  const speciesTypes = (species: string) => names.data.value?.typesBySpecies?.[species]
  const moveType = (move: string) => names.data.value?.moveTypes?.[move]
  /** "100/85"; "—" for power that varies or accuracy that never misses; nothing for a status move. */
  function powerAccuracy(move: string): string | undefined {
    const stats = names.data.value?.moveStats?.[move]
    if (!stats || stats[0] < 0) return undefined
    return `${stats[0] || '—'}/${stats[1] || '—'}`
  }
  return {
    page,
    variant,
    stored,
    moveLayout,
    setStyle: (icons: IconVariant) => save({ icons }),
    setMoveLayout: (moves: MoveLayout) => save({ moves }),
    speciesTypes,
    moveType,
    powerAccuracy,
  }
}

export const TYPE_NAMES: Record<string, string> = Object.fromEntries(
  'normal fighting flying poison ground rock bug ghost steel fire water grass electric psychic ice dragon dark fairy'
    .split(' ')
    .map((id) => [id, id[0]!.toUpperCase() + id.slice(1)]),
)

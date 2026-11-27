// PROTOTYPE (DEV-266), throwaway: never merge to main. The Types page prototype's variant and
// type chart helpers.
import { type TypeId, TYPES } from '@myvgc/core/schema'
import type { PrototypePokedex } from '@myvgc/core'

export const TYPES_VARIANTS = ['A', 'B', 'C'] as const
export type TypesVariant = (typeof TYPES_VARIANTS)[number]
export const TYPES_VARIANT_LABELS: Record<TypesVariant, string> = {
  A: 'Full chart, picker on top',
  B: 'A row per type, each with its own page',
  C: 'Matchup calculator, chart on demand',
}

export function usePrototypeTypesVariant() {
  const route = useRoute()
  const router = useRouter()
  const variant = computed<TypesVariant>(() => {
    const value = String(route.query.variant ?? 'A')
    return (TYPES_VARIANTS as readonly string[]).includes(value) ? (value as TypesVariant) : 'A'
  })
  const setVariant = (value: TypesVariant) => router.replace({ query: { ...route.query, variant: value } })
  return { variant, setVariant }
}

/** The picked types, up to two, kept for the session. */
export function usePickedTypes() {
  const route = useRoute()
  // `?types=fire,flying` starts with those picked, for screenshots.
  const picked = useState<TypeId[]>('prototype-picked-types', () =>
    String(route.query.types ?? '').split(',').filter(Boolean).slice(0, 2) as TypeId[],
  )
  function toggle(type: TypeId) {
    const at = picked.value.indexOf(type)
    if (at >= 0) picked.value = picked.value.filter((t) => t !== type)
    else picked.value = [...picked.value.slice(-1), type]
  }
  return { picked, toggle }
}

const FACTOR = [1, 2, 0.5, 0]
/** How much damage an attacking type does to a defending type. */
export function effectiveness(chart: PrototypePokedex['typeChart'], attacker: TypeId, defender: TypeId) {
  return FACTOR[chart[defender]?.[attacker] ?? 0]!
}

/** What an attacking type hits for ×2, ×½ and ×0. */
export function offense(chart: PrototypePokedex['typeChart'], attacker: TypeId) {
  const result: Record<number, TypeId[]> = { 2: [], 0.5: [], 0: [] }
  for (const { id } of TYPES) {
    const value = effectiveness(chart, attacker, id)
    if (value !== 1) result[value]!.push(id)
  }
  return result
}

export const CELL_LABELS: Record<number, string> = { 2: '2', 0.5: '½', 0: '0', 1: '' }
export const CELL_CLASSES: Record<number, string> = {
  2: 'bg-emerald-500 text-white font-semibold',
  0.5: 'bg-red-400/80 text-white',
  0: 'bg-zinc-800 text-white dark:bg-zinc-950',
  1: '',
}

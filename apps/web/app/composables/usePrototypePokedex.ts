// PROTOTYPE (DEV-264), throwaway: never merge to main. The Pokédex prototype's data and the
// floating bar's settings. Data comes from `/api/prototype-pokedex` plus the names list; nothing
// is kept on the device.
import { type ChampionsNames, type TypeId, TYPES } from '@myvgc/core/schema'
import type { PrototypePokedex } from '@myvgc/core'
import { useQuery } from '@tanstack/vue-query'

export const POKEDEX_KINDS = ['species', 'moves', 'items', 'abilities'] as const
export type PokedexKind = (typeof POKEDEX_KINDS)[number]
export const KIND_LABELS: Record<PokedexKind, string> = {
  species: 'Pokémon',
  moves: 'Moves',
  items: 'Items',
  abilities: 'Abilities',
}

export const VARIANTS = ['A', 'B', 'C'] as const
export type Variant = (typeof VARIANTS)[number]
export const VARIANT_LABELS: Record<Variant, string> = {
  A: 'One search, grouped results',
  B: 'Tabs per kind, with filters',
  C: 'Browse grid, entry in a sheet',
}

export interface PokedexRow {
  kind: PokedexKind
  id: string
  name: string
}

export function usePrototypePokedexData() {
  return useQuery({
    queryKey: ['prototype-pokedex'],
    queryFn: () => $fetch<PrototypePokedex>('/api/prototype-pokedex'),
    staleTime: Infinity,
  })
}

/** The bar's settings, kept in the URL (variant) and in memory (the rest). */
export function usePrototypePokedexBar() {
  const route = useRoute()
  const router = useRouter()
  const variant = computed<Variant>(() => {
    const value = String(route.query.variant ?? 'A')
    return (VARIANTS as readonly string[]).includes(value) ? (value as Variant) : 'A'
  })
  function setVariant(value: Variant) {
    router.replace({ query: { ...route.query, variant: value } })
  }
  /** Show each entry also at the build editor's third-column width. */
  const compact = useState('prototype-pokedex-compact', () => false)
  /** Show learnsets, "Learned by" and "Pokémon with this ability". */
  const links = useState('prototype-pokedex-links', () => true)
  return { variant, setVariant, compact, links }
}

/** Keeps `?variant=` on links inside the prototype. */
export function usePokedexLink() {
  const route = useRoute()
  return (path: string) => ({ path, query: route.query.variant ? { variant: route.query.variant } : {} })
}

export const entryPath = (kind: PokedexKind, id: string) => `/pokedex/${kind}/${id}`

function fold(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** Rows of one kind matching the query: starts-with first, then contains, by name. */
export function searchKind(names: ChampionsNames, kind: PokedexKind, query: string): PokedexRow[] {
  const needle = fold(query)
  const starts: PokedexRow[] = []
  const contains: PokedexRow[] = []
  for (const [id, name] of Object.entries(names[kind])) {
    const folded = fold(name)
    if (!needle || folded.startsWith(needle)) starts.push({ kind, id, name })
    else if (folded.includes(needle)) contains.push({ kind, id, name })
  }
  const byName = (a: PokedexRow, b: PokedexRow) => a.name.localeCompare(b.name)
  return [...starts.sort(byName), ...contains.sort(byName)]
}

export const MULTIPLIERS = [4, 2, 0.5, 0.25, 0] as const
export const MULTIPLIER_LABELS: Record<number, string> = {
  4: '×4',
  2: '×2',
  0.5: '×½',
  0.25: '×¼',
  0: '×0',
}

/** Defensive Type matchups for one or two types: each attacking type's multiplier. */
export function typeMatchups(chart: PrototypePokedex['typeChart'], types: TypeId[]) {
  const factor = [1, 2, 0.5, 0]
  const result: Record<number, TypeId[]> = { 4: [], 2: [], 1: [], 0.5: [], 0.25: [], 0: [] }
  for (const { id: attacker } of TYPES) {
    let multiplier = 1
    for (const defender of types) multiplier *= factor[chart[defender]?.[attacker] ?? 0]!
    result[multiplier]!.push(attacker)
  }
  return result
}

/** Low Kick's and Grass Knot's power against this weight. */
export function weightPower(kg: number) {
  if (kg < 10) return 20
  if (kg < 25) return 40
  if (kg < 50) return 60
  if (kg < 100) return 80
  if (kg < 200) return 100
  return 120
}

export const TARGET_LABELS: Record<string, string> = {
  normal: 'One adjacent Pokémon',
  any: 'Any one Pokémon',
  adjacentAlly: 'One ally',
  adjacentAllyOrSelf: 'The user or an ally',
  adjacentFoe: 'One adjacent foe',
  allAdjacent: 'All adjacent Pokémon (spread)',
  allAdjacentFoes: 'Both foes (spread)',
  allies: 'The user and its ally',
  allySide: "The user's side",
  allyTeam: "The user's team",
  all: 'The whole field',
  foeSide: "The foes' side",
  randomNormal: 'A random foe',
  scripted: 'Depends on the move',
  self: 'The user',
}

export const STAT_LABELS = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' } as const

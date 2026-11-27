<script setup lang="ts">
// PROTOTYPE (DEV-264), throwaway: never merge to main. Variant B: a tab per kind plus Types,
// each with its own search, filters and sortable columns.
import { type TypeId, TYPES } from '@myvgc/core/schema'
import { KIND_LABELS, POKEDEX_KINDS, type PokedexKind, searchKind, usePokedexLink } from '@/composables/usePrototypePokedex'

defineProps<{ wide: boolean }>()
const names = useChampionsNames()
const pokedex = usePrototypePokedexData()
const to = usePokedexLink()
const route = useRoute()
const tab = useState<PokedexKind>('prototype-pokedex-tab', () => 'species')
// Opening an entry from elsewhere selects its tab.
watch(
  () => route.params.kind,
  (kind) => {
    if (typeof kind === 'string' && (POKEDEX_KINDS as readonly string[]).includes(kind)) tab.value = kind as PokedexKind
  },
  { immediate: true },
)
const query = useState('prototype-pokedex-tab-query', () => '')
const typeFilter = ref<TypeId[]>([])
const category = ref<'' | 'Physical' | 'Special' | 'Status'>('')
const itemFilter = ref<'' | 'mega' | 'held'>('')
const sort = ref<'name' | 'bst' | 'spe' | 'power'>('name')
watch(tab, () => {
  typeFilter.value = []
  category.value = ''
  sort.value = 'name'
})
function toggleType(type: TypeId) {
  const at = typeFilter.value.indexOf(type)
  if (at >= 0) typeFilter.value.splice(at, 1)
  else typeFilter.value = [...typeFilter.value.slice(-1), type]
}

const rows = computed(() => {
  const n = names.data.value
  if (!n) return []
  let list = searchKind(n, tab.value, query.value)
  if (tab.value === 'species' && typeFilter.value.length)
    list = list.filter((row) => typeFilter.value.every((t) => n.typesBySpecies[row.id]?.includes(t)))
  if (tab.value === 'moves') {
    if (typeFilter.value.length) list = list.filter((row) => typeFilter.value.includes(n.moveTypes[row.id]!))
    if (category.value) list = list.filter((row) => pokedex.data.value?.moves[row.id]?.category === category.value)
  }
  if (tab.value === 'items' && itemFilter.value)
    list = list.filter((row) => !!pokedex.data.value?.items[row.id]?.megaFor === (itemFilter.value === 'mega'))
  const stat = (id: string, key: 'spe' | 'bst') => {
    const s = n.baseStats[id]
    if (!s) return 0
    return key === 'spe' ? s.spe : Object.values(s).reduce((a, b) => a + b, 0)
  }
  if (sort.value === 'bst' || sort.value === 'spe') list = [...list].sort((a, b) => stat(b.id, sort.value as 'spe') - stat(a.id, sort.value as 'spe'))
  if (sort.value === 'power') list = [...list].sort((a, b) => (n.powerAndAccuracy[b.id]?.power ?? 0) - (n.powerAndAccuracy[a.id]?.power ?? 0))
  return list
})
const SEARCH_PLACEHOLDERS: Record<PokedexKind, string> = {
  species: 'Find a Pokémon',
  moves: 'Find a move',
  items: 'Find an item',
  abilities: 'Find an ability',
}
const chip = (on: boolean) => (on ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70')
</script>

<template>
  <div :class="wide ? 'flex min-h-0 w-[30rem] flex-1 flex-col' : 'flex flex-col gap-3'">
    <div class="flex flex-col gap-3" :class="wide ? 'shrink-0 border-b p-3' : ''">
      <h1 :class="wide ? 'text-lg font-semibold' : 'text-2xl font-semibold'">Pokédex</h1>
      <div role="tablist" class="bg-muted flex gap-0.5 overflow-x-auto rounded-lg p-0.5 text-sm">
        <button
          v-for="kind in POKEDEX_KINDS"
          :key="kind"
          role="tab"
          :aria-selected="tab === kind"
          class="flex-1 rounded-md px-2 py-1 whitespace-nowrap"
          :class="tab === kind ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'"
          @click="tab = kind"
        >
          {{ KIND_LABELS[kind] }}
        </button>
        <NuxtLink
          :to="to('/pokedex/types')"
          class="text-muted-foreground aria-[current=page]:bg-background aria-[current=page]:text-foreground flex-1 rounded-md px-2 py-1 text-center"
          :aria-current="route.path === '/pokedex/types' ? 'page' : undefined"
        >
          Types
        </NuxtLink>
      </div>
      <Input v-model="query" type="search" autocomplete="off" :placeholder="SEARCH_PLACEHOLDERS[tab]" />
      <div v-if="tab === 'species' || tab === 'moves'" class="flex flex-wrap gap-1">
        <button
          v-for="type in TYPES"
          :key="type.id"
          type="button"
          class="rounded-full p-0.5"
          :class="typeFilter.includes(type.id) ? 'ring-primary ring-2' : typeFilter.length ? 'opacity-40' : ''"
          :aria-pressed="typeFilter.includes(type.id)"
          @click="toggleType(type.id)"
        >
          <TypeIcon :type="type.id" :size="20" />
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-1 text-xs">
        <template v-if="tab === 'moves'">
          <button v-for="c in ['', 'Physical', 'Special', 'Status'] as const" :key="c" type="button" class="rounded-full px-2 py-0.5" :class="chip(category === c)" @click="category = c">
            {{ c || 'All' }}
          </button>
        </template>
        <template v-if="tab === 'items'">
          <button v-for="[c, label] in [['', 'All'], ['held', 'Held items'], ['mega', 'Mega Stones']] as const" :key="c" type="button" class="rounded-full px-2 py-0.5" :class="chip(itemFilter === c)" @click="itemFilter = c">
            {{ label }}
          </button>
        </template>
        <span class="text-muted-foreground ml-auto">{{ rows.length }} shown</span>
      </div>
    </div>
    <div :class="{ 'min-h-0 flex-1 overflow-y-auto pb-16': wide }">
      <div v-if="tab === 'species'" class="text-muted-foreground flex items-center gap-2 border-b px-3 py-1 text-xs">
        <button class="mr-auto" :class="{ 'text-foreground font-semibold': sort === 'name' }" @click="sort = 'name'">Name</button>
        <button class="w-10 text-right" :class="{ 'text-foreground font-semibold': sort === 'bst' }" @click="sort = 'bst'">Total</button>
        <button class="w-8 text-right" :class="{ 'text-foreground font-semibold': sort === 'spe' }" @click="sort = 'spe'">Spe</button>
        <span class="w-11 text-right">Type</span>
      </div>
      <div v-if="tab === 'moves'" class="text-muted-foreground flex items-center gap-2 border-b px-3 py-1 text-xs">
        <button class="mr-auto pl-6" :class="{ 'text-foreground font-semibold': sort === 'name' }" @click="sort = 'name'">Name</button>
        <span class="w-14">Category</span>
        <button class="w-8 text-right" :class="{ 'text-foreground font-semibold': sort === 'power' }" @click="sort = 'power'">Pow</button>
        <span class="w-8 text-right">Acc</span>
        <span class="w-6 text-right">PP</span>
      </div>
      <PrototypePokedexRow v-for="row in rows" :key="row.id" :row="row" detailed />
    </div>
  </div>
</template>

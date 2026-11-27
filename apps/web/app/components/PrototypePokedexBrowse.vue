<script setup lang="ts">
// PROTOTYPE (DEV-264), throwaway: never merge to main. Variant C: no list column. A big search
// box and kind chips over a grid of tiles; an entry opens in a sheet over the grid (from the right
// on desktop, from the bottom on a phone), still at its own address.
import { spriteUrl } from '@/lib/sprites'
import { entryPath, KIND_LABELS, POKEDEX_KINDS, type PokedexKind, searchKind, usePokedexLink } from '@/composables/usePrototypePokedex'

const names = useChampionsNames()
const pokedex = usePrototypePokedexData()
const to = usePokedexLink()
const route = useRoute()
const router = useRouter()
const wide = useWideLayout()
const query = useState('prototype-pokedex-browse-query', () => '')
const kind = useState<PokedexKind | 'all'>('prototype-pokedex-browse-kind', () => 'species')
const rows = computed(() => {
  const n = names.data.value
  if (!n) return []
  const kinds = kind.value === 'all' ? POKEDEX_KINDS : [kind.value]
  return kinds.flatMap((k) => searchKind(n, k, query.value))
})
const shown = computed(() => rows.value.slice(0, 300))
const open = computed(() => route.path !== '/pokedex' && route.path !== '/pokedex/')
function close() {
  router.push(to('/pokedex'))
}
const chip = (on: boolean) => (on ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70')
</script>

<template>
  <div class="h-full overflow-y-auto p-4 pb-32">
    <div class="mx-auto flex max-w-5xl flex-col gap-4">
      <div class="flex items-center gap-3">
        <h1 class="mr-auto text-2xl font-semibold">Pokédex</h1>
      </div>
      <Input v-model="query" type="search" autocomplete="off" class="h-12 text-base" placeholder="Search Pokémon, moves, items, abilities" />
      <div class="flex flex-wrap gap-1.5 text-sm">
        <button v-for="k in ['all', ...POKEDEX_KINDS] as const" :key="k" type="button" class="rounded-full px-3 py-1" :class="chip(kind === k)" @click="kind = k">
          {{ k === 'all' ? 'Everything' : KIND_LABELS[k] }}
        </button>
        <NuxtLink :to="to('/pokedex/types')" class="bg-muted hover:bg-muted/70 rounded-full px-3 py-1">Types →</NuxtLink>
        <span class="text-muted-foreground ml-auto self-center text-xs">{{ rows.length }} {{ rows.length > 300 ? '(first 300 shown)' : '' }}</span>
      </div>
      <ul class="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
        <li v-for="row in shown" :key="row.kind + row.id">
          <NuxtLink
            :to="to(entryPath(row.kind, row.id))"
            class="hover:bg-muted flex h-full flex-col items-center gap-1 rounded-lg border p-2 text-center text-xs"
          >
            <template v-if="row.kind === 'species'">
              <img :src="spriteUrl(row.id)" alt="" width="56" height="56" loading="lazy" />
              <span class="font-medium">{{ row.name }}</span>
              <span class="flex gap-0.5"><TypeIcon v-for="t in names.data.value!.typesBySpecies[row.id]" :key="t" :type="t" :size="16" /></span>
            </template>
            <template v-else-if="row.kind === 'moves'">
              <TypeIcon :type="names.data.value!.moveTypes[row.id]" :size="28" />
              <span class="font-medium">{{ row.name }}</span>
              <span class="text-muted-foreground">{{ pokedex.data.value?.moves[row.id]?.category }} · {{ names.data.value!.powerAndAccuracy[row.id]?.power ?? '—' }}</span>
            </template>
            <template v-else-if="row.kind === 'items'">
              <ItemIcon :item="row.id" :size="32" />
              <span class="font-medium">{{ row.name }}</span>
            </template>
            <template v-else>
              <span class="font-medium">{{ row.name }}</span>
              <span class="text-muted-foreground line-clamp-3">{{ pokedex.data.value?.abilities[row.id]?.shortDesc }}</span>
            </template>
          </NuxtLink>
        </li>
      </ul>
    </div>
    <Sheet :open="open" @update:open="(value) => !value && close()">
      <SheetContent
        :side="wide ? 'right' : 'bottom'"
        :class="wide ? 'w-[40rem] overflow-y-auto p-6 sm:max-w-[40rem]' : 'h-[90dvh] overflow-y-auto rounded-t-2xl p-4'"
      >
        <SheetTitle class="sr-only">Pokédex entry</SheetTitle>
        <slot />
      </SheetContent>
    </Sheet>
  </div>
</template>

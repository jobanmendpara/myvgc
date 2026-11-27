<script setup lang="ts">
// PROTOTYPE (DEV-264), throwaway: never merge to main. One search result, as a link to its entry.
// `detailed` adds the numbers a kind's tab can sort on (variant B).
import { spriteUrl } from '@/lib/sprites'
import { entryPath, type PokedexRow } from '@/composables/usePrototypePokedex'

const props = defineProps<{ row: PokedexRow; detailed?: boolean }>()
const names = useChampionsNames()
const pokedex = usePrototypePokedexData()
const to = usePokedexLink()
const route = useRoute()
const path = computed(() => entryPath(props.row.kind, props.row.id))
const current = computed(() => route.path === path.value)
const n = computed(() => names.data.value!)
const move = computed(() => pokedex.data.value?.moves[props.row.id])
const bst = computed(() => {
  const stats = n.value.baseStats[props.row.id]
  return stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0
})
</script>

<template>
  <NuxtLink
    :to="to(path)"
    :aria-current="current ? 'page' : undefined"
    class="hover:bg-muted aria-[current=page]:bg-muted flex min-h-10 items-center gap-2 px-3 py-1 text-sm"
  >
    <template v-if="row.kind === 'species'">
      <img :src="spriteUrl(row.id)" alt="" width="32" height="32" loading="lazy" class="shrink-0" />
      <span class="mr-auto truncate font-medium">{{ row.name }}</span>
      <span v-if="detailed" class="text-muted-foreground w-10 text-right text-xs tabular-nums">{{ bst }}</span>
      <span v-if="detailed" class="text-muted-foreground w-8 text-right text-xs tabular-nums">{{ n.baseStats[row.id]?.spe }}</span>
      <span class="flex w-11 justify-end gap-0.5">
        <TypeIcon v-for="type in n.typesBySpecies[row.id]" :key="type" :type="type" :size="18" />
      </span>
    </template>
    <template v-else-if="row.kind === 'moves'">
      <TypeIcon :type="n.moveTypes[row.id]" :size="18" />
      <span class="mr-auto truncate font-medium">{{ row.name }}</span>
      <span class="text-muted-foreground w-14 text-xs">{{ move?.category }}</span>
      <template v-if="detailed">
        <span class="text-muted-foreground w-8 text-right text-xs tabular-nums">{{ n.powerAndAccuracy[row.id]?.power ?? '—' }}</span>
        <span class="text-muted-foreground w-8 text-right text-xs tabular-nums">{{ n.powerAndAccuracy[row.id] ? (n.powerAndAccuracy[row.id]!.accuracy ?? '—') : '—' }}</span>
        <span class="text-muted-foreground w-6 text-right text-xs tabular-nums">{{ move?.pp }}</span>
      </template>
    </template>
    <template v-else-if="row.kind === 'items'">
      <ItemIcon :item="row.id" :size="24" />
      <span class="flex min-w-0 flex-col">
        <span class="truncate font-medium">{{ row.name }}</span>
        <span v-if="detailed" class="text-muted-foreground truncate text-xs">{{ pokedex.data.value?.items[row.id]?.shortDesc }}</span>
      </span>
    </template>
    <template v-else>
      <span class="flex min-w-0 flex-col">
        <span class="truncate font-medium">{{ row.name }}</span>
        <span class="text-muted-foreground truncate text-xs">{{ pokedex.data.value?.abilities[row.id]?.shortDesc }}</span>
      </span>
    </template>
  </NuxtLink>
</template>

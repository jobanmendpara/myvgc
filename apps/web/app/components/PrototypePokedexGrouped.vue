<script setup lang="ts">
// PROTOTYPE (DEV-264), throwaway: never merge to main. Variant A: one search box across every
// kind, results grouped under Pokémon, Moves, Items and Abilities, a few each with "Show all".
import { KIND_LABELS, POKEDEX_KINDS, type PokedexKind, searchKind, usePokedexLink } from '@/composables/usePrototypePokedex'

defineProps<{ wide: boolean }>()
const names = useChampionsNames()
const query = useState('prototype-pokedex-query', () => '')
const expanded = ref<PokedexKind | null>(null)
watch(query, () => (expanded.value = null))
const to = usePokedexLink()
const groups = computed(() =>
  names.data.value
    ? POKEDEX_KINDS.map((kind) => ({ kind, rows: searchKind(names.data.value!, kind, query.value) }))
    : [],
)
const FEW = 6
</script>

<template>
  <div :class="wide ? 'flex min-h-0 w-96 flex-1 flex-col' : 'flex flex-col gap-4'">
    <div class="flex flex-col gap-3" :class="wide ? 'shrink-0 border-b p-3' : ''">
      <div class="flex items-center gap-3">
        <h1 class="mr-auto" :class="wide ? 'text-lg font-semibold' : 'text-2xl font-semibold'">Pokédex</h1>
        <Button as-child variant="outline" size="sm"><NuxtLink :to="to('/pokedex/types')">Types</NuxtLink></Button>
      </div>
      <Input v-model="query" type="search" autocomplete="off" placeholder="Search Pokémon, moves, items, abilities" />
    </div>
    <div :class="{ 'min-h-0 flex-1 overflow-y-auto pb-16': wide }">
      <p v-if="!names.data.value" class="text-muted-foreground p-3 text-sm">Loading…</p>
      <template v-for="group in groups" :key="group.kind">
        <section v-if="group.rows.length && (!expanded || expanded === group.kind)" class="py-2">
          <h2 class="text-muted-foreground flex items-baseline justify-between px-3 pb-1 text-xs font-semibold tracking-wide uppercase">
            {{ KIND_LABELS[group.kind] }}
            <span class="font-normal normal-case">{{ group.rows.length }}</span>
          </h2>
          <PrototypePokedexRow
            v-for="row in expanded === group.kind ? group.rows : group.rows.slice(0, FEW)"
            :key="row.id"
            :row="row"
          />
          <button
            v-if="group.rows.length > FEW"
            type="button"
            class="text-primary px-3 py-1 text-xs font-medium hover:underline"
            @click="expanded = expanded === group.kind ? null : group.kind"
          >
            {{ expanded === group.kind ? '← All kinds' : `Show all ${group.rows.length} ${KIND_LABELS[group.kind].toLowerCase()}` }}
          </button>
        </section>
      </template>
      <p v-if="names.data.value && groups.every((g) => !g.rows.length)" class="text-muted-foreground p-3 text-sm">
        Nothing matches “{{ query.trim() }}”.
      </p>
    </div>
  </div>
</template>

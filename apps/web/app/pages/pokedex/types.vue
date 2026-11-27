<script setup lang="ts">
// PROTOTYPE (DEV-266), throwaway: never merge to main. The Types page in three variants.
import { TYPES, typeName } from '@myvgc/core/schema'
import { offense } from '@/composables/usePrototypeTypes'

const { variant } = usePrototypeTypesVariant()
const { picked } = usePickedTypes()
const pokedex = usePrototypePokedexData()
const route = useRoute()
const chartOpen = ref(false)
const weakTo = (type: string) =>
  TYPES.filter((a) => pokedex.data.value && pokedex.data.value.typeChart[type]?.[a.id] === 1).map((a) => a.id)
const pickedName = computed(() => picked.value.map((t) => typeName(t)).join(' / '))
</script>

<template>
  <div class="flex flex-col gap-6">
    <ListBackLink to="/pokedex">Pokédex</ListBackLink>
    <h1 class="text-2xl font-semibold">Types</h1>

    <!-- A: picker, the pair's matchups, then the whole chart. -->
    <template v-if="variant === 'A'">
      <PrototypeTypePicker />
      <div v-if="picked.length" class="rounded-lg border p-4">
        <p class="mb-3 font-semibold">{{ pickedName }}</p>
        <PrototypeMatchups :types="picked" show-offense />
      </div>
      <PrototypeTypeChart />
    </template>

    <!-- B: picker, the pair's matchups, then a row per type, each linking to its own page. -->
    <template v-else-if="variant === 'B'">
      <PrototypeTypePicker pills />
      <div v-if="picked.length" class="rounded-lg border p-4">
        <p class="mb-3 font-semibold">{{ pickedName }}</p>
        <PrototypeMatchups :types="picked" show-offense labelled />
      </div>
      <ul v-if="pokedex.data.value" class="divide-y rounded-lg border">
        <li v-for="type in TYPES" :key="type.id">
          <NuxtLink :to="{ path: `/pokedex/types/${type.id}`, query: route.query }" class="hover:bg-muted flex flex-col gap-1.5 p-3 sm:flex-row sm:items-center sm:gap-4">
            <span class="w-28 shrink-0"><TypeIcon :type="type.id" labelled /></span>
            <span class="flex flex-1 flex-wrap items-center gap-1 text-xs">
              <span class="text-muted-foreground w-24">Hits hard</span>
              <TypeIcon v-for="t in offense(pokedex.data.value.typeChart, type.id)[2]" :key="t" :type="t" :size="18" />
            </span>
            <span class="flex flex-1 flex-wrap items-center gap-1 text-xs">
              <span class="text-muted-foreground w-24">Weak to</span>
              <TypeIcon v-for="t in weakTo(type.id)" :key="t" :type="t" :size="18" />
            </span>
          </NuxtLink>
        </li>
      </ul>
    </template>

    <!-- C: a calculator first; the chart only on request. -->
    <template v-else>
      <div class="bg-muted/40 flex flex-col gap-4 rounded-xl border p-4">
        <PrototypeTypePicker pills />
        <div v-if="picked.length" class="flex flex-col gap-3">
          <div class="flex items-center gap-1.5">
            <TypeIcon v-for="t in picked" :key="t" :type="t" :size="32" />
            <span class="text-lg font-semibold">{{ pickedName }}</span>
          </div>
          <PrototypeMatchups :types="picked" show-offense labelled />
        </div>
        <p v-else class="text-muted-foreground text-sm">Pick a type to see what it's weak to, what it resists, and what it hits.</p>
      </div>
      <Button variant="outline" class="self-start" @click="chartOpen = !chartOpen">
        {{ chartOpen ? 'Hide the type chart' : 'Show the whole type chart' }}
      </Button>
      <PrototypeTypeChart v-if="chartOpen" />
    </template>
  </div>
</template>

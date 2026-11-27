<script setup lang="ts">
// PROTOTYPE (DEV-266), throwaway: never merge to main. A type's own Pokédex entry (variant B):
// what it hits and is hit by, then the Pokémon and moves of that type.
import { type TypeId, typeName } from '@myvgc/core/schema'
import { spriteUrl } from '@/lib/sprites'
import { entryPath } from '@/composables/usePrototypePokedex'

const props = defineProps<{ id: TypeId }>()
const names = useChampionsNames()
const pokedex = usePrototypePokedexData()
const to = usePokedexLink()
const species = computed(() =>
  Object.entries(names.data.value?.typesBySpecies ?? {})
    .filter(([, types]) => types.includes(props.id))
    .map(([id]) => ({ id, name: names.data.value!.species[id] ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name)),
)
const moves = computed(() =>
  Object.entries(names.data.value?.moveTypes ?? {})
    .filter(([, type]) => type === props.id)
    .map(([id]) => ({ id, name: names.data.value!.moves[id] ?? id, category: pokedex.data.value?.moves[id]?.category }))
    .sort((a, b) => a.name.localeCompare(b.name)),
)
const speciesOpen = ref(false)
const movesOpen = ref(false)
</script>

<template>
  <article class="flex flex-col gap-6">
    <header class="flex items-center gap-3">
      <TypeIcon :type="id" :size="48" />
      <div class="flex flex-col">
        <span class="text-muted-foreground text-xs">Type</span>
        <h1 class="text-2xl font-semibold">{{ typeName(id) }}</h1>
      </div>
    </header>
    <PrototypeMatchups :types="[id]" show-offense labelled />
    <section class="flex flex-col gap-2">
      <button type="button" class="text-muted-foreground text-left text-xs font-semibold tracking-wide uppercase" @click="speciesOpen = !speciesOpen">
        {{ speciesOpen ? '▾' : '▸' }} {{ typeName(id) }} Pokémon ({{ species.length }})
      </button>
      <ul v-if="speciesOpen" class="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-3 gap-y-0.5 text-sm">
        <li v-for="s in species" :key="s.id">
          <NuxtLink :to="to(entryPath('species', s.id))" class="flex items-center gap-1 hover:underline">
            <img :src="spriteUrl(s.id)" alt="" width="28" height="28" loading="lazy" />{{ s.name }}
          </NuxtLink>
        </li>
      </ul>
    </section>
    <section class="flex flex-col gap-2">
      <button type="button" class="text-muted-foreground text-left text-xs font-semibold tracking-wide uppercase" @click="movesOpen = !movesOpen">
        {{ movesOpen ? '▾' : '▸' }} {{ typeName(id) }} moves ({{ moves.length }})
      </button>
      <ul v-if="movesOpen" class="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-3 gap-y-1 text-sm">
        <li v-for="m in moves" :key="m.id">
          <NuxtLink :to="to(entryPath('moves', m.id))" class="flex items-baseline gap-1.5 hover:underline">
            {{ m.name }} <span class="text-muted-foreground text-xs">{{ m.category }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </article>
</template>

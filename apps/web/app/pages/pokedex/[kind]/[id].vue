<script setup lang="ts">
// PROTOTYPE (DEV-264), throwaway: never merge to main. A Pokédex entry at its own address,
// such as /pokedex/moves/fakeout.
import type { PokedexKind } from '@/composables/usePrototypePokedex'

const route = useRoute()
const kind = computed(() => route.params.kind as PokedexKind)
const id = computed(() => route.params.id as string)
const to = usePokedexLink()

</script>

<template>
  <div class="flex flex-col gap-4">
    <ListBackLink :to="(kind as string) === 'types' ? '/pokedex/types' : to('/pokedex').path">{{ (kind as string) === 'types' ? 'Types' : 'Pokédex' }}</ListBackLink>
    <PrototypeTypeEntry v-if="(kind as string) === 'types'" :id="(id as any)" />
    <PrototypePokedexEntry v-else :kind="kind" :id="id" />
  </div>
</template>

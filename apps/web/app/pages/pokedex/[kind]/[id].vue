<script setup lang="ts">
// PROTOTYPE (DEV-264), throwaway: never merge to main. A Pokédex entry at its own address,
// such as /pokedex/moves/fakeout.
import type { PokedexKind } from '@/composables/usePrototypePokedex'

const route = useRoute()
const kind = computed(() => route.params.kind as PokedexKind)
const id = computed(() => route.params.id as string)
const to = usePokedexLink()
const { variant } = usePrototypePokedexBar()
</script>

<template>
  <div class="flex flex-col gap-4">
    <ListBackLink v-if="variant !== 'C'" :to="to('/pokedex').path">Pokédex</ListBackLink>
    <PrototypePokedexEntry :kind="kind" :id="id" />
  </div>
</template>

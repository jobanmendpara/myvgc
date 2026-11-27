<script setup lang="ts">
// PROTOTYPE (DEV-267), throwaway: never merge to main. The third column: the edited build's
// species' compact Pokédex entry, or a note until a species is picked.
import { entryPath } from '@/composables/usePrototypePokedex'

defineProps<{ species?: string | null }>()
usePrototypePokedexData()
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Pokédex entry</p>
    <template v-if="species">
      <PrototypeSpeciesEntry :id="species" compact />
      <NuxtLink :to="entryPath('species', species)" target="_blank" class="text-primary text-xs font-medium hover:underline">Open the full entry ↗</NuxtLink>
    </template>
    <p v-else class="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
      Pick a species to see its Pokédex entry here: types, abilities, base stats and Type matchups.
    </p>
  </div>
</template>

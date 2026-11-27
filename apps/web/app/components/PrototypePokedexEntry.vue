<script setup lang="ts">
// PROTOTYPE (DEV-264), throwaway: never merge to main. Picks the entry for a kind. With the
// bar's "Compact" on, a species entry also shows at the build editor's third-column width.
import type { PokedexKind } from '@/composables/usePrototypePokedex'

defineProps<{ kind: PokedexKind; id: string }>()
const pokedex = usePrototypePokedexData()
const { compact } = usePrototypePokedexBar()
</script>

<template>
  <p v-if="pokedex.isPending.value" class="text-muted-foreground">Loading…</p>
  <div v-else class="flex flex-wrap items-start gap-8">
    <div class="w-full max-w-2xl min-w-0 flex-1">
      <PrototypeSpeciesEntry v-if="kind === 'species'" :id="id" />
      <PrototypeMoveEntry v-else-if="kind === 'moves'" :id="id" />
      <PrototypeItemAbilityEntry v-else :kind="kind" :id="id" />
    </div>
    <div v-if="compact && kind === 'species'" class="w-80 shrink-0 rounded-lg border border-dashed border-fuchsia-400 p-3">
      <p class="mb-3 text-xs font-semibold text-fuchsia-600 uppercase">Compact · build editor's third column (20 rem)</p>
      <PrototypeSpeciesEntry :id="id" compact />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NameKind, PokemonBuild } from '@myvgc/core/schema'

// An Opponent's Team (ADR 22), read-only: each build's species, held item, ability and moves,
// leaving out what wasn't recorded.
defineProps<{ pokemon: PokemonBuild[] }>()

const names = useChampionsNames()
const nameOf = (kind: NameKind, id: string) => names.data.value?.[kind][id] ?? id
</script>

<template>
  <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Opponent's Team">
    <li
      v-for="build in pokemon"
      :key="build.species"
      class="bg-muted/40 flex flex-col gap-0.5 rounded-md p-2 text-sm"
    >
      <p class="font-medium">
        {{ nameOf('species', build.species) }}
        <span v-if="build.item" class="text-muted-foreground font-normal"
          >@ {{ nameOf('items', build.item) }}</span
        >
      </p>
      <p v-if="build.ability" class="text-muted-foreground text-xs">
        {{ nameOf('abilities', build.ability) }}
      </p>
      <p v-if="build.moves.length" class="text-xs">
        {{ build.moves.map((move) => nameOf('moves', move)).join(' · ') }}
      </p>
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { TeamView } from '@myvgc/core/schema'

// What a Team's card or list row shows: name, legality badge, Regulation and species.
// `condensed` tightens it for a row in the list column.
defineProps<{ team: TeamView; condensed?: boolean }>()
</script>

<template>
  <span class="flex items-start justify-between" :class="condensed ? 'gap-2' : 'gap-3'">
    <span class="min-w-0 font-semibold break-words">{{ team.name }}</span>
    <span class="flex shrink-0 flex-wrap justify-end gap-1.5">
      <LegalityBadge :legality="team.legality" />
      <Badge variant="secondary">Reg {{ team.regulation }}</Badge>
    </span>
  </span>
  <ul class="flex flex-wrap gap-1.5" :aria-label="`Pokémon in ${team.name}`">
    <li
      v-for="(build, index) in team.pokemon"
      :key="index"
      class="bg-muted text-muted-foreground rounded"
      :class="condensed ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-sm'"
    >
      {{ build.names.species }}
    </li>
  </ul>
</template>

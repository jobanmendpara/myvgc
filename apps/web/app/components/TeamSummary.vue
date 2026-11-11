<script setup lang="ts">
import type { ListStyle, TeamView } from '@myvgc/core/schema'

// What a Team's row shows in each List style. Compact: the name and Regulation, with a red dot
// if the Team is illegal. Grouped: the name and legality badge, then the species; the heading
// already names the Regulation. Detailed: name, legality badge, Regulation and species chips,
// with `condensed` tightening it for the list column.
defineProps<{ team: TeamView; listStyle: ListStyle; condensed?: boolean }>()
</script>

<template>
  <template v-if="listStyle === 'compact'">
    <span class="flex min-w-0 items-center gap-2">
      <span
        v-if="team.legality.status === 'illegal'"
        class="bg-destructive size-2 shrink-0 rounded-full"
        :title="`Illegal in ${team.legality.regulation}`"
        data-testid="illegal-dot"
        ><span class="sr-only">Illegal in {{ team.legality.regulation }}</span></span
      >
      <span class="truncate">{{ team.name }}</span>
    </span>
    <span class="text-muted-foreground shrink-0">Reg {{ team.regulation }}</span>
  </template>

  <template v-else-if="listStyle === 'grouped'">
    <span class="flex items-center justify-between gap-2">
      <span class="truncate font-medium">{{ team.name }}</span>
      <LegalityBadge :legality="team.legality" />
    </span>
    <span class="text-muted-foreground truncate text-xs">{{
      team.pokemon.map((build) => build.names.species).join(' · ')
    }}</span>
  </template>

  <template v-else>
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
</template>

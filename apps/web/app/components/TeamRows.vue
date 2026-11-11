<script setup lang="ts">
import { type ListStyle, type TeamView, groupTeams } from '@myvgc/core/schema'

// The rows of the Teams list, and what a row shows in each List style. Compact: the name and
// Regulation, with a red dot if the Team is illegal. Grouped: the name and legality badge, then
// the species; the heading already names the Regulation. Detailed: name, legality badge,
// Regulation and species chips, tighter on wide screens.
defineProps<{ teams: TeamView[]; listStyle: ListStyle; wide: boolean; searching: boolean }>()

// Typed here: passing the generic core function straight to ListRows broke CI's typecheck.
const groupBy = (items: TeamView[]) => groupTeams(items)
</script>

<template>
  <ListRows
    :items="teams"
    :list-style="listStyle"
    :wide="wide"
    base="/teams"
    :group-by="groupBy"
    :searching="searching"
    data-testid="teams-list"
  >
    <template #compact="{ item }">
      <span class="flex min-w-0 items-center gap-2">
        <span
          v-if="item.legality.status === 'illegal'"
          class="bg-destructive size-2 shrink-0 rounded-full"
          :title="`Illegal in ${item.legality.regulation}`"
          data-testid="illegal-dot"
          ><span class="sr-only">Illegal in {{ item.legality.regulation }}</span></span
        >
        <span class="truncate">{{ item.name }}</span>
      </span>
      <span class="text-muted-foreground shrink-0">Reg {{ item.regulation }}</span>
    </template>

    <template #grouped="{ item }">
      <span class="flex items-center justify-between gap-2">
        <span class="truncate font-medium">{{ item.name }}</span>
        <LegalityBadge :legality="item.legality" />
      </span>
      <span class="text-muted-foreground truncate text-xs">{{
        item.pokemon.map((build) => build.names.species).join(' · ')
      }}</span>
    </template>

    <template #detailed="{ item }">
      <span class="flex items-start justify-between" :class="wide ? 'gap-2' : 'gap-3'">
        <span class="min-w-0 font-semibold break-words">{{ item.name }}</span>
        <span class="flex shrink-0 flex-wrap justify-end gap-1.5">
          <LegalityBadge :legality="item.legality" />
          <Badge variant="secondary">Reg {{ item.regulation }}</Badge>
        </span>
      </span>
      <ul class="flex flex-wrap gap-1.5" :aria-label="`Pokémon in ${item.name}`">
        <li
          v-for="(build, index) in item.pokemon"
          :key="index"
          class="bg-muted text-muted-foreground rounded"
          :class="wide ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-sm'"
        >
          {{ build.names.species }}
        </li>
      </ul>
    </template>
  </ListRows>
</template>

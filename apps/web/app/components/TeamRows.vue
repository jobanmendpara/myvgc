<script setup lang="ts">
import { type ListStyle, type TeamView, groupTeams } from '@myvgc/core/schema'
import { teamPath } from '@/lib/paths'

// The rows of the Teams list, and what a row shows in each List style. Compact: the name and
// Regulation, with a red dot if the Team is illegal. Grouped: the name and legality badge, then
// the species with their Sprites; the heading already names the Regulation. Detailed: name,
// legality badge, Regulation and species chips with their Sprites, tighter on wide screens.
// The page's Sprite style lays the Sprites out: in the Grouped style, Inline puts each before
// its name, Leading slot a row of them above the names line (which wraps between names, never
// inside one, so every name shows), Stacked tiles a 3 × 2 grid with
// each over its name; in the Detailed style, Stacked tiles turns the chips into tiles.
defineProps<{ teams: TeamView[]; listStyle: ListStyle; wide: boolean; searching: boolean }>()

// Typed here: passing the generic core function straight to ListRows broke CI's typecheck.
const groupBy = (items: TeamView[]) => groupTeams(items)
const { style: spriteStyle } = useSpriteStyle()
</script>

<template>
  <ListRows
    :items="teams"
    :list-style="listStyle"
    :wide="wide"
    :path="teamPath"
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
      <span
        v-if="spriteStyle === 'inline'"
        class="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
      >
        <span
          v-for="(build, index) in item.pokemon"
          :key="index"
          class="inline-flex items-center gap-0.5"
        >
          <Sprite :species="build.species" surface="team-row-grouped" />{{ build.names.species }}
        </span>
      </span>
      <template v-else-if="spriteStyle === 'leading-slot'">
        <span class="flex gap-1">
          <Sprite
            v-for="(build, index) in item.pokemon"
            :key="index"
            :species="build.species"
            surface="team-row-grouped"
          />
        </span>
        <span class="text-muted-foreground flex flex-wrap gap-x-1 text-xs">
          <span v-for="(build, index) in item.pokemon" :key="index" class="whitespace-nowrap"
            >{{ build.names.species
            }}<template v-if="index < item.pokemon.length - 1"> ·</template></span
          >
        </span>
      </template>
      <span v-else class="grid grid-cols-3 gap-1">
        <span
          v-for="(build, index) in item.pokemon"
          :key="index"
          class="text-muted-foreground flex min-w-0 flex-col items-center text-center text-xs leading-tight"
        >
          <Sprite :species="build.species" surface="team-row-grouped" />
          <span class="w-full truncate">{{ build.names.species }}</span>
        </span>
      </span>
    </template>

    <template #detailed="{ item }">
      <span class="flex items-start justify-between" :class="wide ? 'gap-2' : 'gap-3'">
        <span class="min-w-0 font-semibold break-words">{{ item.name }}</span>
        <span class="flex shrink-0 flex-wrap justify-end gap-1.5">
          <LegalityBadge :legality="item.legality" />
          <Badge variant="secondary">Reg {{ item.regulation }}</Badge>
        </span>
      </span>
      <ul
        v-if="spriteStyle !== 'stacked-tiles'"
        class="flex flex-wrap gap-1.5"
        :aria-label="`Pokémon in ${item.name}`"
      >
        <li
          v-for="(build, index) in item.pokemon"
          :key="index"
          class="bg-muted text-muted-foreground flex items-center gap-1 rounded"
          :class="wide ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-sm'"
        >
          <Sprite :species="build.species" surface="team-row-detailed" />
          {{ build.names.species }}
        </li>
      </ul>
      <ul
        v-else
        class="grid grid-cols-3 gap-1.5"
        :class="{ 'sm:grid-cols-6': !wide }"
        :aria-label="`Pokémon in ${item.name}`"
      >
        <li
          v-for="(build, index) in item.pokemon"
          :key="index"
          class="bg-muted text-muted-foreground flex min-w-0 flex-col items-center rounded p-1 text-center text-xs"
        >
          <Sprite :species="build.species" surface="team-row-detailed" />
          <span class="w-full truncate">{{ build.names.species }}</span>
        </li>
      </ul>
    </template>
  </ListRows>
</template>

<script setup lang="ts">
import { type ListStyle, type OpponentView, formatRecord, groupOpponents } from '@myvgc/core/schema'

// The rows of the Opponents list, and what a row shows in each List style. Compact: the
// display name and Head-to-head record. Grouped: those, then the Aliases and Round count.
// Detailed: display name and Aliases, with the Head-to-head record and Round count beside them.
defineProps<{
  opponents: OpponentView[]
  listStyle: ListStyle
  wide: boolean
  searching: boolean
}>()

// Typed here: passing the generic core function straight to ListRows broke CI's typecheck.
const groupBy = (items: OpponentView[]) => groupOpponents(items)

const rounds = ({ roundCount }: OpponentView) =>
  roundCount === 1 ? '1 Round' : `${roundCount} Rounds`
</script>

<template>
  <ListRows
    :items="opponents"
    :list-style="listStyle"
    :wide="wide"
    base="/opponents"
    :group-by="groupBy"
    :searching="searching"
    data-testid="opponents-list"
  >
    <template #compact="{ item }">
      <span class="min-w-0 truncate">{{ item.displayName }}</span>
      <span class="text-muted-foreground shrink-0">{{ formatRecord(item.headToHead) }}</span>
    </template>

    <template #grouped="{ item }">
      <span class="flex justify-between gap-2">
        <span class="truncate font-medium">{{ item.displayName }}</span>
        <span class="shrink-0">{{ formatRecord(item.headToHead) }}</span>
      </span>
      <span class="text-muted-foreground truncate text-xs">{{
        [...item.aliases, rounds(item)].join(' · ')
      }}</span>
    </template>

    <template #detailed="{ item }">
      <span class="flex items-start justify-between gap-3">
        <span class="flex min-w-0 flex-col">
          <span class="font-medium break-words">{{ item.displayName }}</span>
          <span v-if="item.aliases.length" class="text-muted-foreground truncate text-xs">{{
            item.aliases.join(', ')
          }}</span>
        </span>
        <span class="shrink-0 text-right text-sm">
          <span class="font-medium">{{ formatRecord(item.headToHead) }}</span>
          <span class="text-muted-foreground block text-xs">{{ rounds(item) }}</span>
        </span>
      </span>
    </template>
  </ListRows>
</template>

<script setup lang="ts">
import { type ListStyle, type OpponentView, formatRecord } from '@myvgc/core/schema'

// What an Opponent's row shows in each List style. Compact: the display name and Head-to-head
// record. Grouped: those, then the Aliases and Round count. Detailed: display name and Aliases,
// with the Head-to-head record and Round count beside them.
const props = defineProps<{ opponent: OpponentView; listStyle: ListStyle }>()

const rounds = computed(() =>
  props.opponent.roundCount === 1 ? '1 Round' : `${props.opponent.roundCount} Rounds`,
)
</script>

<template>
  <template v-if="listStyle === 'compact'">
    <span class="min-w-0 truncate">{{ opponent.displayName }}</span>
    <span class="text-muted-foreground shrink-0">{{ formatRecord(opponent.headToHead) }}</span>
  </template>

  <template v-else-if="listStyle === 'grouped'">
    <span class="flex justify-between gap-2">
      <span class="truncate font-medium">{{ opponent.displayName }}</span>
      <span class="shrink-0">{{ formatRecord(opponent.headToHead) }}</span>
    </span>
    <span class="text-muted-foreground truncate text-xs">{{
      [...opponent.aliases, rounds].join(' · ')
    }}</span>
  </template>

  <span v-else class="flex items-start justify-between gap-3">
    <span class="flex min-w-0 flex-col">
      <span class="font-medium break-words">{{ opponent.displayName }}</span>
      <span v-if="opponent.aliases.length" class="text-muted-foreground truncate text-xs">{{
        opponent.aliases.join(', ')
      }}</span>
    </span>
    <span class="shrink-0 text-right text-sm">
      <span class="font-medium">{{ formatRecord(opponent.headToHead) }}</span>
      <span class="text-muted-foreground block text-xs">{{ rounds }}</span>
    </span>
  </span>
</template>

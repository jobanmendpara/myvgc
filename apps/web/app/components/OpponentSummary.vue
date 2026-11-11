<script setup lang="ts">
import { type OpponentView, formatRecord } from '@myvgc/core/schema'

// What an Opponent's list row shows: display name, Aliases, Head-to-head record and Round count.
defineProps<{ opponent: OpponentView }>()
</script>

<template>
  <span class="flex min-w-0 flex-col">
    <span class="font-medium break-words">{{ opponent.displayName }}</span>
    <span v-if="opponent.aliases.length" class="text-muted-foreground truncate text-xs">{{
      opponent.aliases.join(', ')
    }}</span>
  </span>
  <span class="shrink-0 text-right text-sm">
    <span class="font-medium">{{ formatRecord(opponent.headToHead) }}</span>
    <span class="text-muted-foreground block text-xs">{{
      opponent.roundCount === 1 ? '1 Round' : `${opponent.roundCount} Rounds`
    }}</span>
  </span>
</template>

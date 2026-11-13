<script setup lang="ts">
import type { Counted, CountedRound } from '@myvgc/core/schema'
import { countedListing, roundLabel } from '@/lib/format'

// The Rounds or Games behind a Statistics row, each linking to its Round. A Round shows its
// Opponent and Round result; a Game shows its number and Game result.
const props = defineProps<{
  counted: Counted[]
  /** The Rounds the Statistics endpoint answered with, by id. */
  rounds: Record<string, CountedRound>
}>()

const items = computed(() => countedListing(props.counted, props.rounds))
</script>

<template>
  <ol class="flex flex-col divide-y">
    <li v-for="item in items" :key="item.key">
      <NuxtLink
        :to="`/tournaments/${item.round.tournament.id}/rounds/${item.round.id}`"
        class="hover:bg-muted/50 focus-visible:ring-ring/50 flex items-start justify-between gap-3 rounded px-2 py-1.5 outline-none focus-visible:ring-3"
      >
        <span class="flex min-w-0 flex-col">
          <span class="break-words"
            >{{ item.round.tournament.name }}, {{ roundLabel(item.round)
            }}<template v-if="item.game">, Game {{ item.game }}</template></span
          >
          <span class="text-muted-foreground text-xs break-words"
            >vs {{ item.round.opponent?.displayName ?? 'Unknown' }}</span
          >
        </span>
        <span class="shrink-0 font-semibold">{{ item.result }}</span>
      </NuxtLink>
    </li>
  </ol>
</template>

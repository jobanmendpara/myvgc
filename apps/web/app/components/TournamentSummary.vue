<script setup lang="ts">
import { EVENT_TIER_LABELS, type TournamentView, formatRecord } from '@myvgc/core/schema'
import { formatDates, ordinal } from '@/lib/format'

// What a Tournament's card or list row shows: name, dates, Event tier, Regulation, Record and
// Placement. `condensed` tightens it for a row in the list column.
defineProps<{ tournament: TournamentView; condensed?: boolean }>()
</script>

<template>
  <span class="flex items-start justify-between" :class="condensed ? 'gap-2' : 'gap-3'">
    <span class="min-w-0 font-semibold break-words">{{ tournament.name }}</span>
    <Badge v-if="tournament.upcoming" class="shrink-0">Upcoming</Badge>
  </span>
  <span
    class="text-muted-foreground flex flex-wrap gap-y-1"
    :class="condensed ? 'gap-x-2 text-xs' : 'gap-x-3 text-sm'"
  >
    <span>{{ formatDates(tournament.startDate, tournament.endDate) }}</span>
    <span>{{ EVENT_TIER_LABELS[tournament.eventTier] }}</span>
    <span>Reg {{ tournament.regulation }}</span>
  </span>
  <span
    v-if="tournament.rounds.length || tournament.placement"
    class="flex flex-wrap"
    :class="condensed ? 'gap-x-2' : 'gap-x-3 text-sm'"
  >
    <span v-if="tournament.rounds.length">{{ formatRecord(tournament.record.swiss) }}</span>
    <span
      v-if="
        tournament.record.topCut.wins +
        tournament.record.topCut.losses +
        tournament.record.topCut.ties
      "
      >Top cut {{ formatRecord(tournament.record.topCut) }}</span
    >
    <span v-if="tournament.placement" class="font-medium"
      >{{ ordinal(tournament.placement)
      }}<template v-if="tournament.playerCount"> of {{ tournament.playerCount }}</template></span
    >
  </span>
</template>

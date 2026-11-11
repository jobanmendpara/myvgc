<script setup lang="ts">
import {
  EVENT_TIER_LABELS,
  type ListStyle,
  type TournamentView,
  formatRecord,
} from '@myvgc/core/schema'
import { formatDates, ordinal } from '@/lib/format'

// What a Tournament's row shows in each List style. Compact: the name and one fact (Upcoming,
// Placement or Record). Grouped: the name, then dates, Record and Placement; the heading already
// says Upcoming or the year. Detailed: name, dates, Event tier, Regulation, Record and
// Placement, with `condensed` tightening it for the list column.
const props = defineProps<{
  tournament: TournamentView
  listStyle: ListStyle
  condensed?: boolean
}>()

const record = computed(() =>
  props.tournament.rounds.length ? formatRecord(props.tournament.record.swiss) : '',
)
const fact = computed(() => {
  const t = props.tournament
  if (t.upcoming) return 'Upcoming'
  return t.placement ? ordinal(t.placement) : record.value
})
const recordAndPlacement = computed(() =>
  [record.value, props.tournament.placement ? ordinal(props.tournament.placement) : '']
    .filter(Boolean)
    .join(' · '),
)
</script>

<template>
  <template v-if="listStyle === 'compact'">
    <span class="min-w-0 truncate">{{ tournament.name }}</span>
    <span class="text-muted-foreground shrink-0">{{ fact }}</span>
  </template>

  <template v-else-if="listStyle === 'grouped'">
    <span class="truncate font-medium">{{ tournament.name }}</span>
    <span class="text-muted-foreground flex justify-between gap-2 text-xs">
      <span>{{ formatDates(tournament.startDate, tournament.endDate) }}</span>
      <span class="shrink-0">{{ recordAndPlacement }}</span>
    </span>
  </template>

  <template v-else>
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
      <span v-if="tournament.rounds.length">{{ record }}</span>
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
</template>

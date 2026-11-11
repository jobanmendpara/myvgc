<script setup lang="ts">
import {
  EVENT_TIER_LABELS,
  type ListStyle,
  type TournamentView,
  formatRecord,
  groupTournaments,
} from '@myvgc/core/schema'
import { formatDates, ordinal } from '@/lib/format'

// The rows of the Tournaments list, and what a row shows in each List style. Compact: the name
// and one fact (Upcoming, Placement or Record). Grouped: the name, then dates, Record and
// Placement; the heading already says Upcoming or the year. Detailed: name, dates, Event tier,
// Regulation, Record and Placement, tighter on wide screens.
defineProps<{
  tournaments: TournamentView[]
  listStyle: ListStyle
  wide: boolean
  searching: boolean
}>()

// Typed here: passing the generic core function straight to ListRows broke CI's typecheck.
const groupBy = (items: TournamentView[]) => groupTournaments(items)

const record = (tournament: TournamentView) =>
  tournament.rounds.length ? formatRecord(tournament.record.swiss) : ''
const placement = (tournament: TournamentView) =>
  tournament.placement ? ordinal(tournament.placement) : ''
const recordAndPlacement = (tournament: TournamentView) =>
  [record(tournament), placement(tournament)].filter(Boolean).join(' · ')
const hasTopCut = ({ record }: TournamentView) =>
  record.topCut.wins + record.topCut.losses + record.topCut.ties > 0
</script>

<template>
  <ListRows
    :items="tournaments"
    :list-style="listStyle"
    :wide="wide"
    base="/tournaments"
    :group-by="groupBy"
    :searching="searching"
    data-testid="tournaments-list"
  >
    <template #compact="{ item }">
      <span class="min-w-0 truncate">{{ item.name }}</span>
      <span class="text-muted-foreground shrink-0">{{
        item.upcoming ? 'Upcoming' : placement(item) || record(item)
      }}</span>
    </template>

    <template #grouped="{ item }">
      <span class="truncate font-medium">{{ item.name }}</span>
      <span class="text-muted-foreground flex justify-between gap-2 text-xs">
        <span>{{ formatDates(item.startDate, item.endDate) }}</span>
        <span class="shrink-0">{{ recordAndPlacement(item) }}</span>
      </span>
    </template>

    <template #detailed="{ item }">
      <span class="flex items-start justify-between" :class="wide ? 'gap-2' : 'gap-3'">
        <span class="min-w-0 font-semibold break-words">{{ item.name }}</span>
        <Badge v-if="item.upcoming" class="shrink-0">Upcoming</Badge>
      </span>
      <span
        class="text-muted-foreground flex flex-wrap gap-y-1"
        :class="wide ? 'gap-x-2 text-xs' : 'gap-x-3 text-sm'"
      >
        <span>{{ formatDates(item.startDate, item.endDate) }}</span>
        <span>{{ EVENT_TIER_LABELS[item.eventTier] }}</span>
        <span>Reg {{ item.regulation }}</span>
      </span>
      <span
        v-if="item.rounds.length || item.placement"
        class="flex flex-wrap"
        :class="wide ? 'gap-x-2' : 'gap-x-3 text-sm'"
      >
        <span v-if="item.rounds.length">{{ record(item) }}</span>
        <span v-if="hasTopCut(item)">Top cut {{ formatRecord(item.record.topCut) }}</span>
        <span v-if="item.placement" class="font-medium"
          >{{ ordinal(item.placement)
          }}<template v-if="item.playerCount"> of {{ item.playerCount }}</template></span
        >
      </span>
    </template>
  </ListRows>
</template>

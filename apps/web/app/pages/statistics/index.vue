<script setup lang="ts">
import {
  type BringRateRow,
  type StatisticsRow,
  type StatisticsView,
  type TeamView,
  describeCoverage,
} from '@myvgc/core/schema'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import type { StatisticsTableRow } from '@/components/StatisticsTable.vue'

useHead({ title: 'Statistics · MyVGC' })

// Online-only, like the dashboard (ADR 17): offline, the last view loaded stays on screen.
const { query, setFilters } = useFilterQuery(['team'])
const view = useQuery({
  queryKey: computed(() => ['statistics', query.value]),
  queryFn: () => $fetch<StatisticsView>('/api/statistics', { query: query.value }),
  placeholderData: keepPreviousData,
})
const filters = computed(() => view.data.value?.filters)
const stats = computed(() => view.data.value?.statistics)
const teams = useQuery({ queryKey: ['teams'], queryFn: () => $fetch<TeamView[]>('/api/teams') })

// The response holds species IDs; names come from the cached names list (ADR 14, ADR 17).
const names = useChampionsNames()
const speciesName = (id: string) => names.data.value?.species[id] ?? id
const rowsOf = (rows: (StatisticsRow<string> | BringRateRow)[]): StatisticsTableRow[] =>
  rows.map((row) => ({ ...row, key: row.species, name: speciesName(row.species) }))
const pairRows = (rows: StatisticsRow<[string, string]>[]): StatisticsTableRow[] =>
  rows.map((row) => ({
    ...row,
    key: row.species.join(' '),
    name: row.species.map(speciesName).join(' + '),
  }))
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-2xl font-semibold">Statistics</h1>

    <DashboardFilters :query="query" :applied="filters" @change="setFilters">
      <div class="flex flex-col gap-1.5">
        <Label for="filter-team" class="text-xs">Team</Label>
        <NativeSelect
          id="filter-team"
          :model-value="query.team ?? ''"
          class="w-full sm:w-48"
          @change="
            (e: Event) => setFilters({ team: (e.target as HTMLSelectElement).value || undefined })
          "
        >
          <NativeSelectOption value="">Any Team</NativeSelectOption>
          <NativeSelectOption
            v-for="team in teams.data.value ?? []"
            :key="team.id"
            :value="team.id"
            >{{ team.name }}</NativeSelectOption
          >
        </NativeSelect>
      </div>
    </DashboardFilters>

    <p v-if="view.isPending.value" class="text-muted-foreground">Loading…</p>
    <Alert v-else-if="view.isError.value" variant="destructive" role="alert">
      <AlertDescription
        >Couldn't load your Statistics. Check your connection and try again.</AlertDescription
      >
    </Alert>

    <!-- Each row pairs the User's side of a Game with the Opponent's. -->
    <div v-else-if="stats" class="grid items-start gap-8 lg:grid-cols-2">
      <StatisticsTable
        title="Species faced"
        unit="Rounds"
        name-heading="Species"
        :rows="rowsOf(stats.speciesFaced.rows)"
        :rounds="stats.rounds"
        :coverage="describeCoverage(stats.speciesFaced.coverage, 'Rounds')"
        data-testid="species-faced"
      />
      <StatisticsTable
        title="Brought from Opponent’s Teams"
        measure="bringRate"
        unit="Games"
        name-heading="Species"
        :rows="rowsOf(stats.bringRates.rows)"
        :rounds="stats.rounds"
        :coverage="describeCoverage(stats.bringRates.coverage, 'Games')"
      />
      <StatisticsTable
        title="Your Brought Pokémon"
        unit="Games"
        name-heading="Species"
        :rows="rowsOf(stats.brought.rows)"
        :rounds="stats.rounds"
        :coverage="describeCoverage(stats.brought.coverage, 'Games')"
      />
      <StatisticsTable
        title="Opponent’s Brought Pokémon"
        unit="Games"
        name-heading="Species"
        :rows="rowsOf(stats.opponentBrought.rows)"
        :rounds="stats.rounds"
        :coverage="describeCoverage(stats.opponentBrought.coverage, 'Games')"
      />
      <StatisticsTable
        title="Your Lead pairs"
        unit="Games"
        name-heading="Leads"
        :rows="pairRows(stats.leadPairs.rows)"
        :rounds="stats.rounds"
        :coverage="describeCoverage(stats.leadPairs.coverage, 'Games')"
      />
      <StatisticsTable
        title="Opponent’s Lead pairs"
        unit="Games"
        name-heading="Leads"
        :rows="pairRows(stats.opponentLeadPairs.rows)"
        :rounds="stats.rounds"
        :coverage="describeCoverage(stats.opponentLeadPairs.coverage, 'Games')"
      />
      <StatisticsTable
        title="Your single Leads"
        unit="Games"
        name-heading="Lead"
        :rows="rowsOf(stats.leads.rows)"
        :rounds="stats.rounds"
        :coverage="describeCoverage(stats.leads.coverage, 'Games')"
      />
      <StatisticsTable
        title="Opponent’s single Leads"
        unit="Games"
        name-heading="Lead"
        :rows="rowsOf(stats.opponentLeads.rows)"
        :rounds="stats.rounds"
        :coverage="describeCoverage(stats.opponentLeads.coverage, 'Games')"
      />
    </div>
  </div>
</template>

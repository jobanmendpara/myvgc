<script setup lang="ts">
import type { StatisticsView, TeamView } from '@myvgc/core/schema'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { statisticsTables } from '@/lib/statistics-tables'

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
const tables = computed(() => stats.value && statisticsTables(stats.value, speciesName))
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
    <div v-else-if="stats && tables" class="grid items-start gap-8 lg:grid-cols-2">
      <StatisticsTable
        v-for="table in tables"
        :key="table.title"
        :table="table"
        :rounds="stats.rounds"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TeamView } from '@myvgc/core/schema'
import { searchTeams } from '@myvgc/core/search'
import { useQuery } from '@tanstack/vue-query'
import { teamRows } from '@/lib/outbox-view'

definePageMeta({ listDetail: true })
useHead({ title: 'Your Teams · MyVGC' })

const teams = useQuery({ queryKey: ['teams'], queryFn: () => $fetch<TeamView[]>('/api/teams') })
// Kept on the phone first, so a Team can be built, changed or deleted with no signal too (ADR 17).
// One deleted on this phone stays in the list, struck through, until the server has it.
const outbox = useOutbox()
const shown = computed(() =>
  teams.data.value ? teamRows(teams.data.value, outbox.state.value) : undefined,
)
const { query, searching, results, noMatches } = useListSearch(
  'teams',
  () => shown.value,
  (items: TeamView[], q: string) => searchTeams(items, q),
)
</script>

<template>
  <ListDetail base="/teams" placeholder="Select a Team">
    <template #list="{ wide }">
      <ListColumn
        v-model:query="query"
        list="teams"
        title="Your Teams"
        noun="Teams"
        search-placeholder="Find by name or Pokémon"
        :wide="wide"
        :pending="teams.isPending.value"
        :load-failed="teams.isError.value && !teams.data.value"
        :empty="teams.data.value?.length === 0"
        :no-matches="noMatches"
      >
        <template #actions>
          <Button v-if="teams.data.value?.length" as-child :size="wide ? 'sm' : 'default'">
            <NuxtLink to="/teams/new">{{ wide ? 'New' : 'New Team' }}</NuxtLink>
          </Button>
        </template>

        <template #empty>
          <Card data-testid="teams-empty">
            <CardHeader>
              <CardTitle>No Teams yet</CardTitle>
              <CardDescription>Import a Team from Showdown or build one here.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button as-child size="lg" class="w-full sm:w-auto">
                <NuxtLink to="/teams/new">Add your first Team</NuxtLink>
              </Button>
            </CardFooter>
          </Card>
        </template>

        <template #default="{ listStyle }">
          <TeamRows :teams="results" :list-style="listStyle" :wide="wide" :searching="searching" />
        </template>
      </ListColumn>
    </template>
    <NuxtPage />
  </ListDetail>
</template>

<script setup lang="ts">
import type { TournamentView } from '@myvgc/core/schema'
import { searchTournaments } from '@myvgc/core/search'
import { useQuery } from '@tanstack/vue-query'

definePageMeta({ listDetail: true })
useHead({ title: 'Your Tournaments · MyVGC' })

const tournaments = useQuery({
  queryKey: ['tournaments'],
  queryFn: () => $fetch<TournamentView[]>('/api/tournaments'),
})
const { query, searching, results, noMatches } = useListSearch(
  'tournaments',
  () => tournaments.data.value,
  (items: TournamentView[], q: string) => searchTournaments(items, q),
)
</script>

<template>
  <ListDetail base="/tournaments" placeholder="Select a Tournament">
    <template #list="{ wide }">
      <ListColumn
        v-model:query="query"
        list="tournaments"
        title="Your Tournaments"
        noun="Tournaments"
        search-placeholder="Find by name, Organizer or location"
        :wide="wide"
        :pending="tournaments.isPending.value"
        :load-failed="tournaments.isError.value"
        :empty="tournaments.data.value?.length === 0"
        :no-matches="noMatches"
      >
        <template #actions>
          <Button v-if="tournaments.data.value?.length" as-child :size="wide ? 'sm' : 'default'">
            <NuxtLink to="/tournaments/new">{{ wide ? 'New' : 'New Tournament' }}</NuxtLink>
          </Button>
        </template>

        <template #empty>
          <Card data-testid="tournaments-empty">
            <CardHeader>
              <CardTitle>No Tournaments yet</CardTitle>
              <CardDescription
                >Log an event you went to, or one you've signed up for.</CardDescription
              >
            </CardHeader>
            <CardFooter>
              <Button as-child size="lg" class="w-full sm:w-auto">
                <NuxtLink to="/tournaments/new">Log your first Tournament</NuxtLink>
              </Button>
            </CardFooter>
          </Card>
        </template>

        <template #default="{ listStyle }">
          <TournamentRows
            :tournaments="results"
            :list-style="listStyle"
            :wide="wide"
            :searching="searching"
          />
        </template>
      </ListColumn>
    </template>
    <NuxtPage />
  </ListDetail>
</template>

<script setup lang="ts">
import { type TournamentView, groupTournaments } from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'

definePageMeta({ listDetail: true })
useHead({ title: 'Your Tournaments · MyVGC' })

const tournaments = useQuery({
  queryKey: ['tournaments'],
  queryFn: () => $fetch<TournamentView[]>('/api/tournaments'),
})
const groupBy = (items: TournamentView[]) => groupTournaments(items)

// The Tournament open in the pane, also while editing it or one of its Rounds.
const route = useRoute()
const selectedId = computed(() => ('id' in route.params ? String(route.params.id) : ''))
</script>

<template>
  <ListDetail base="/tournaments" placeholder="Select a Tournament">
    <template #list="{ wide }">
      <ListColumn
        list="tournaments"
        title="Your Tournaments"
        :wide="wide"
        :pending="tournaments.isPending.value"
        :error="
          tournaments.isError.value
            ? `Couldn't load your Tournaments. Check your connection and try again.`
            : undefined
        "
        :empty="tournaments.data.value?.length === 0"
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
          <ListRows
            :items="tournaments.data.value ?? []"
            :list-style="listStyle"
            :wide="wide"
            :selected-id="selectedId"
            base="/tournaments"
            :group-by="groupBy"
            data-testid="tournaments-list"
          >
            <template #default="{ item }">
              <TournamentSummary :tournament="item" :list-style="listStyle" :condensed="wide" />
            </template>
          </ListRows>
        </template>
      </ListColumn>
    </template>
    <NuxtPage />
  </ListDetail>
</template>

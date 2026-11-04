<script setup lang="ts">
import { EVENT_TIER_LABELS, type TournamentView } from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'
import { FetchError } from 'ofetch'
import { formatDates } from '@/lib/format'

const route = useRoute()
const id = computed(() => String(route.params.id))

const query = useQuery({
  queryKey: computed(() => ['tournament', id.value]),
  queryFn: () => $fetch<TournamentView>(`/api/tournaments/${id.value}`),
  retry: (count, error) => !(error instanceof FetchError && error.statusCode === 404) && count < 1,
})
const tournament = query.data
const notFound = computed(
  () => query.error.value instanceof FetchError && query.error.value.statusCode === 404,
)

useHead({
  title: computed(() =>
    tournament.value ? `${tournament.value.name} · MyVGC` : 'Tournament · MyVGC',
  ),
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <NuxtLink to="/tournaments" class="text-muted-foreground text-sm hover:underline"
      >← Your Tournaments</NuxtLink
    >

    <p v-if="query.isPending.value" class="text-muted-foreground">Loading…</p>

    <Card v-else-if="notFound">
      <CardHeader>
        <CardTitle>Tournament not found</CardTitle>
        <CardDescription>It may have been deleted.</CardDescription>
      </CardHeader>
    </Card>

    <Alert v-else-if="query.isError.value" variant="destructive" role="alert">
      <AlertDescription
        >Couldn't load this Tournament. Check your connection and try again.</AlertDescription
      >
    </Alert>

    <template v-else-if="tournament">
      <header class="flex flex-col gap-2">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <h1 class="min-w-0 text-2xl font-semibold break-words" data-testid="tournament-name">
            {{ tournament.name }}
          </h1>
          <Badge v-if="tournament.upcoming">Upcoming</Badge>
        </div>
        <dl class="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <div>
            <dt class="sr-only">Dates</dt>
            <dd>{{ formatDates(tournament.startDate, tournament.endDate) }}</dd>
          </div>
          <div>
            <dt class="sr-only">Event tier</dt>
            <dd>{{ EVENT_TIER_LABELS[tournament.eventTier] }}</dd>
          </div>
          <div>
            <dt class="sr-only">Regulation</dt>
            <dd>Reg {{ tournament.regulation }}</dd>
          </div>
          <div>
            <dt class="sr-only">Where</dt>
            <dd>
              {{ tournament.online ? 'Online' : 'In person'
              }}<template v-if="tournament.location"> · {{ tournament.location }}</template>
            </dd>
          </div>
          <div>
            <dt class="sr-only">Best of</dt>
            <dd>Best of {{ tournament.defaultBestOf }}</dd>
          </div>
        </dl>
      </header>

      <section v-if="tournament.notes" aria-labelledby="notes-title" class="flex flex-col gap-2">
        <h2 id="notes-title" class="font-semibold">Notes</h2>
        <p class="text-sm whitespace-pre-wrap">{{ tournament.notes }}</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { EVENT_TIER_LABELS, type TournamentView, formatRecord } from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'
import { formatDates, ordinal } from '@/lib/format'

useHead({ title: 'Your Tournaments · MyVGC' })

const tournaments = useQuery({
  queryKey: ['tournaments'],
  queryFn: () => $fetch<TournamentView[]>('/api/tournaments'),
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold">Your Tournaments</h1>
      <Button v-if="tournaments.data.value?.length" as-child>
        <NuxtLink to="/tournaments/new">New Tournament</NuxtLink>
      </Button>
    </div>

    <p v-if="tournaments.isPending.value" class="text-muted-foreground">Loading…</p>

    <Alert v-else-if="tournaments.isError.value" variant="destructive" role="alert">
      <AlertDescription
        >Couldn't load your Tournaments. Check your connection and try again.</AlertDescription
      >
    </Alert>

    <Card v-else-if="tournaments.data.value?.length === 0" data-testid="tournaments-empty">
      <CardHeader>
        <CardTitle>No Tournaments yet</CardTitle>
        <CardDescription>Log an event you went to, or one you've signed up for.</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button as-child size="lg" class="w-full sm:w-auto">
          <NuxtLink to="/tournaments/new">Log your first Tournament</NuxtLink>
        </Button>
      </CardFooter>
    </Card>

    <ul
      v-else
      class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
      data-testid="tournaments-list"
    >
      <li v-for="t in tournaments.data.value" :key="t.id">
        <NuxtLink
          :to="`/tournaments/${t.id}`"
          class="hover:bg-muted/50 focus-visible:ring-ring/50 flex h-full flex-col gap-2 rounded-lg border p-4 outline-none focus-visible:ring-3"
        >
          <div class="flex items-start justify-between gap-3">
            <span class="min-w-0 font-semibold break-words">{{ t.name }}</span>
            <Badge v-if="t.upcoming" class="shrink-0">Upcoming</Badge>
          </div>
          <div class="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <span>{{ formatDates(t.startDate, t.endDate) }}</span>
            <span>{{ EVENT_TIER_LABELS[t.eventTier] }}</span>
            <span>Reg {{ t.regulation }}</span>
          </div>
          <div v-if="t.rounds.length || t.placement" class="flex flex-wrap gap-x-3 text-sm">
            <span v-if="t.rounds.length">{{ formatRecord(t.record.swiss) }}</span>
            <span v-if="t.record.topCut.wins + t.record.topCut.losses + t.record.topCut.ties"
              >Top cut {{ formatRecord(t.record.topCut) }}</span
            >
            <span v-if="t.placement" class="font-medium"
              >{{ ordinal(t.placement)
              }}<template v-if="t.playerCount"> of {{ t.playerCount }}</template></span
            >
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

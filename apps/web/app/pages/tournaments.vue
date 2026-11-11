<script setup lang="ts">
import type { TournamentView } from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'

definePageMeta({ listDetail: true })
useHead({ title: 'Your Tournaments · MyVGC' })

const tournaments = useQuery({
  queryKey: ['tournaments'],
  queryFn: () => $fetch<TournamentView[]>('/api/tournaments'),
})

// The Tournament open in the pane, also while editing it or one of its Rounds.
const route = useRoute()
const selectedId = computed(() => ('id' in route.params ? String(route.params.id) : ''))
</script>

<template>
  <ListDetail base="/tournaments" placeholder="Select a Tournament">
    <template #list="{ wide }">
      <div :class="wide ? 'flex flex-col' : 'flex flex-col gap-6'">
        <div
          class="flex flex-wrap items-center justify-between gap-3"
          :class="{ 'bg-background sticky top-0 z-10 border-b p-3': wide }"
        >
          <h1 :class="wide ? 'text-lg font-semibold' : 'text-2xl font-semibold'">
            Your Tournaments
          </h1>
          <Button v-if="tournaments.data.value?.length" as-child :size="wide ? 'sm' : 'default'">
            <NuxtLink to="/tournaments/new">{{ wide ? 'New' : 'New Tournament' }}</NuxtLink>
          </Button>
        </div>

        <div :class="{ 'p-2': wide }">
          <p
            v-if="tournaments.isPending.value"
            class="text-muted-foreground"
            :class="{ 'p-1': wide }"
          >
            Loading…
          </p>

          <Alert v-else-if="tournaments.isError.value" variant="destructive" role="alert">
            <AlertDescription
              >Couldn't load your Tournaments. Check your connection and try
              again.</AlertDescription
            >
          </Alert>

          <Card v-else-if="tournaments.data.value?.length === 0" data-testid="tournaments-empty">
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

          <!-- Rows for the list column; the List style control (DEV-88) will choose these. -->
          <ul v-else-if="wide" class="flex flex-col gap-1" data-testid="tournaments-list">
            <li v-for="t in tournaments.data.value" :key="t.id">
              <NuxtLink
                :to="`/tournaments/${t.id}`"
                :aria-current="t.id === selectedId ? 'page' : undefined"
                class="hover:bg-muted/50 focus-visible:ring-ring/50 aria-[current=page]:border-primary aria-[current=page]:bg-card aria-[current=page]:ring-primary flex flex-col gap-1.5 rounded-lg border border-transparent p-3 text-sm outline-none focus-visible:ring-3 aria-[current=page]:shadow-sm aria-[current=page]:ring-1"
              >
                <TournamentSummary :tournament="t" condensed />
              </NuxtLink>
            </li>
          </ul>

          <ul v-else class="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="tournaments-list">
            <li v-for="t in tournaments.data.value" :key="t.id">
              <NuxtLink
                :to="`/tournaments/${t.id}`"
                class="hover:bg-muted/50 focus-visible:ring-ring/50 flex h-full flex-col gap-2 rounded-lg border p-4 outline-none focus-visible:ring-3"
              >
                <TournamentSummary :tournament="t" />
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>
    </template>
    <NuxtPage />
  </ListDetail>
</template>

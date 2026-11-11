<script setup lang="ts">
import type { TeamView } from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'

definePageMeta({ listDetail: true })
useHead({ title: 'Your Teams · MyVGC' })

const teams = useQuery({ queryKey: ['teams'], queryFn: () => $fetch<TeamView[]>('/api/teams') })

// The Team open in the pane, also while editing it.
const route = useRoute()
const selectedId = computed(() => ('id' in route.params ? String(route.params.id) : ''))
</script>

<template>
  <ListDetail base="/teams" placeholder="Select a Team">
    <template #list="{ wide }">
      <div :class="wide ? 'flex flex-col' : 'flex flex-col gap-6'">
        <div
          class="flex flex-wrap items-center justify-between gap-3"
          :class="{ 'bg-background sticky top-0 z-10 border-b p-3': wide }"
        >
          <h1 :class="wide ? 'text-lg font-semibold' : 'text-2xl font-semibold'">Your Teams</h1>
          <Button v-if="teams.data.value?.length" as-child :size="wide ? 'sm' : 'default'">
            <NuxtLink to="/teams/new">{{ wide ? 'New' : 'New Team' }}</NuxtLink>
          </Button>
        </div>

        <div :class="{ 'p-2': wide }">
          <p v-if="teams.isPending.value" class="text-muted-foreground" :class="{ 'p-1': wide }">
            Loading…
          </p>

          <Alert v-else-if="teams.isError.value" variant="destructive" role="alert">
            <AlertDescription
              >Couldn't load your Teams. Check your connection and try again.</AlertDescription
            >
          </Alert>

          <Card v-else-if="teams.data.value?.length === 0" data-testid="teams-empty">
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

          <!-- Rows for the list column; the List style control (DEV-88) will choose these. -->
          <ul v-else-if="wide" class="flex flex-col gap-1" data-testid="teams-list">
            <li v-for="team in teams.data.value" :key="team.id">
              <NuxtLink
                :to="`/teams/${team.id}`"
                :aria-current="team.id === selectedId ? 'page' : undefined"
                class="hover:bg-muted/50 focus-visible:ring-ring/50 aria-[current=page]:border-primary aria-[current=page]:bg-card aria-[current=page]:ring-primary flex flex-col gap-1.5 rounded-lg border border-transparent p-3 text-sm outline-none focus-visible:ring-3 aria-[current=page]:shadow-sm aria-[current=page]:ring-1"
              >
                <TeamSummary :team="team" condensed />
              </NuxtLink>
            </li>
          </ul>

          <ul v-else class="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="teams-list">
            <li v-for="team in teams.data.value" :key="team.id">
              <NuxtLink
                :to="`/teams/${team.id}`"
                class="hover:bg-muted/50 focus-visible:ring-ring/50 flex h-full flex-col gap-2 rounded-lg border p-4 outline-none focus-visible:ring-3"
              >
                <TeamSummary :team="team" />
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>
    </template>
    <NuxtPage />
  </ListDetail>
</template>

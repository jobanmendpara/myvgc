<script setup lang="ts">
import type { TeamView } from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'

useHead({ title: 'Your Teams · MyVGC' })

const teams = useQuery({ queryKey: ['teams'], queryFn: () => $fetch<TeamView[]>('/api/teams') })
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold">Your Teams</h1>
      <Button v-if="teams.data.value?.length" as-child>
        <NuxtLink to="/teams/new">New Team</NuxtLink>
      </Button>
    </div>

    <p v-if="teams.isPending.value" class="text-muted-foreground">Loading…</p>

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

    <ul v-else class="flex flex-col gap-3" data-testid="teams-list">
      <li v-for="team in teams.data.value" :key="team.id">
        <NuxtLink
          :to="`/teams/${team.id}`"
          class="hover:bg-muted/50 focus-visible:ring-ring/50 flex flex-col gap-2 rounded-lg border p-4 outline-none focus-visible:ring-3"
        >
          <div class="flex items-start justify-between gap-3">
            <span class="min-w-0 font-semibold break-words">{{ team.name }}</span>
            <div class="flex shrink-0 flex-wrap justify-end gap-1.5">
              <LegalityBadge :legality="team.legality" />
              <Badge variant="secondary">Reg {{ team.regulation }}</Badge>
            </div>
          </div>
          <ul class="flex flex-wrap gap-1.5" :aria-label="`Pokémon in ${team.name}`">
            <li
              v-for="(build, index) in team.pokemon"
              :key="index"
              class="bg-muted text-muted-foreground rounded px-2 py-0.5 text-sm"
            >
              {{ build.names.species }}
            </li>
          </ul>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { TeamView } from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'
import { FetchError } from 'ofetch'

// A minimal Team page; ticket 05 adds the full builds, copying the paste and deleting.
const route = useRoute()
const id = computed(() => String(route.params.id))

const teamQuery = useQuery({
  queryKey: computed(() => ['team', id.value]),
  queryFn: () => $fetch<TeamView>(`/api/teams/${id.value}`),
  retry: (count, error) => !(error instanceof FetchError && error.statusCode === 404) && count < 1,
})
const team = teamQuery.data
const notFound = computed(
  () => teamQuery.error.value instanceof FetchError && teamQuery.error.value.statusCode === 404,
)
const warnings = useImportWarnings(id.value)

useHead({ title: computed(() => (team.value ? `${team.value.name} · MyVGC` : 'Team · MyVGC')) })
</script>

<template>
  <div class="flex flex-col gap-6">
    <p v-if="teamQuery.isPending.value" class="text-muted-foreground">Loading…</p>

    <Card v-else-if="notFound">
      <CardHeader>
        <CardTitle>Team not found</CardTitle>
        <CardDescription>It may have been deleted, or the link is wrong.</CardDescription>
      </CardHeader>
      <CardFooter
        ><Button as-child variant="outline"
          ><NuxtLink to="/">Back home</NuxtLink></Button
        ></CardFooter
      >
    </Card>

    <Alert v-else-if="teamQuery.isError.value" variant="destructive" role="alert">
      <AlertDescription
        >Couldn't load this Team. Check your connection and try again.</AlertDescription
      >
    </Alert>

    <template v-else-if="team">
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="min-w-0 text-2xl font-semibold break-words" data-testid="team-name">
            {{ team.name }}
          </h1>
          <Badge variant="secondary">Reg {{ team.regulation }}</Badge>
        </div>
      </div>

      <Alert v-if="warnings.length" role="status" data-testid="import-warnings">
        <AlertTitle
          >Saved, with
          {{ warnings.length === 1 ? '1 line' : `${warnings.length} lines` }} ignored</AlertTitle
        >
        <AlertDescription>
          <ul class="flex flex-col gap-1">
            <li v-for="warning in warnings" :key="`${warning.line}:${warning.message}`">
              Line {{ warning.line }}: {{ warning.message }}
            </li>
          </ul>
          <Button variant="outline" size="sm" class="mt-2" @click="warnings = []">Dismiss</Button>
        </AlertDescription>
      </Alert>

      <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="team-pokemon">
        <li v-for="(build, index) in team.pokemon" :key="index" class="rounded-lg border p-3">
          <p class="font-medium break-words">
            {{
              build.nickname ? `${build.nickname} (${build.names.species})` : build.names.species
            }}
          </p>
          <p v-if="build.names.item" class="text-muted-foreground text-sm">
            @ {{ build.names.item }}
          </p>
        </li>
      </ul>

      <section v-if="team.notes" class="flex flex-col gap-1">
        <h2 class="font-medium">Notes</h2>
        <p class="text-sm whitespace-pre-wrap">{{ team.notes }}</p>
      </section>
    </template>
  </div>
</template>

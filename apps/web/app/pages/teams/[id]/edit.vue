<script setup lang="ts">
import type { TeamBody, TeamView } from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'
import { FetchError } from 'ofetch'

const route = useRoute()
const id = computed(() => String(route.params.id))

const teamQuery = useQuery({
  queryKey: computed(() => ['team', id.value]),
  queryFn: () => $fetch<TeamView>(`/api/teams/${id.value}`),
  retry: (count, error) => !(error instanceof FetchError && error.statusCode === 404) && count < 1,
})
useHead({
  title: computed(() =>
    teamQuery.data.value ? `Edit ${teamQuery.data.value.name} · MyVGC` : 'Edit Team · MyVGC',
  ),
})

function save(body: TeamBody) {
  // A plain string URL keeps Nuxt's route-typed $fetch from recursing through every route.
  const url: string = `/api/teams/${id.value}`
  return $fetch<TeamView>(url, { method: 'PUT', body })
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <h1 class="text-2xl font-semibold">Edit Team</h1>
    <p v-if="teamQuery.isPending.value" class="text-muted-foreground">Loading…</p>
    <TeamBuilder
      v-else-if="teamQuery.data.value"
      :initial="teamQuery.data.value"
      :save="save"
      :cancel-to="`/teams/${id}`"
    />
    <Alert v-else variant="destructive" role="alert">
      <AlertDescription>Couldn't load this Team.</AlertDescription>
    </Alert>
  </div>
</template>

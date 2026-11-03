<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'

interface Health {
  status: 'ok' | 'error'
}

const health = useQuery({
  queryKey: ['health'],
  queryFn: () => $fetch<Health>('/api/health').catch((): Health => ({ status: 'error' })),
})
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
    <Card>
      <CardHeader>
        <CardTitle class="text-2xl">MyVGC</CardTitle>
        <CardDescription
          >Track your Pokémon Champions teams, tournaments and opponents.</CardDescription
        >
      </CardHeader>
      <CardContent class="flex items-center justify-between gap-4">
        <span class="text-sm">Database</span>
        <Badge v-if="health.isPending.value" variant="outline" data-testid="db-status"
          >Checking…</Badge
        >
        <Badge
          v-else-if="health.data.value?.status === 'ok'"
          variant="secondary"
          data-testid="db-status"
        >
          Healthy
        </Badge>
        <Badge v-else variant="destructive" data-testid="db-status">Unavailable</Badge>
      </CardContent>
    </Card>
  </main>
</template>

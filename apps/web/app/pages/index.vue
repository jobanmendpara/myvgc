<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'

interface Me {
  id: string
  name: string
  email: string
  role: string | null
}

// A placeholder home page until the Teams list arrives (ticket 05).
const me = useQuery({ queryKey: ['me'], queryFn: () => $fetch<Me>('/api/me') })
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-2xl">Your Teams</CardTitle>
      <CardDescription
        >The list of your Teams comes next. You can already import one.</CardDescription
      >
    </CardHeader>
    <CardContent class="flex flex-wrap items-center justify-between gap-2">
      <span class="min-w-0 truncate text-sm" data-testid="signed-in-as">{{
        me.data.value?.email
      }}</span>
      <Badge v-if="me.data.value?.role === 'admin'" variant="secondary">Admin</Badge>
    </CardContent>
    <CardFooter>
      <Button as-child size="lg" class="w-full sm:w-auto"
        ><NuxtLink to="/teams/new">Import a Team</NuxtLink></Button
      >
    </CardFooter>
  </Card>
</template>

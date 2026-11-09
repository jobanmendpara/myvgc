<script setup lang="ts">
import type { TeamBody } from '@myvgc/core/schema'
import type { CreatedTeam } from '@/lib/api'

useHead({ title: 'Build a Team · MyVGC' })

async function save(body: TeamBody) {
  const { team } = await $fetch<CreatedTeam>('/api/teams', { method: 'POST', body })
  return team
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <h1 class="text-2xl font-semibold">Build a Team</h1>
    <TeamBuilder :save="save" cancel-to="/teams/new" />
  </div>
</template>

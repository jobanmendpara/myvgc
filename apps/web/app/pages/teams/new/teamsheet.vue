<script setup lang="ts">
import type { TeamBody } from '@myvgc/core/schema'
import { TEAM_FILE_TYPES } from '@/composables/useTeamReader'
import type { CreatedTeam } from '@/lib/api'

useHead({ title: 'Read a Teamsheet · MyVGC' })
const cancelTo = useNewTeamCancelTo()

const { online, fileInput, read, failure, choose } = useTeamReader()

async function save(body: TeamBody) {
  const { team } = await $fetch<CreatedTeam>('/api/teams', { method: 'POST', body })
  return team
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <div>
      <h1 class="text-2xl font-semibold">Read a Teamsheet</h1>
      <p class="text-muted-foreground text-sm">
        Choose a Teamsheet PDF filled in on teamsheet.gg. You can check and change everything before
        it's saved. The file isn't kept.
      </p>
    </div>

    <TeamBuilder
      v-if="read.data.value"
      :read="read.data.value"
      :save="save"
      :cancel-to="cancelTo"
    />

    <template v-else>
      <p v-if="!online" class="text-muted-foreground text-sm" role="status">
        Reading a Teamsheet needs a connection.
      </p>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button as-child variant="outline" size="lg"
          ><NuxtLink :to="cancelTo">Cancel</NuxtLink></Button
        >
        <input
          ref="fileInput"
          type="file"
          :accept="TEAM_FILE_TYPES"
          class="sr-only"
          data-testid="teamsheet-file"
          @change="choose"
        />
        <Button size="lg" :disabled="!online || read.isPending.value" @click="fileInput?.click()">
          {{ read.isPending.value ? 'Reading…' : 'Choose a PDF' }}
        </Button>
      </div>
      <Alert v-if="failure" variant="destructive" role="alert">
        <AlertDescription>{{ failure }}</AlertDescription>
      </Alert>
    </template>
  </div>
</template>

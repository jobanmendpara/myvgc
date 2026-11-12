<script setup lang="ts">
import type { TeamBody } from '@myvgc/core/schema'
import { TEAM_FILE_TYPES } from '@/composables/useTeamReader'
import type { CreatedTeam } from '@/lib/api'

// A fresh page per query, so going from a stored PDF to choosing one never keeps the old read.
definePageMeta({ key: (route) => route.fullPath })
useHead({ title: 'Read a Teamsheet · MyVGC' })
const route = useRoute()
// From a Tournament's page: read the Teamsheet PDF already stored there (ADR 27), not a new file.
const tournamentId = typeof route.query.tournament === 'string' ? route.query.tournament : ''
const newTeamCancelTo = useNewTeamCancelTo()
const cancelTo = computed(() =>
  tournamentId ? `/tournaments/${tournamentId}` : newTeamCancelTo.value,
)

const { online, fileInput, read, failure, choose, readStored } = useTeamReader(undefined, {
  tournamentId,
})

// Reads the stored PDF on opening, or as soon as the connection is back.
onMounted(() => {
  if (online.value) readStored()
})
watch(online, (now) => {
  if (now && read.isIdle.value) readStored()
})

async function save(body: TeamBody) {
  const { team } = await $fetch<CreatedTeam>('/api/teams', { method: 'POST', body })
  return team
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <div>
      <h1 class="text-2xl font-semibold">Read a Teamsheet</h1>
      <p v-if="tournamentId" class="text-muted-foreground text-sm">
        Reads the Teamsheet PDF kept with your Tournament. You can check and change everything
        before it's saved as a new Team. The PDF stays with the Tournament.
      </p>
      <p v-else class="text-muted-foreground text-sm">
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
        <Button
          v-if="tournamentId"
          size="lg"
          :disabled="!online || read.isPending.value"
          @click="readStored()"
        >
          {{ read.isPending.value ? 'Reading…' : 'Read the stored PDF' }}
        </Button>
        <template v-else>
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
        </template>
      </div>
      <Alert v-if="failure" variant="destructive" role="alert">
        <AlertDescription>{{ failure }}</AlertDescription>
      </Alert>
    </template>
  </div>
</template>

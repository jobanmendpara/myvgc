<script setup lang="ts">
import {
  MAX_TEAMSHEET_BYTES,
  type ReadTeamView,
  TEAMSHEET_TOO_LARGE,
  type TeamBody,
} from '@myvgc/core/schema'
import { useMutation } from '@tanstack/vue-query'
import { useOnline } from '@vueuse/core'
import { FetchError } from 'ofetch'
import type { CreatedTeam } from '@/lib/api'

useHead({ title: 'Read a Teamsheet · MyVGC' })

// Reading needs the API (ADR 24), so it's online only (ADR 17).
const online = useOnline()
const fileInput = ref<HTMLInputElement | null>(null)

const read = useMutation({
  mutationFn: (file: File) => {
    if (file.size > MAX_TEAMSHEET_BYTES) throw new Error(TEAMSHEET_TOO_LARGE)
    const body = new FormData()
    body.append('file', file)
    return $fetch<ReadTeamView>('/api/teams/read', { method: 'POST', body })
  },
  networkMode: 'always',
  onSettled: () => {
    if (fileInput.value) fileInput.value.value = ''
  },
})

const failure = computed(() => {
  const error = read.error.value
  if (!error) return ''
  if (error instanceof FetchError) {
    if (error.statusCode === 401) return 'Your session has ended. Log in again to read a Teamsheet.'
    if (error.data?.error) return error.data.error as string
    return "Couldn't read the file. Check your connection and try again."
  }
  return error.message
})

function chooseFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) read.mutate(file)
}

async function save(body: TeamBody) {
  const { team } = await $fetch<CreatedTeam>('/api/teams', { method: 'POST', body })
  return team
}
</script>

<template>
  <div class="flex flex-col gap-6">
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
      cancel-to="/teams/new"
    />

    <template v-else>
      <p v-if="!online" class="text-muted-foreground text-sm" role="status">
        Reading a Teamsheet needs a connection.
      </p>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button as-child variant="outline" size="lg"
          ><NuxtLink to="/teams/new">Cancel</NuxtLink></Button
        >
        <input
          ref="fileInput"
          type="file"
          accept="application/pdf,.pdf"
          class="sr-only"
          data-testid="teamsheet-file"
          @change="chooseFile"
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

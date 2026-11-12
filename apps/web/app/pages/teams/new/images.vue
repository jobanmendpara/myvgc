<script setup lang="ts">
import { MAX_TEAM_IMAGES, MAX_TEAM_IMAGE_MB, type TeamBody } from '@myvgc/core/schema'
import { TEAM_IMAGE_FILE_TYPES } from '@/composables/useTeamReader'
import type { CreatedTeam } from '@/lib/api'

useHead({ title: 'Read screenshots · MyVGC' })
const cancelTo = useNewTeamCancelTo()
const imageReading = useImageReading()
const { online, fileInput, read, failure, chooseImages } = useTeamReader()

async function save(body: TeamBody) {
  const { team } = await $fetch<CreatedTeam>('/api/teams', { method: 'POST', body })
  return team
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <div>
      <h1 class="text-2xl font-semibold">Read screenshots</h1>
      <p class="text-muted-foreground text-sm">
        Choose screenshots of a Replica Team or photos of a paper Teamsheet, up to
        {{ MAX_TEAM_IMAGES }} of one Team. You can check and change everything before it's saved.
      </p>
    </div>

    <TeamBuilder
      v-if="read.data.value"
      :read="read.data.value"
      :save="save"
      :cancel-to="cancelTo"
    />

    <template v-else>
      <p v-if="!imageReading" class="text-muted-foreground text-sm" role="status">
        Reading screenshots isn't turned on for this install.
      </p>
      <template v-else>
        <p class="text-muted-foreground text-sm" data-testid="image-reading-notice">
          The images are sent to Anthropic, whose AI model reads them. MyVGC doesn't keep them. PNG,
          JPEG or WebP, up to {{ MAX_TEAM_IMAGE_MB }} MB each.
        </p>
        <p v-if="!online" class="text-muted-foreground text-sm" role="status">
          Reading screenshots needs a connection.
        </p>
      </template>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button as-child variant="outline" size="lg"
          ><NuxtLink :to="cancelTo">Cancel</NuxtLink></Button
        >
        <template v-if="imageReading">
          <input
            ref="fileInput"
            type="file"
            multiple
            :accept="TEAM_IMAGE_FILE_TYPES"
            class="sr-only"
            data-testid="team-image-files"
            @change="chooseImages"
          />
          <Button size="lg" :disabled="!online || read.isPending.value" @click="fileInput?.click()">
            {{ read.isPending.value ? 'Reading…' : 'Choose images' }}
          </Button>
        </template>
      </div>
      <Alert v-if="failure" variant="destructive" role="alert">
        <AlertDescription>{{ failure }}</AlertDescription>
      </Alert>
    </template>
  </div>
</template>

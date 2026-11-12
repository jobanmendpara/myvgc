<script setup lang="ts">
import {
  MAX_TEAMSHEET_BYTES,
  TEAMSHEET_TOO_LARGE,
  type TeamsheetAttachmentView,
  type TournamentView,
} from '@myvgc/core/schema'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useOnline } from '@vueuse/core'
import { FetchError } from 'ofetch'

// The Teamsheet PDF the User uploaded to a Tournament, kept as uploaded for reference (ADR 27).
// The file lives on the server only, so everything here is online only (ADR 17).
const props = defineProps<{ tournament: TournamentView }>()

const online = useOnline()
const queryClient = useQueryClient()
const fileInput = ref<HTMLInputElement | null>(null)
const confirmingDelete = ref(false)

const url = computed(() => `/api/tournaments/${props.tournament.id}/teamsheet`)
const setTeamsheet = async (teamsheet: TeamsheetAttachmentView | null) => {
  queryClient.setQueryData(
    ['tournament', props.tournament.id],
    (old: TournamentView | undefined) => (old ? { ...old, teamsheet } : old),
  )
  await queryClient.invalidateQueries({ queryKey: ['tournaments'] })
}

const upload = useMutation({
  mutationFn: (file: File) => {
    if (file.size > MAX_TEAMSHEET_BYTES) throw new Error(TEAMSHEET_TOO_LARGE)
    const body = new FormData()
    body.append('file', file)
    const target: string = url.value
    return $fetch<TeamsheetAttachmentView>(target, { method: 'PUT', body })
  },
  networkMode: 'always',
  onSuccess: setTeamsheet,
  onSettled: () => {
    if (fileInput.value) fileInput.value.value = ''
  },
})
const remove = useMutation({
  mutationFn: () => {
    const target: string = url.value
    return $fetch<null>(target, { method: 'DELETE' })
  },
  networkMode: 'always',
  onSuccess: async () => {
    confirmingDelete.value = false
    await setTeamsheet(null)
  },
})

const failure = computed(() => {
  const error = upload.error.value
  if (!error) return ''
  if (error instanceof FetchError) {
    if (error.statusCode === 401)
      return 'Your session has ended. Log in again to upload a Teamsheet.'
    if (error.data?.error) return error.data.error as string
    return "Couldn't upload the file. Check your connection and try again."
  }
  return error.message
})

function chooseFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) upload.mutate(file)
}

const details = computed(() => {
  const sheet = props.tournament.teamsheet
  if (!sheet) return ''
  const size =
    sheet.size < 1024 * 1024
      ? `${Math.max(1, Math.round(sheet.size / 1024))} KB`
      : `${(sheet.size / (1024 * 1024)).toFixed(1)} MB`
  const date = new Date(sheet.uploadedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
  return `${size} · uploaded ${date}`
})
</script>

<template>
  <section
    aria-labelledby="teamsheet-title"
    class="flex flex-col gap-3"
    data-testid="tournament-teamsheet"
  >
    <h2 id="teamsheet-title" class="font-semibold">Teamsheet</h2>

    <input
      ref="fileInput"
      type="file"
      accept="application/pdf,.pdf"
      class="sr-only"
      data-testid="teamsheet-upload"
      @change="chooseFile"
    />

    <div
      v-if="tournament.teamsheet"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
    >
      <div class="min-w-0">
        <p class="font-semibold break-words" data-testid="teamsheet-file-name">
          {{ tournament.teamsheet.fileName }}
        </p>
        <p class="text-muted-foreground text-xs">{{ details }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button v-if="online" as-child variant="outline" size="sm"
          ><a :href="url" target="_blank" rel="noopener">View PDF ↗</a></Button
        >
        <Button v-else variant="outline" size="sm" disabled>View PDF ↗</Button>
        <Button v-if="online" as-child variant="outline" size="sm"
          ><NuxtLink :to="`/teams/new/teamsheet?tournament=${tournament.id}`"
            >Read into a Team</NuxtLink
          ></Button
        >
        <Button v-else variant="outline" size="sm" disabled>Read into a Team</Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="!online || upload.isPending.value"
          @click="fileInput?.click()"
        >
          {{ upload.isPending.value ? 'Uploading…' : 'Replace' }}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="text-destructive"
          :disabled="!online"
          @click="confirmingDelete = true"
          >Delete</Button
        >
      </div>
    </div>

    <div v-else class="flex flex-col items-start gap-2 rounded-lg border border-dashed p-4">
      <p class="text-muted-foreground text-sm">
        Keep the Teamsheet PDF you submitted here for reference. It's kept exactly as you upload it.
      </p>
      <Button
        variant="outline"
        size="sm"
        :disabled="!online || upload.isPending.value"
        @click="fileInput?.click()"
      >
        {{ upload.isPending.value ? 'Uploading…' : 'Upload a PDF' }}
      </Button>
    </div>

    <p v-if="!online" class="text-muted-foreground text-sm" role="status">
      The Teamsheet PDF needs a connection.
    </p>
    <Alert v-if="failure" variant="destructive" role="alert">
      <AlertDescription>{{ failure }}</AlertDescription>
    </Alert>

    <AlertDialog v-model:open="confirmingDelete">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete the Teamsheet PDF?</AlertDialogTitle>
          <AlertDialogDescription>
            MyVGC deletes its copy of {{ tournament.teamsheet?.fileName }}. It can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Alert v-if="remove.isError.value" variant="destructive" role="alert">
          <AlertDescription>Couldn't delete the PDF. Try again.</AlertDescription>
        </Alert>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="remove.isPending.value">Keep it</AlertDialogCancel>
          <Button variant="destructive" :disabled="remove.isPending.value" @click="remove.mutate()">
            {{ remove.isPending.value ? 'Deleting…' : 'Delete PDF' }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>

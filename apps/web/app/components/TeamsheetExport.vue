<script setup lang="ts">
import {
  AGE_DIVISIONS,
  type CalendarDate,
  type Legality,
  MAX_PLAYER_DETAIL_LENGTH,
  type PlayerDetails,
  type TeamsheetExport,
  seasonOf,
  teamsheetAgeDivision,
  teamsheetExportSchema,
  teamsheetFileName,
} from '@myvgc/core/schema'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { useOnline } from '@vueuse/core'

/**
 * "Export Teamsheet" and its dialog (ADR 20, ADR 25), for a Team or a Tournament's Team snapshot.
 * The dialog shows the legality first, then the Player details and Battle Team name, pre-filled
 * and changeable for this export only. Online only (ADR 17): the PDF is made by the API.
 */
const props = defineProps<{
  /** The export route, such as `/api/teams/<id>/teamsheet`. */
  url: string
  teamName: string
  legality: Legality
  /** A day in the Season to work Age Division out for: today, or the Tournament's start date. */
  seasonDate: CalendarDate
}>()

const online = useOnline()
const open = ref(false)

// The same cache entry as Settings, so the dialog fills at once when it's already loaded.
const playerDetails = useQuery({
  queryKey: ['account', 'player-details'],
  queryFn: () => $fetch<PlayerDetails>('/api/account/player-details'),
  enabled: open,
})

const draft = reactive<TeamsheetExport>(teamsheetExportSchema.parse({}))
function reset() {
  Object.assign(draft, playerDetails.data.value ?? {}, { battleTeamName: props.teamName })
}
watch(open, (isOpen) => {
  if (isOpen) {
    reset()
    exportPdf.reset()
  }
})
// Fill in the details once they arrive, if the dialog opened before they had.
watch(playerDetails.data, (details) => {
  if (details && open.value) reset()
})

type TextField = 'playerName' | 'trainerName' | 'switchProfileName' | 'playerId' | 'supportId'
const TEXT_FIELDS: { field: TextField; label: string }[] = [
  { field: 'playerName', label: 'Player Name' },
  { field: 'trainerName', label: 'Trainer Name in Game' },
  { field: 'switchProfileName', label: 'Switch Profile Name' },
  { field: 'playerId', label: 'Player ID' },
  { field: 'supportId', label: 'Support ID' },
]

const dateOfBirth = computed({
  get: () => draft.dateOfBirth ?? '',
  set: (value: string) => {
    draft.dateOfBirth = value || null
  },
})
const ageDivision = computed({
  get: () => draft.ageDivision ?? '',
  set: (value: unknown) => {
    draft.ageDivision = AGE_DIVISIONS.find((division) => division === value) ?? null
  },
})
const season = computed(() => seasonOf(props.seasonDate))
const workedOutDivision = computed(() =>
  draft.dateOfBirth ? teamsheetAgeDivision(draft, props.seasonDate) : null,
)

class ExportError extends Error {
  constructor(
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message)
  }
}

/** Saves a file the browser has in memory, under its own name. */
function download(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(href), 0)
}

const exportPdf = useMutation({
  // Plain fetch, since $fetch can't read a JSON error out of a response asked for as a Blob.
  mutationFn: async (body: TeamsheetExport) => {
    const res = await fetch(props.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return res.blob()
    const answer = await res.json().catch(() => ({}))
    if (res.status === 401) throw new ExportError('Your session has ended. Log in again to export.')
    if (res.status === 404)
      throw new ExportError(
        'This Team no longer exists. It may have been deleted on another device.',
      )
    throw new ExportError(
      res.status === 400 ? 'Check the highlighted fields.' : (answer.error ?? ''),
      answer.fields,
    )
  },
  // Online only: say so now, rather than exporting whenever a signal returns.
  networkMode: 'always',
  onSuccess: (blob) => {
    download(blob, teamsheetFileName(props.teamName))
    open.value = false
  },
})
const fieldErrors = computed(() =>
  exportPdf.error.value instanceof ExportError ? exportPdf.error.value.fields : {},
)
const failure = computed(() =>
  exportPdf.error.value
    ? exportPdf.error.value.message ||
      "Couldn't make the Teamsheet. Check your connection and try again."
    : '',
)
</script>

<template>
  <Button
    variant="outline"
    :disabled="!online"
    :title="online ? undefined : 'Export needs a connection.'"
    data-testid="export-teamsheet"
    @click="open = true"
  >
    Export Teamsheet
  </Button>

  <AlertDialog v-model:open="open">
    <AlertDialogContent class="max-h-[calc(100dvh-2rem)] overflow-y-auto">
      <AlertDialogHeader>
        <AlertDialogTitle>Export Teamsheet</AlertDialogTitle>
        <AlertDialogDescription>
          A PDF of the official team list with {{ teamName }} filled in. You can still change any
          value in a PDF viewer.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div class="flex flex-col gap-2" data-testid="teamsheet-legality">
        <p v-if="legality.status === 'legal'" class="text-sm">
          Legal in {{ legality.regulation }}.
        </p>
        <div v-else class="flex flex-col gap-2">
          <LegalityBadge :legality="legality" class="self-start" />
          <LegalityWarnings v-if="legality.problems.length" :problems="legality.problems" />
          <p class="text-muted-foreground text-xs">You can still export it.</p>
        </div>
      </div>

      <form
        id="teamsheet-export-form"
        class="flex flex-col gap-4"
        novalidate
        @submit.prevent="exportPdf.mutate({ ...draft })"
      >
        <div class="flex flex-col gap-2">
          <Label for="export-battleTeamName">Battle Team Number / Name</Label>
          <Input
            id="export-battleTeamName"
            v-model="draft.battleTeamName"
            autocomplete="off"
            :maxlength="MAX_PLAYER_DETAIL_LENGTH"
            :aria-invalid="fieldErrors.battleTeamName ? true : undefined"
          />
          <p v-if="fieldErrors.battleTeamName" class="text-destructive text-sm">
            {{ fieldErrors.battleTeamName }}
          </p>
        </div>

        <fieldset class="flex flex-col gap-4">
          <legend class="mb-2 text-sm font-medium">Player details</legend>
          <p v-if="playerDetails.isPending.value" class="text-muted-foreground text-sm">
            Loading your Player details…
          </p>
          <div v-for="{ field, label } in TEXT_FIELDS" :key="field" class="flex flex-col gap-2">
            <Label :for="`export-${field}`">{{ label }}</Label>
            <Input
              :id="`export-${field}`"
              v-model="draft[field]"
              autocomplete="off"
              :maxlength="MAX_PLAYER_DETAIL_LENGTH"
              :aria-invalid="fieldErrors[field] ? true : undefined"
            />
            <p v-if="fieldErrors[field]" class="text-destructive text-sm">
              {{ fieldErrors[field] }}
            </p>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="export-dateOfBirth">Date of Birth</Label>
            <Input
              id="export-dateOfBirth"
              v-model="dateOfBirth"
              type="date"
              class="w-auto self-start"
              :aria-invalid="fieldErrors.dateOfBirth ? true : undefined"
            />
            <p v-if="fieldErrors.dateOfBirth" class="text-destructive text-sm">
              {{ fieldErrors.dateOfBirth }}
            </p>
          </div>

          <div v-if="workedOutDivision" class="flex flex-col gap-1" data-testid="export-division">
            <p class="text-sm font-medium">Age Division</p>
            <p class="text-sm">{{ workedOutDivision }}</p>
            <p v-if="season" class="text-muted-foreground text-xs">
              From the Date of Birth, for the {{ season.name }}.
            </p>
          </div>
          <div v-else class="flex flex-col gap-2">
            <Label for="export-ageDivision">Age Division</Label>
            <NativeSelect id="export-ageDivision" v-model="ageDivision" class="w-40">
              <NativeSelectOption value="">Not set</NativeSelectOption>
              <NativeSelectOption
                v-for="division in AGE_DIVISIONS"
                :key="division"
                :value="division"
              >
                {{ division }}
              </NativeSelectOption>
            </NativeSelect>
          </div>

          <p class="text-muted-foreground text-xs">
            Changes here are for this export only.
            <NuxtLink to="/settings" class="text-primary underline">Save Player details</NuxtLink>
            in Settings to use them every time.
          </p>
        </fieldset>
      </form>

      <Alert v-if="failure" variant="destructive" role="alert">
        <AlertDescription>{{ failure }}</AlertDescription>
      </Alert>

      <AlertDialogFooter>
        <AlertDialogCancel :disabled="exportPdf.isPending.value">Cancel</AlertDialogCancel>
        <Button
          type="submit"
          form="teamsheet-export-form"
          :disabled="!online || exportPdf.isPending.value"
          data-testid="export-teamsheet-submit"
        >
          {{ exportPdf.isPending.value ? 'Exporting…' : 'Export PDF' }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

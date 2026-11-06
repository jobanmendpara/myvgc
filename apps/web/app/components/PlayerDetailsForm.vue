<script setup lang="ts">
import {
  AGE_DIVISIONS,
  MAX_PLAYER_DETAIL_LENGTH,
  type PlayerDetails,
  playerDetailsSchema,
} from '@myvgc/core/schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useOnline } from '@vueuse/core'
import { fieldErrorsOf, saveFailureMessage } from '@/lib/api'

/**
 * The User's Player details, an Account setting. Online only, since ADR 17's offline scope leaves
 * them out: offline it shows what is cached, with editing turned off. Nothing here is queued.
 */
const QUERY_KEY = ['account', 'player-details']
const query = useQuery({
  queryKey: QUERY_KEY,
  queryFn: () => $fetch<PlayerDetails>('/api/account/player-details'),
})

type TextField = Exclude<keyof PlayerDetails, 'ageDivision'>
const TEXT_FIELDS: { field: TextField; label: string; hint?: string }[] = [
  { field: 'playerName', label: 'Player Name' },
  { field: 'trainerName', label: 'Trainer Name in Game' },
  { field: 'switchProfileName', label: 'Switch Profile Name' },
  { field: 'playerId', label: 'Player ID' },
  {
    field: 'supportId',
    label: 'Support ID',
    hint: 'Shown at the bottom left of the Pokémon Champions title screen.',
  },
]

const draft = reactive<PlayerDetails>(playerDetailsSchema.parse({}))
// The select's "Not set" is an empty value; Player details keep it as no Age Division.
const ageDivision = computed({
  get: () => draft.ageDivision ?? '',
  set: (value: unknown) => {
    draft.ageDivision = AGE_DIVISIONS.find((division) => division === value) ?? null
  },
})
// What the form last loaded or saved, to tell whether it has unsaved changes.
const saved = ref(JSON.stringify(draft))
const dirty = computed(() => JSON.stringify(draft) !== saved.value)

function load(details: PlayerDetails) {
  Object.assign(draft, details)
  saved.value = JSON.stringify(draft)
}
// Fill the form when the details arrive, but never over the User's own edits.
watch(
  query.data,
  (details) => {
    if (details && !dirty.value) load(details)
  },
  { immediate: true },
)

const online = useOnline()
const editable = computed(() => online.value && Boolean(query.data.value))

const queryClient = useQueryClient()
const justSaved = ref(false)
const save = useMutation({
  mutationFn: (body: PlayerDetails) =>
    $fetch<PlayerDetails>('/api/account/player-details', { method: 'PUT', body }),
  // Online only: say so now, rather than saving whenever a signal returns.
  networkMode: 'always',
  onSuccess: (details) => {
    queryClient.setQueryData(QUERY_KEY, details)
    load(details)
    justSaved.value = true
  },
})
const fieldErrors = computed(() => fieldErrorsOf(save.error.value) ?? {})
const failure = computed(() =>
  save.error.value && !fieldErrorsOf(save.error.value)
    ? saveFailureMessage(save.error.value, 'Player details')
    : '',
)
// What the API said, or "Saved.", was about the form as it was sent.
watch(dirty, (isDirty) => {
  if (!isDirty) return
  justSaved.value = false
  if (save.error.value) save.reset()
})

function submit() {
  if (editable.value) save.mutate({ ...draft })
}

// Leaving or logging out with unsaved edits asks first.
const { discarding, answer } = useDiscardGuard(dirty)
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
    <p v-if="!online" class="text-muted-foreground text-sm" data-testid="player-details-offline">
      Online only. Connect to change your Player details.
    </p>
    <p v-else-if="query.isError.value && !query.data.value" class="text-destructive text-sm">
      Couldn't load your Player details. Check your connection and try again.
    </p>

    <fieldset :disabled="!editable" class="flex flex-col gap-4">
      <div v-for="{ field, label, hint } in TEXT_FIELDS" :key="field" class="flex flex-col gap-2">
        <Label :for="field">{{ label }}</Label>
        <Input
          :id="field"
          v-model="draft[field]"
          autocomplete="off"
          :maxlength="MAX_PLAYER_DETAIL_LENGTH"
          :aria-invalid="fieldErrors[field] ? true : undefined"
          :aria-describedby="`${field}-hint ${field}-error`"
        />
        <p v-if="hint" :id="`${field}-hint`" class="text-muted-foreground text-xs">{{ hint }}</p>
        <p v-if="fieldErrors[field]" :id="`${field}-error`" class="text-destructive text-sm">
          {{ fieldErrors[field] }}
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <Label for="ageDivision">Age Division</Label>
        <NativeSelect
          id="ageDivision"
          v-model="ageDivision"
          class="w-40"
          :aria-invalid="fieldErrors.ageDivision ? true : undefined"
          aria-describedby="ageDivision-error"
        >
          <NativeSelectOption value="">Not set</NativeSelectOption>
          <NativeSelectOption v-for="division in AGE_DIVISIONS" :key="division" :value="division">
            {{ division }}
          </NativeSelectOption>
        </NativeSelect>
        <p v-if="fieldErrors.ageDivision" id="ageDivision-error" class="text-destructive text-sm">
          {{ fieldErrors.ageDivision }}
        </p>
      </div>
    </fieldset>

    <Alert v-if="failure" variant="destructive" role="alert">
      <AlertDescription>{{ failure }}</AlertDescription>
    </Alert>
    <div class="flex items-center gap-3">
      <Button type="submit" :disabled="!editable || !dirty || save.isPending.value">
        {{ save.isPending.value ? 'Saving…' : 'Save Player details' }}
      </Button>
      <p v-if="justSaved" class="text-muted-foreground text-sm" role="status">Saved.</p>
    </div>

    <AlertDialog :open="discarding" @update:open="(open: boolean) => open || answer(false)">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard changes?</AlertDialogTitle>
          <AlertDialogDescription
            >Your edits to your Player details haven't been saved.</AlertDialogDescription
          >
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <Button variant="destructive" @click="answer(true)">Discard changes</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </form>
</template>

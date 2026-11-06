<script setup lang="ts">
import {
  MAX_NOTES_LENGTH,
  type NoteEntryView,
  type OpponentDetailView,
  type OpponentRoundView,
  today,
} from '@myvgc/core/schema'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { createReusableTemplate } from '@vueuse/core'
import { fieldErrorsOf, saveFailureMessage } from '@/lib/api'
import { formatDates, roundLabel, roundOutcome } from '@/lib/format'

// Everything known about an Opponent, newest first: their Note entries, and the notes from
// every Round against them, dated by the Tournament's start date.
const props = defineProps<{ opponent: OpponentDetailView }>()

type Item =
  | { kind: 'entry'; key: string; date: string; createdAt: string; entry: NoteEntryView }
  | { kind: 'round'; key: string; date: string; createdAt: string; round: OpponentRoundView }
const items = computed<Item[]>(() =>
  [
    ...props.opponent.noteEntries.map((entry) => ({
      kind: 'entry' as const,
      key: `entry-${entry.id}`,
      date: entry.date,
      createdAt: entry.createdAt,
      entry,
    })),
    ...props.opponent.rounds
      .filter((round) => round.notes)
      .map((round) => ({
        kind: 'round' as const,
        key: `round-${round.id}`,
        date: round.tournament.startDate,
        createdAt: round.createdAt,
        round,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
)

// One form at a time: adding a new Note entry, or editing one in place.
const [DefineForm, ReuseForm] = createReusableTemplate()
const editingId = ref<string | 'new' | null>(null)
const date = ref('')
const text = ref('')
function startAdding() {
  date.value = today()
  text.value = ''
  save.reset()
  editingId.value = 'new'
}
function startEditing(entry: NoteEntryView) {
  date.value = entry.date
  text.value = entry.text
  save.reset()
  editingId.value = entry.id
}

const queryClient = useQueryClient()
const addUrl = computed(() => `/api/opponents/${props.opponent.id}/note-entries`)
const refresh = () =>
  queryClient.invalidateQueries({ queryKey: ['opponents', 'detail', props.opponent.id] })

const save = useMutation({
  mutationFn: () => {
    const body = { date: date.value, text: text.value }
    if (editingId.value === 'new') {
      const url: string = addUrl.value
      return $fetch<NoteEntryView>(url, { method: 'POST', body })
    }
    const url: string = `/api/note-entries/${editingId.value}`
    return $fetch<NoteEntryView>(url, { method: 'PATCH', body })
  },
  onSuccess: async () => {
    editingId.value = null
    await refresh()
  },
})
const fieldErrors = computed(() => fieldErrorsOf(save.error.value))

const deleting = ref<NoteEntryView | null>(null)
const remove = useMutation({
  mutationFn: (entry: NoteEntryView) => {
    const url: string = `/api/note-entries/${entry.id}`
    return $fetch<null>(url, { method: 'DELETE' })
  },
  onSuccess: async () => {
    deleting.value = null
    await refresh()
  },
})
function confirmDelete(entry: NoteEntryView) {
  remove.reset()
  deleting.value = entry
}
</script>

<template>
  <DefineForm>
    <form class="flex flex-col gap-3" novalidate @submit.prevent="save.mutate()">
      <div class="flex flex-col gap-2">
        <Label for="note-entry-date">Date</Label>
        <Input id="note-entry-date" v-model="date" type="date" class="w-auto self-start" />
        <p v-if="fieldErrors?.date" class="text-destructive text-sm">{{ fieldErrors.date }}</p>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="note-entry-text">Note</Label>
        <Textarea
          id="note-entry-text"
          v-model="text"
          rows="4"
          :maxlength="MAX_NOTES_LENGTH"
          placeholder="What they brought, how they played, anything worth remembering"
        />
        <p v-if="fieldErrors?.text" class="text-destructive text-sm">{{ fieldErrors.text }}</p>
      </div>
      <Alert v-if="save.isError.value && !fieldErrors" variant="destructive" role="alert">
        <AlertDescription>{{
          saveFailureMessage(save.error.value, 'Note entry')
        }}</AlertDescription>
      </Alert>
      <div class="flex gap-2">
        <Button type="submit" size="sm" :disabled="save.isPending.value">{{
          save.isPending.value ? 'Saving…' : 'Save'
        }}</Button>
        <Button type="button" size="sm" variant="ghost" @click="editingId = null">Cancel</Button>
      </div>
    </form>
  </DefineForm>

  <section aria-labelledby="opponent-timeline" class="flex flex-col gap-3">
    <div class="flex items-center justify-between gap-3">
      <h2 id="opponent-timeline" class="font-semibold">Notes over time</h2>
      <Button v-if="editingId !== 'new'" variant="outline" size="sm" @click="startAdding"
        >Add Note entry</Button
      >
    </div>

    <ol class="flex flex-col divide-y rounded-lg border" data-testid="opponent-timeline">
      <li v-if="editingId === 'new'" class="p-3">
        <ReuseForm />
      </li>
      <li
        v-if="items.length === 0 && editingId !== 'new'"
        class="text-muted-foreground p-3 text-sm"
      >
        No notes yet. Add a Note entry, or write notes on a Round against them.
      </li>
      <li v-for="item in items" :key="item.key" class="flex flex-col gap-1 p-3">
        <template v-if="item.kind === 'entry'">
          <ReuseForm v-if="editingId === item.entry.id" />
          <template v-else>
            <div class="flex items-start justify-between gap-3">
              <p class="text-muted-foreground text-xs">{{ formatDates(item.date) }} · Note entry</p>
              <div class="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" @click="startEditing(item.entry)">Edit</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-destructive"
                  @click="confirmDelete(item.entry)"
                  >Delete</Button
                >
              </div>
            </div>
            <p class="text-sm whitespace-pre-wrap">{{ item.entry.text }}</p>
          </template>
        </template>
        <template v-else>
          <div class="flex items-start justify-between gap-3">
            <p class="text-muted-foreground min-w-0 text-xs">
              {{ formatDates(item.date) }} ·
              <NuxtLink
                :to="`/tournaments/${item.round.tournament.id}/rounds/${item.round.id}`"
                class="break-words hover:underline"
                >{{ item.round.tournament.name }}, {{ roundLabel(item.round) }}</NuxtLink
              >
            </p>
            <span class="shrink-0 text-xs font-semibold">{{ roundOutcome(item.round) }}</span>
          </div>
          <p class="text-sm whitespace-pre-wrap">{{ item.round.notes }}</p>
        </template>
      </li>
    </ol>

    <AlertDialog
      :open="deleting !== null"
      @update:open="(open: boolean) => !open && (deleting = null)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this Note entry?</AlertDialogTitle>
          <AlertDialogDescription>
            The Note entry from {{ deleting && formatDates(deleting.date) }} is removed. This can't
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Alert v-if="remove.isError.value" variant="destructive" role="alert">
          <AlertDescription>{{
            saveFailureMessage(remove.error.value, 'Note entry')
          }}</AlertDescription>
        </Alert>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="remove.isPending.value">Keep it</AlertDialogCancel>
          <Button
            variant="destructive"
            :disabled="remove.isPending.value"
            @click="deleting && remove.mutate(deleting)"
            >{{ remove.isPending.value ? 'Deleting…' : 'Delete Note entry' }}</Button
          >
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>

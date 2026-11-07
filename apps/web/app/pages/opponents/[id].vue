<script setup lang="ts">
import {
  MAX_NOTES_LENGTH,
  type OpponentDetailView,
  type OpponentView,
  formatRecord,
  groupByTournament,
} from '@myvgc/core/schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useOnline } from '@vueuse/core'
import { FetchError } from 'ofetch'
import { fieldErrorsOf, saveFailureMessage } from '@/lib/api'
import { formatDates, roundLabel, roundOutcome } from '@/lib/format'
import type { OpponentChoice } from '@/components/OpponentPicker.vue'

const route = useRoute()
const id = computed(() => String(route.params.id))
const query = useQuery({
  queryKey: computed(() => ['opponents', 'detail', id.value]),
  queryFn: () => $fetch<OpponentDetailView>(`/api/opponents/${id.value}`),
  retry: (count, error) => !(error instanceof FetchError && error.statusCode === 404) && count < 1,
})
const opponent = query.data
// Their Rounds by Tournament, each with the Opponent's Team they brought there (ADR 22).
const tournaments = computed(() => (opponent.value ? groupByTournament(opponent.value) : []))
const notFound = computed(
  () => query.error.value instanceof FetchError && query.error.value.statusCode === 404,
)
useHead({
  title: computed(() =>
    opponent.value ? `${opponent.value.displayName} · MyVGC` : 'Opponent · MyVGC',
  ),
})

// Editing: the display name, Aliases (one per line) and notes, saved together.
const editing = ref(false)
const displayName = ref('')
const aliasText = ref('')
const notes = ref('')
function startEditing() {
  if (!opponent.value) return
  displayName.value = opponent.value.displayName
  aliasText.value = opponent.value.aliases.join('\n')
  notes.value = opponent.value.notes
  editing.value = true
}

const queryClient = useQueryClient()
const save = useMutation({
  mutationFn: () => {
    const url: string = `/api/opponents/${id.value}`
    return $fetch<unknown>(url, {
      method: 'PATCH',
      body: {
        displayName: displayName.value,
        aliases: aliasText.value
          .split('\n')
          .map((a) => a.trim())
          .filter(Boolean),
        notes: notes.value,
      },
    })
  },
  onSuccess: async () => {
    editing.value = false
    await queryClient.invalidateQueries({ queryKey: ['opponents'] })
    await queryClient.invalidateQueries({ queryKey: ['tournament'] })
  },
})
const fieldErrors = computed(() => fieldErrorsOf(save.error.value))

const confirmingDelete = ref(false)
const remove = useMutation({
  mutationFn: () => {
    const url: string = `/api/opponents/${id.value}`
    return $fetch<null>(url, { method: 'DELETE' })
  },
  onSuccess: async () => {
    confirmingDelete.value = false
    await queryClient.invalidateQueries({ queryKey: ['opponents'] })
    await navigateTo('/opponents')
  },
})

// Merging: a duplicate Opponent chosen here is combined into this one, then deleted.
// Online only (ADR 17 doesn't queue merges).
const online = useOnline()
const merging = ref(false)
const duplicate = ref<OpponentChoice | null>(null)
const merged = ref<string>()
const duplicateId = computed(() =>
  duplicate.value?.kind === 'existing' ? duplicate.value.id : undefined,
)
// For the summary: how many Rounds will move.
const duplicateDetail = useQuery({
  queryKey: computed(() => ['opponents', 'detail', duplicateId.value]),
  queryFn: () => $fetch<OpponentView>(`/api/opponents/${duplicateId.value}`),
  enabled: computed(() => Boolean(duplicateId.value)),
})
watch(id, () => (merged.value = undefined))
function startMerging() {
  duplicate.value = null
  merge.reset()
  merging.value = true
}
const merge = useMutation({
  mutationFn: () => {
    const url: string = `/api/opponents/${id.value}/merge`
    return $fetch<OpponentView>(url, { method: 'POST', body: { duplicateId: duplicateId.value } })
  },
  onSuccess: async () => {
    merged.value = `Merged ${duplicate.value?.displayName} into ${opponent.value?.displayName}.`
    merging.value = false
    // The duplicate is gone, so stop asking about it.
    duplicate.value = null
    await queryClient.invalidateQueries({ queryKey: ['opponents'] })
    await queryClient.invalidateQueries({ queryKey: ['tournament'] })
  },
})
const mergeErrors = computed(() => fieldErrorsOf(merge.error.value))
const roundsMoving = computed(() => {
  const count = duplicateDetail.data.value?.roundCount
  return count === undefined ? 'their Rounds' : count === 1 ? '1 Round' : `${count} Rounds`
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <NuxtLink to="/opponents" class="text-muted-foreground text-sm hover:underline"
      >← Opponents</NuxtLink
    >

    <p v-if="query.isPending.value" class="text-muted-foreground">Loading…</p>
    <Card v-else-if="notFound">
      <CardHeader>
        <CardTitle>Opponent not found</CardTitle>
        <CardDescription>They may have been deleted.</CardDescription>
      </CardHeader>
    </Card>
    <Alert v-else-if="query.isError.value" variant="destructive" role="alert">
      <AlertDescription>Couldn't load this Opponent.</AlertDescription>
    </Alert>

    <template v-else-if="opponent">
      <form v-if="editing" class="flex flex-col gap-4" novalidate @submit.prevent="save.mutate()">
        <div class="flex flex-col gap-2">
          <Label for="display-name">Display name</Label>
          <Input id="display-name" v-model="displayName" autocomplete="off" />
          <p v-if="fieldErrors?.displayName" class="text-destructive text-sm">
            {{ fieldErrors.displayName }}
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <Label for="aliases"
            >Aliases <span class="text-muted-foreground font-normal">(one per line)</span></Label
          >
          <Textarea
            id="aliases"
            v-model="aliasText"
            rows="3"
            placeholder="Legal name, screen name, Discord username, nickname"
          />
          <p v-if="fieldErrors?.aliases" class="text-destructive text-sm">
            {{ fieldErrors.aliases }}
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <Label for="opponent-notes">Notes</Label>
          <Textarea id="opponent-notes" v-model="notes" rows="5" :maxlength="MAX_NOTES_LENGTH" />
        </div>
        <Alert v-if="save.isError.value && !fieldErrors" variant="destructive" role="alert">
          <AlertDescription>{{
            saveFailureMessage(save.error.value, 'Opponent')
          }}</AlertDescription>
        </Alert>
        <div class="flex gap-2">
          <Button type="submit" :disabled="save.isPending.value">{{
            save.isPending.value ? 'Saving…' : 'Save'
          }}</Button>
          <Button type="button" variant="ghost" @click="editing = false">Cancel</Button>
        </div>
      </form>

      <header v-else class="flex flex-col gap-2">
        <div class="flex items-start justify-between gap-3">
          <h1 class="min-w-0 text-2xl font-semibold break-words" data-testid="opponent-name">
            {{ opponent.displayName }}
          </h1>
          <Button variant="outline" size="sm" @click="startEditing">Edit</Button>
        </div>
        <p v-if="opponent.aliases.length" class="text-muted-foreground text-sm">
          Also: {{ opponent.aliases.join(', ') }}
        </p>
        <p class="text-sm" data-testid="head-to-head">
          Head-to-head <span class="font-semibold">{{ formatRecord(opponent.headToHead) }}</span>
          <span class="text-muted-foreground">
            in {{ opponent.roundCount === 1 ? '1 Round' : `${opponent.roundCount} Rounds` }}</span
          >
        </p>
        <p v-if="opponent.notes" class="mt-2 text-sm whitespace-pre-wrap">{{ opponent.notes }}</p>
      </header>

      <Alert v-if="merged" role="status">
        <AlertDescription>{{ merged }}</AlertDescription>
      </Alert>

      <OpponentTimeline :opponent="opponent" />

      <section aria-labelledby="opponent-tournaments" class="flex flex-col gap-3">
        <h2 id="opponent-tournaments" class="font-semibold">Tournaments against them</h2>
        <p v-if="tournaments.length === 0" class="text-muted-foreground text-sm">None yet.</p>
        <ol v-else class="flex flex-col gap-3">
          <li
            v-for="group in tournaments"
            :key="group.tournament.id"
            class="flex flex-col gap-3 rounded-lg border p-3"
            data-testid="opponent-tournament"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 flex-col gap-0.5">
                <NuxtLink
                  :to="`/tournaments/${group.tournament.id}`"
                  class="font-medium break-words hover:underline"
                  >{{ group.tournament.name }}</NuxtLink
                >
                <p class="text-muted-foreground text-xs">
                  {{ formatDates(group.tournament.startDate) }} · {{ group.tournament.regulation }}
                </p>
              </div>
              <span class="shrink-0 text-sm font-semibold">{{
                formatRecord(group.headToHead)
              }}</span>
            </div>
            <OpponentTeamSummary v-if="group.opponentTeam" :pokemon="group.opponentTeam" />
            <p v-else class="text-muted-foreground text-sm">Team not recorded</p>
            <ol class="flex flex-col divide-y border-t">
              <li
                v-for="r in group.rounds"
                :key="r.id"
                class="flex items-center justify-between gap-3 py-2 last:pb-0"
              >
                <NuxtLink
                  :to="`/tournaments/${r.tournament.id}/rounds/${r.id}`"
                  class="min-w-0 text-sm hover:underline"
                  >{{ roundLabel(r) }}
                  <span class="text-muted-foreground text-xs"
                    >· Best of {{ r.bestOf }}</span
                  ></NuxtLink
                >
                <span class="shrink-0 text-sm font-semibold">{{ roundOutcome(r) }}</span>
              </li>
            </ol>
          </li>
        </ol>
      </section>

      <div class="flex flex-col items-start gap-2 border-t pt-6">
        <Button variant="ghost" :disabled="!online" @click="startMerging"
          >Merge another Opponent into this one…</Button
        >
        <p v-if="!online" class="text-muted-foreground text-xs">Merging needs a connection.</p>
        <Button variant="ghost" class="text-destructive" @click="confirmingDelete = true"
          >Delete Opponent</Button
        >
      </div>
      <AlertDialog v-model:open="merging">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge into {{ opponent.displayName }}</AlertDialogTitle>
            <AlertDialogDescription>
              Choose a duplicate of {{ opponent.displayName }}. Their Rounds, Aliases, notes and
              Note entries move here, and the duplicate is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <OpponentPicker
            v-model="duplicate"
            label="Duplicate"
            :exclude="opponent.id"
            :allow-new="false"
            :error="mergeErrors?.duplicateId"
          />
          <p v-if="duplicate" class="text-sm" data-testid="merge-summary">
            Keep <strong>{{ opponent.displayName }}</strong
            >. Move {{ roundsMoving }} and their Note entries from
            <strong>{{ duplicate.displayName }}</strong
            >, add their name and Aliases as Aliases, and add their notes below these. Then delete
            <strong>{{ duplicate.displayName }}</strong
            >. This can't be undone.
          </p>
          <Alert
            v-if="merge.isError.value && !mergeErrors?.duplicateId"
            variant="destructive"
            role="alert"
          >
            <AlertDescription>{{
              saveFailureMessage(merge.error.value, 'Opponent')
            }}</AlertDescription>
          </Alert>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="merge.isPending.value">Cancel</AlertDialogCancel>
            <Button
              :disabled="!duplicateId || !online || merge.isPending.value"
              @click="merge.mutate()"
              >{{ merge.isPending.value ? 'Merging…' : 'Merge' }}</Button
            >
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog v-model:open="confirmingDelete">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {{ opponent.displayName }}?</AlertDialogTitle>
            <AlertDialogDescription>
              <template v-if="opponent.roundCount">
                You have Rounds against them, so they can't be deleted. Rename them, or merge them
                into another Opponent.
              </template>
              <template v-else
                >This removes the Opponent, their notes and their Note entries.</template
              >
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Alert v-if="remove.isError.value" variant="destructive" role="alert">
            <AlertDescription>{{
              saveFailureMessage(remove.error.value, 'Opponent')
            }}</AlertDescription>
          </Alert>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="remove.isPending.value">{{
              opponent.roundCount ? 'Close' : 'Keep them'
            }}</AlertDialogCancel>
            <Button
              v-if="!opponent.roundCount"
              variant="destructive"
              :disabled="remove.isPending.value"
              @click="remove.mutate()"
              >{{ remove.isPending.value ? 'Deleting…' : 'Delete Opponent' }}</Button
            >
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </template>
  </div>
</template>

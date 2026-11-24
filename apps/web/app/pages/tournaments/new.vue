<script setup lang="ts">
import { newTournamentSchema, type TournamentView } from '@myvgc/core/schema'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { checkBeforeSaving, fieldErrorsOf, saveFailureMessage } from '@/lib/api'
import { addTournament } from '@/lib/outbox-writes'
import { tournamentPath } from '@/lib/paths'
import { type TournamentBody, blankTournament, lastCurrency } from '@/lib/tournament-form'

useHead({ title: 'New Tournament · MyVGC' })

// The list is usually cached already; it gives the currency to start the Entry fee with. With
// no signal and nothing cached, the form starts without one.
const tournaments = useQuery({
  queryKey: ['tournaments'],
  queryFn: () => $fetch<TournamentView[]>('/api/tournaments'),
})
const loading = computed(
  () => tournaments.isPending.value && tournaments.fetchStatus.value === 'fetching',
)
const initial = computed(() => blankTournament(lastCurrency(tournaments.data.value)))

// Kept on the phone first, so a Tournament can be created with no signal too, and sent when it
// can be (ADR 17). Its ID is chosen here, so its page opens and Rounds can be logged in it at once.
const outbox = useOutbox()
const save = useMutation({
  // Runs with no signal too, as the outbox keeps the change (ADR 17).
  networkMode: 'always',
  mutationFn: async (body: TournamentBody) => {
    const draft = addTournament(body)
    // Checked here too, as with no signal the server can't say what is wrong with it.
    checkBeforeSaving(newTournamentSchema, draft.request.body)
    await outbox.save(draft)
    return draft.subject.tournamentId!
  },
  onSuccess: (id) => navigateTo(tournamentPath(id)),
})
const fieldErrors = computed(() => fieldErrorsOf(save.error.value))
const failure = computed(() =>
  save.error.value && !fieldErrors.value ? saveFailureMessage(save.error.value, 'Tournament') : '',
)
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <h1 class="text-2xl font-semibold">New Tournament</h1>
    <p v-if="loading" class="text-muted-foreground">Loading…</p>
    <TournamentForm
      v-else
      :initial="initial"
      :field-errors="fieldErrors"
      :pending="save.isPending.value"
      submit-label="Save Tournament"
      cancel-to="/tournaments"
      @submit="save.mutate"
    >
      <template #problem>
        <Alert v-if="failure" variant="destructive" role="alert">
          <AlertDescription>{{ failure }}</AlertDescription>
        </Alert>
      </template>
    </TournamentForm>
  </div>
</template>

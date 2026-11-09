<script setup lang="ts">
import type { TournamentView } from '@myvgc/core/schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fieldErrorsOf, saveFailureMessage } from '@/lib/api'
import { type TournamentBody, blankTournament, lastCurrency } from '@/lib/tournament-form'

useHead({ title: 'New Tournament · MyVGC' })

// The list is usually cached already; it gives the currency to start the Entry fee with.
const tournaments = useQuery({
  queryKey: ['tournaments'],
  queryFn: () => $fetch<TournamentView[]>('/api/tournaments'),
})
const initial = computed(() => blankTournament(lastCurrency(tournaments.data.value)))

const queryClient = useQueryClient()
const save = useMutation({
  mutationFn: (body: TournamentBody) =>
    $fetch<TournamentView>('/api/tournaments', { method: 'POST', body }),
  onSuccess: async (tournament) => {
    await queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    await navigateTo(`/tournaments/${tournament.id}`)
  },
})
const fieldErrors = computed(() => fieldErrorsOf(save.error.value))
const failure = computed(() =>
  save.error.value && !fieldErrors.value ? saveFailureMessage(save.error.value, 'Tournament') : '',
)
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <h1 class="text-2xl font-semibold">New Tournament</h1>
    <p v-if="tournaments.isPending.value" class="text-muted-foreground">Loading…</p>
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

<script setup lang="ts">
import type { TournamentView } from '@myvgc/core/schema'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { fieldErrorsOf, saveFailureMessage } from '@/lib/api'
import { type TournamentBody, tournamentToForm } from '@/lib/tournament-form'

const route = useRoute()
const id = computed(() => String(route.params.id))

const { query } = useTournament(id)
useHead({
  title: computed(() =>
    query.data.value ? `Edit ${query.data.value.name} · MyVGC` : 'Edit Tournament · MyVGC',
  ),
})

const queryClient = useQueryClient()
const save = useMutation({
  mutationFn: (body: TournamentBody) =>
    $fetch<TournamentView>(`/api/tournaments/${id.value}`, { method: 'PATCH', body }),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['tournament', id.value] })
    await queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    await navigateTo(`/tournaments/${id.value}`)
  },
})
const fieldErrors = computed(() => fieldErrorsOf(save.error.value))
const failure = computed(() =>
  save.error.value && !fieldErrors.value ? saveFailureMessage(save.error.value, 'Tournament') : '',
)
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <h1 class="text-2xl font-semibold">Edit Tournament</h1>
    <p v-if="query.isPending.value" class="text-muted-foreground">Loading…</p>
    <Alert v-else-if="query.isError.value" variant="destructive" role="alert">
      <AlertDescription>Couldn't load this Tournament.</AlertDescription>
    </Alert>
    <TournamentForm
      v-else-if="query.data.value"
      :initial="tournamentToForm(query.data.value)"
      regulation-chosen
      :field-errors="fieldErrors"
      :pending="save.isPending.value"
      submit-label="Save changes"
      :cancel-to="`/tournaments/${id}`"
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

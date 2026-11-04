<script setup lang="ts">
import type { TournamentView } from '@myvgc/core/schema'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { TournamentFormValues } from '@/components/TournamentForm.vue'
import { fieldErrorsOf, saveFailureMessage } from '@/lib/api'
import { blankTournament, formToBody } from '@/lib/tournament-form'

useHead({ title: 'New Tournament · MyVGC' })

const queryClient = useQueryClient()
const save = useMutation({
  mutationFn: (values: TournamentFormValues) =>
    $fetch<TournamentView>('/api/tournaments', { method: 'POST', body: formToBody(values) }),
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
  <div class="flex flex-col gap-6">
    <h1 class="text-2xl font-semibold">New Tournament</h1>
    <TournamentForm
      :initial="blankTournament()"
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

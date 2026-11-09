<script setup lang="ts">
import type { RoundInput, SavedRound } from '@myvgc/core/schema'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { fieldErrorsOf, saveFailureMessage } from '@/lib/api'

const route = useRoute()
const id = computed(() => String(route.params.id))
const { query, tournament } = useTournament(id)
useHead({ title: 'Log a Round · MyVGC' })

const queryClient = useQueryClient()
const save = useMutation({
  mutationFn: (body: RoundInput) => {
    const url: string = `/api/tournaments/${id.value}/rounds`
    return $fetch<SavedRound>(url, { method: 'POST', body })
  },
  onSuccess: async (saved) => {
    await queryClient.invalidateQueries({ queryKey: ['tournament', id.value] })
    await queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    await queryClient.invalidateQueries({ queryKey: ['opponents'] })
    await navigateTo({
      path: `/tournaments/${id.value}`,
      query: saved.suggestedPlacement ? { placement: saved.suggestedPlacement } : {},
    })
  },
})
const fieldErrors = computed(() => fieldErrorsOf(save.error.value))
const failure = computed(() =>
  save.error.value && !fieldErrors.value ? saveFailureMessage(save.error.value, 'Round') : '',
)
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <div>
      <h1 class="text-2xl font-semibold">Log a Round</h1>
      <p v-if="tournament" class="text-muted-foreground text-sm">{{ tournament.name }}</p>
    </div>
    <p v-if="query.isPending.value" class="text-muted-foreground">Loading…</p>
    <Alert v-else-if="query.isError.value" variant="destructive" role="alert">
      <AlertDescription>Couldn't load this Tournament.</AlertDescription>
    </Alert>
    <RoundForm
      v-else-if="tournament"
      :tournament="tournament"
      :field-errors="fieldErrors"
      :pending="save.isPending.value"
      @submit="save.mutate"
    >
      <template #problem>
        <Alert v-if="failure" variant="destructive" role="alert">
          <AlertDescription>{{ failure }}</AlertDescription>
        </Alert>
      </template>
    </RoundForm>
  </div>
</template>

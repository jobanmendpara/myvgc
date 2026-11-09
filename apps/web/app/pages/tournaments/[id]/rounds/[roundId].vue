<script setup lang="ts">
import { type RoundInput, type SavedRound, losesOpponentTeam } from '@myvgc/core/schema'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { fieldErrorsOf, saveFailureMessage } from '@/lib/api'

const route = useRoute()
const id = computed(() => String(route.params.id))
const roundId = computed(() => String(route.params.roundId))
const { query, tournament } = useTournament(id)
const round = computed(() => tournament.value?.rounds.find((r) => r.id === roundId.value))
// Deleting the last Round against an Opponent deletes their Opponent's Team here too (ADR 22).
const losesTeam = computed(
  () =>
    !!tournament.value &&
    losesOpponentTeam(tournament.value, roundId.value, round.value?.opponent?.id),
)
useHead({ title: 'Edit Round · MyVGC' })

const queryClient = useQueryClient()
const url = computed((): string => `/api/tournaments/${id.value}/rounds/${roundId.value}`)
async function refresh() {
  await queryClient.invalidateQueries({ queryKey: ['tournament', id.value] })
  await queryClient.invalidateQueries({ queryKey: ['tournaments'] })
  await queryClient.invalidateQueries({ queryKey: ['opponents'] })
}
const save = useMutation({
  mutationFn: (body: RoundInput) => {
    const target: string = url.value
    return $fetch<SavedRound>(target, { method: 'PATCH', body })
  },
  onSuccess: async (saved) => {
    await refresh()
    await navigateTo({
      path: `/tournaments/${id.value}`,
      query: saved.suggestedPlacement ? { placement: saved.suggestedPlacement } : {},
    })
  },
})
const confirmingDelete = ref(false)
const remove = useMutation({
  mutationFn: () => {
    const target: string = url.value
    return $fetch<null>(target, { method: 'DELETE' })
  },
  onSuccess: async () => {
    confirmingDelete.value = false
    await refresh()
    await navigateTo(`/tournaments/${id.value}`)
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
      <h1 class="text-2xl font-semibold">Edit Round</h1>
      <p v-if="tournament" class="text-muted-foreground text-sm">{{ tournament.name }}</p>
    </div>
    <p v-if="query.isPending.value" class="text-muted-foreground">Loading…</p>
    <Card v-else-if="!round">
      <CardHeader>
        <CardTitle>Round not found</CardTitle>
        <CardDescription>It may have been deleted.</CardDescription>
      </CardHeader>
    </Card>
    <template v-else-if="tournament">
      <RoundForm
        :tournament="tournament"
        :round="round"
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
      <Button variant="ghost" class="text-destructive self-start" @click="confirmingDelete = true">
        Delete Round
      </Button>
      <AlertDialog v-model:open="confirmingDelete">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Round?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the Round and its notes. The Opponent stays.
              <template v-if="losesTeam">
                Their Team in this Tournament is deleted too, as no other Round here is against
                them.
              </template>
              It can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Alert v-if="remove.isError.value" variant="destructive" role="alert">
            <AlertDescription>Couldn't delete the Round. Try again.</AlertDescription>
          </Alert>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="remove.isPending.value">Keep it</AlertDialogCancel>
            <Button
              variant="destructive"
              :disabled="remove.isPending.value"
              @click="remove.mutate()"
            >
              {{ remove.isPending.value ? 'Deleting…' : 'Delete Round' }}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </template>
  </div>
</template>

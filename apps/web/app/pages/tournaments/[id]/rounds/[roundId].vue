<script setup lang="ts">
import type { RoundInput, SavedRound } from '@myvgc/core/schema'
import { useMutation } from '@tanstack/vue-query'
import { fieldErrorsOf, saveFailureMessage } from '@/lib/api'
import { lostWithLastRound } from '@/lib/opponent-team'
import { RejectedChange } from '@/lib/outbox'
import { deleteRound, editRound, roundProblems } from '@/lib/outbox-writes'
import { tournamentPath } from '@/lib/paths'

const route = useRoute()
const id = computed(() => String(route.params.id))
const roundId = computed(() => String(route.params.roundId))
const { query, tournament } = useTournament(id)
const round = computed(() => tournament.value?.rounds.find((r) => r.id === roundId.value))
// Deleting the last Round against an Opponent deletes their Opponent's Team and Age Division here
// too (ADR 22, ADR 30).
const loses = computed(
  () =>
    tournament.value &&
    lostWithLastRound(tournament.value, roundId.value, round.value?.opponent?.id),
)
useHead({ title: 'Edit Round · MyVGC' })

// Kept on the phone first, so it works with no signal too, and sent when it can be (ADR 17).
const outbox = useOutbox()
const save = useMutation({
  // Runs with no signal too, as the outbox keeps the change (ADR 17).
  networkMode: 'always',
  mutationFn: ({ body, opponentName }: { body: RoundInput; opponentName: string | null }) => {
    // Checked here too, as with no signal the server can't say what is wrong with it.
    const problems = roundProblems(tournament.value!, body, roundId.value)
    if (problems) throw new RejectedChange(400, 'Invalid request', problems)
    return outbox.save(editRound(tournament.value!, round.value!, body, opponentName))
  },
  onSuccess: async (saved) => {
    const placement = saved.sent ? (saved.body as SavedRound).suggestedPlacement : null
    await navigateTo({
      path: tournamentPath(id.value),
      query: placement ? { placement } : {},
    })
  },
})
const confirmingDelete = ref(false)
const remove = useMutation({
  // Runs with no signal too, as the outbox keeps the change (ADR 17).
  networkMode: 'always',
  mutationFn: () => outbox.save(deleteRound(tournament.value!, round.value!)),
  onSuccess: async () => {
    confirmingDelete.value = false
    await navigateTo(tournamentPath(id.value))
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
        @submit="(body, opponentName) => save.mutate({ body, opponentName })"
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
              <template v-if="loses">
                Their {{ loses }} in this Tournament {{ loses.includes(' and ') ? 'are' : 'is' }}
                deleted too, as no other Round here is against them.
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

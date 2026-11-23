<script setup lang="ts">
import type { RoundInput, SavedRound } from '@myvgc/core/schema'
import { useMutation } from '@tanstack/vue-query'
import { fieldErrorsOf, saveFailureMessage } from '@/lib/api'
import { RejectedChange } from '@/lib/outbox'
import { logRound, roundProblems } from '@/lib/outbox-writes'
import { tournamentPath } from '@/lib/paths'

const route = useRoute()
const id = computed(() => String(route.params.id))
const { query, tournament } = useTournament(id)
useHead({ title: 'Log a Round · MyVGC' })

// Kept on the phone first, so it is logged with no signal too, and sent when it can be (ADR 17).
const outbox = useOutbox()
const save = useMutation({
  // Runs with no signal too, as the outbox keeps the change (ADR 17).
  networkMode: 'always',
  mutationFn: ({ body, opponentName }: { body: RoundInput; opponentName: string | null }) => {
    // Checked here too, as with no signal the server can't say what is wrong with it.
    const problems = roundProblems(tournament.value!, body)
    if (problems) throw new RejectedChange(400, 'Invalid request', problems)
    return outbox.save(logRound(tournament.value!, body, opponentName))
  },
  onSuccess: async (saved) => {
    const placement = saved.sent ? (saved.body as SavedRound).suggestedPlacement : null
    await navigateTo({
      path: tournamentPath(id.value),
      query: placement ? { placement } : {},
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
      @submit="(body, opponentName) => save.mutate({ body, opponentName })"
    >
      <template #problem>
        <Alert v-if="failure" variant="destructive" role="alert">
          <AlertDescription>{{ failure }}</AlertDescription>
        </Alert>
      </template>
    </RoundForm>
  </div>
</template>

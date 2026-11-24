<script setup lang="ts">
import { CircleAlertIcon } from '@lucide/vue'
import { newTournamentSchema } from '@myvgc/core/schema'
import { useMutation } from '@tanstack/vue-query'
import { checkBeforeSaving, fieldErrorsOf, saveFailureMessage } from '@/lib/api'
import { withWrite } from '@/lib/outbox-apply'
import type { OutboxWrite } from '@/lib/outbox-rules'
import { rejectedTournament } from '@/lib/outbox-view'
import { editTournament, reviseTournament, tournamentChangesFor } from '@/lib/outbox-writes'
import { tournamentPath } from '@/lib/paths'
import { type TournamentBody, tournamentToForm } from '@/lib/tournament-form'

const route = useRoute()
const id = computed(() => String(route.params.id))

const { query, tournament: cached } = useTournament(id)
const outbox = useOutbox()

// A new or changed Tournament the server refused (DEV-204): the form opens with the Tournament as
// that change had it, a banner with the server's message and the message next to the field it
// names. Saving sends the fixed change in its place; Discard drops it.
const rejected = computed(() => rejectedTournament(outbox.state.value, id.value))
const tournament = computed(() =>
  cached.value && rejected.value ? withWrite(cached.value, rejected.value) : cached.value,
)
const rejectedFields = computed(() =>
  rejected.value?.state.status === 'rejected' ? rejected.value.state.fields : undefined,
)
const rejectedMessage = computed(() =>
  rejected.value?.state.status === 'rejected' ? rejected.value.state.message : '',
)
const discarding = ref<OutboxWrite | null>(null)
// Discarding a new Tournament leaves nothing to go back to.
const leaveTo = ref('')
function startDiscarding(write: OutboxWrite) {
  leaveTo.value = write.kind === 'add-tournament' ? '/tournaments' : tournamentPath(id.value)
  discarding.value = write
}
useHead({
  title: computed(() =>
    tournament.value
      ? `${rejected.value ? 'Fix' : 'Edit'} ${tournament.value.name} · MyVGC`
      : 'Edit Tournament · MyVGC',
  ),
})

// Kept on the phone first, so it works with no signal too, and sent when it can be (ADR 17).
const save = useMutation({
  // Runs with no signal too, as the outbox keeps the change (ADR 17).
  networkMode: 'always',
  mutationFn: async (body: TournamentBody) => {
    const fixing = rejected.value
    // Checked here too, as with no signal the server can't say what is wrong with it.
    if (fixing?.kind === 'add-tournament')
      checkBeforeSaving(newTournamentSchema, { ...body, id: id.value })
    else checkBeforeSaving(tournamentChangesFor(cached.value!), body)
    if (!fixing) {
      await outbox.save(editTournament(tournament.value!, body))
      return true
    }
    const settlement = await outbox.resend(fixing.id, reviseTournament(fixing, body))
    // Refused again: the form shows the server's new message.
    return settlement?.outcome !== 'rejected'
  },
  onSuccess: async (done) => {
    if (done) await navigateTo(tournamentPath(id.value))
  },
})
const fieldErrors = computed(() => fieldErrorsOf(save.error.value) ?? rejectedFields.value)
// The form starts again from the change once it has been sent and refused again, not while it
// is on its way.
const formKey = ref('')
watchEffect(() => {
  if (!save.isPending.value)
    formKey.value = `${rejected.value?.id ?? 'tournament'}-${rejectedMessage.value}`
})
const failure = computed(() =>
  save.error.value && !fieldErrors.value ? saveFailureMessage(save.error.value, 'Tournament') : '',
)
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <h1 class="text-2xl font-semibold">
      {{ rejected ? 'Fix Tournament' : 'Edit Tournament' }}
    </h1>
    <p v-if="query.isPending.value && !tournament" class="text-muted-foreground">Loading…</p>
    <template v-else-if="tournament">
      <Alert v-if="rejected" variant="destructive" data-testid="rejected-banner">
        <CircleAlertIcon aria-hidden="true" />
        <AlertTitle>This change wasn't saved</AlertTitle>
        <AlertDescription>
          The server said: {{ rejectedMessage }} Change the field below and save, or discard the
          change.
        </AlertDescription>
      </Alert>
      <TournamentForm
        :key="formKey"
        :initial="tournamentToForm(tournament)"
        regulation-chosen
        :field-errors="fieldErrors"
        :pending="save.isPending.value"
        submit-label="Save changes"
        :cancel-to="tournamentPath(id)"
        @submit="save.mutate"
      >
        <template #problem>
          <Alert v-if="failure" variant="destructive" role="alert">
            <AlertDescription>{{ failure }}</AlertDescription>
          </Alert>
        </template>
      </TournamentForm>
      <Button
        v-if="rejected"
        variant="ghost"
        class="text-destructive self-start"
        @click="startDiscarding(rejected)"
      >
        Discard change
      </Button>
      <DiscardChangeDialog v-model="discarding" @discarded="navigateTo(leaveTo)" />
    </template>
    <Alert v-else-if="query.isError.value" variant="destructive" role="alert">
      <AlertDescription>Couldn't load this Tournament.</AlertDescription>
    </Alert>
  </div>
</template>

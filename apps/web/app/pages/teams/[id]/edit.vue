<script setup lang="ts">
import { CircleAlertIcon } from '@lucide/vue'
import type { TeamBody, TeamView } from '@myvgc/core/schema'
import { useQueryClient } from '@tanstack/vue-query'
import { withTeamWrite } from '@/lib/outbox-apply'
import type { OutboxWrite } from '@/lib/outbox-rules'
import { rejectedTeam } from '@/lib/outbox-view'
import { editTeam, reviseTeam } from '@/lib/outbox-writes'
import { teamPath } from '@/lib/paths'

const route = useRoute()
const id = computed(() => String(route.params.id))

const { query: teamQuery, team: cached } = useTeam(id)
const outbox = useOutbox()
const names = useChampionsNames()
const queryClient = useQueryClient()

// A new or changed Team the server refused (DEV-206): the Team builder opens with the Team as that
// change had it, a banner with the server's message and each message on the Pokémon build it
// names. Saving sends the fixed change in its place; Discard drops it.
const rejected = computed(() => rejectedTeam(outbox.state.value, id.value))
const team = computed(() =>
  cached.value && rejected.value ? withTeamWrite(cached.value, rejected.value) : cached.value,
)
const rejectedFields = computed(() =>
  rejected.value?.state.status === 'rejected' ? rejected.value.state.fields : undefined,
)
const rejectedMessage = computed(() =>
  rejected.value?.state.status === 'rejected' ? rejected.value.state.message : '',
)
// The builder starts again from the change once it has been sent and refused again, not while it
// is on its way.
const saving = ref(false)
const builderKey = ref('')
watchEffect(() => {
  if (!saving.value) builderKey.value = `${rejected.value?.id ?? 'team'}-${rejectedMessage.value}`
})

const discarding = ref<OutboxWrite | null>(null)
// Discarding a new Team leaves nothing to go back to.
const leaveTo = ref('')
function startDiscarding(write: OutboxWrite) {
  leaveTo.value = write.kind === 'add-team' ? '/teams' : teamPath(id.value)
  discarding.value = write
}

useHead({
  title: computed(() =>
    team.value
      ? `${rejected.value ? 'Fix' : 'Edit'} ${team.value.name} · MyVGC`
      : 'Edit Team · MyVGC',
  ),
})

// Kept on the phone first, so it works with no signal too, and checked by the server when it is
// sent (ADR 17).
async function save(body: TeamBody) {
  const fixing = rejected.value
  if (!fixing) {
    const saved = await outbox.save(editTeam(team.value!, body, names.data.value))
    // The server's Team, judged, in place of the one this phone showed.
    if (saved.sent) queryClient.setQueryData(['team', id.value], saved.body as TeamView)
    return id.value
  }
  saving.value = true
  try {
    const settlement = await outbox.resend(fixing.id, reviseTeam(fixing, body, names.data.value))
    // Refused again: the builder shows the server's new message.
    return settlement?.outcome === 'rejected' ? undefined : id.value
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <h1 class="text-2xl font-semibold">{{ rejected ? 'Fix Team' : 'Edit Team' }}</h1>
    <p v-if="teamQuery.isPending.value && !team" class="text-muted-foreground">Loading…</p>
    <template v-else-if="team">
      <Alert v-if="rejected" variant="destructive" data-testid="rejected-banner">
        <CircleAlertIcon aria-hidden="true" />
        <AlertTitle>This change wasn't saved</AlertTitle>
        <AlertDescription>
          The server said: {{ rejectedMessage }} Change the Pokémon marked below and save, or
          discard the change.
        </AlertDescription>
      </Alert>
      <TeamBuilder
        :key="builderKey"
        :initial="team"
        :save="save"
        :cancel-to="teamPath(id)"
        :server-errors="rejectedFields"
      />
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
    <Alert v-else variant="destructive" role="alert">
      <AlertDescription>Couldn't load this Team.</AlertDescription>
    </Alert>
  </div>
</template>

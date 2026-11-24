<script setup lang="ts">
import { CircleAlertIcon, ClockIcon, LockIcon, RefreshCwIcon, Trash2Icon } from '@lucide/vue'
import { useOnline } from '@vueuse/core'
import type { OutboxWrite } from '@/lib/outbox-rules'
import {
  changeDetail,
  changeList,
  changeTitle,
  type MarkStatus,
  waitingWrites,
} from '@/lib/outbox-view'
import { editTournamentPath, opponentPath, roundPath } from '@/lib/paths'

// The changes on this phone (DEV-167), opened from the bar at the bottom of the screen: each one
// waiting to be sent, and each the server refused with its message, to fix or discard.
const open = useChangesSheet()
const { $outbox } = useNuxtApp()
const { state, retry } = useOutbox()
const online = useOnline()
const items = computed(() => changeList(state.value))
const waiting = computed(() => waitingWrites(state.value).length)
const changes = (count: number) => (count === 1 ? '1 change' : `${count} changes`)

const icons: Record<MarkStatus, unknown> = {
  waiting: ClockIcon,
  sending: RefreshCwIcon,
  deleting: Trash2Icon,
  rejected: CircleAlertIcon,
}
const savedAt = (write: OutboxWrite) =>
  write.createdAt
    ? new Date(write.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''
const detailOf = (write: OutboxWrite) =>
  [changeDetail(write), savedAt(write) && `saved ${savedAt(write)}`].filter(Boolean).join(' · ')

/**
 * Where a rejected change opens to be fixed: a Round in the Round form, a new or changed
 * Tournament in the Tournament form, a new or changed Opponent in the form on their page, and the
 * Player details in Settings. Any other change is sent again as it is.
 */
function fixPath(write: OutboxWrite) {
  const { tournamentId, roundId, opponentId } = write.subject
  if ((write.kind === 'add-opponent' || write.kind === 'edit-opponent') && opponentId)
    return `${opponentPath(opponentId)}?fix`
  if (write.kind === 'save-player-details') return '/settings#player-details'
  if (!tournamentId) return undefined
  if ((write.kind === 'log-round' || write.kind === 'edit-round') && roundId)
    return roundPath(tournamentId, roundId)
  if (write.kind === 'add-tournament' || write.kind === 'edit-tournament')
    return editTournamentPath(tournamentId)
  return undefined
}
async function fix(write: OutboxWrite) {
  const path = fixPath(write)
  if (!path) return retry(write.id)
  open.value = false
  await navigateTo(path)
}
const discarding = ref<OutboxWrite | null>(null)
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      side="bottom"
      class="mx-auto max-h-[82dvh] w-full max-w-md overflow-y-auto rounded-t-2xl px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
      data-testid="changes-sheet"
    >
      <SheetHeader class="p-0 pr-8">
        <SheetTitle>Changes on this phone</SheetTitle>
        <SheetDescription v-if="!state.waitingForLogin || !waiting">
          <template v-if="!items.length">Everything is synced.</template>
          <template v-else-if="online"
            >Sent in the order you made them. Trying again every 30 seconds while the app is
            open.</template
          >
          <template v-else
            >No signal. These are saved on this phone and sent, in order, when the signal
            returns.</template
          >
        </SheetDescription>
      </SheetHeader>

      <Alert v-if="state.waitingForLogin && waiting" variant="destructive">
        <LockIcon aria-hidden="true" />
        <AlertTitle>Log in again to send {{ changes(waiting) }}</AlertTitle>
        <AlertDescription>
          <span
            >They stay on this phone until you do.
            <NuxtLink to="/login" class="font-semibold underline" @click="open = false"
              >Log in</NuxtLink
            ></span
          >
        </AlertDescription>
      </Alert>

      <ul class="flex flex-col gap-2">
        <li
          v-for="{ write, status } in items"
          :key="write.id"
          class="flex flex-col gap-2 rounded-lg border p-3"
          :class="{ 'border-destructive/40 bg-destructive/5': status === 'rejected' }"
          data-testid="change"
        >
          <div class="flex items-start gap-2">
            <component
              :is="icons[status]"
              class="mt-0.5 size-4 shrink-0"
              :class="[
                status === 'rejected' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400',
                { 'animate-spin motion-reduce:animate-none': status === 'sending' },
              ]"
              aria-hidden="true"
            />
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="font-medium break-words">{{ changeTitle(write) }}</span>
              <span v-if="detailOf(write)" class="text-muted-foreground text-xs">{{
                detailOf(write)
              }}</span>
              <span v-if="write.state.status === 'rejected'" class="text-destructive text-sm"
                >Not saved: {{ write.state.message }}</span
              >
            </div>
          </div>
          <div v-if="status === 'rejected'" class="flex flex-wrap gap-2">
            <Button size="sm" @click="fix(write)">{{
              fixPath(write) ? 'Fix' : 'Try again'
            }}</Button>
            <Button size="sm" variant="outline" @click="discarding = write">Discard</Button>
          </div>
        </li>
      </ul>

      <Button
        v-if="online && waiting && !state.waitingForLogin"
        variant="outline"
        class="w-full"
        @click="$outbox.flush()"
      >
        <RefreshCwIcon aria-hidden="true" /> Send now
      </Button>
    </SheetContent>
  </Sheet>
  <DiscardChangeDialog v-model="discarding" />
</template>

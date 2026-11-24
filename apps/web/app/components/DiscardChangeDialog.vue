<script setup lang="ts">
import type { OutboxWrite } from '@/lib/outbox-rules'
import { discardText } from '@/lib/outbox-view'

// Asks before discarding a change kept on this phone (DEV-167). A new Tournament, Round, Opponent,
// Note entry or Team never reached the account, so it goes from the phone, and a new Tournament,
// Opponent or Team takes the changes waiting on it along (DEV-204, DEV-205, DEV-206); for an edit
// or a delete, the server keeps its version.
const write = defineModel<OutboxWrite | null>({ required: true })
const emit = defineEmits<{ discarded: [] }>()
const { discard, state } = useOutbox()
const text = computed(() =>
  write.value
    ? discardText(write.value, [...state.value.pending, ...state.value.rejected])
    : undefined,
)
const open = computed({
  get: () => write.value !== null,
  set: (value) => {
    if (!value) write.value = null
  },
})

async function confirm() {
  if (!write.value) return
  await discard(write.value.id)
  write.value = null
  emit('discarded')
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ text?.title }}</AlertDialogTitle>
        <AlertDialogDescription>{{ text?.body }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep it</AlertDialogCancel>
        <Button variant="destructive" @click="confirm">Discard change</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

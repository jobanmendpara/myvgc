<script setup lang="ts">
import { useOnline } from '@vueuse/core'

// Asks before logging out loses changes the server doesn't have yet (ADR 17, DEV-167).
const question = useUnsyncedQuestion()
const online = useOnline()
const open = computed({
  get: () => !!question.value,
  set: (value) => {
    if (!value) question.value?.answer(false)
  },
})
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle
          >{{ unsyncedChangesText(question?.count ?? 0) }} Log out and lose them?</AlertDialogTitle
        >
        <AlertDialogDescription>
          Stay logged in and they are sent
          {{ online ? 'now' : 'when the signal returns' }}.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Stay logged in</AlertDialogCancel>
        <Button variant="destructive" @click="question?.answer(true)">Log out and lose them</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
// Asks before logging out loses changes the server doesn't have yet (ADR 17).
const question = useUnsyncedQuestion()
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
        <AlertDialogTitle>{{ unsyncedChangesText(question?.count ?? 0) }}</AlertDialogTitle>
        <AlertDialogDescription>
          Log out and lose them? Once you log out, they can't be sent.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep them</AlertDialogCancel>
        <Button variant="destructive" @click="question?.answer(true)">Log out and lose them</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

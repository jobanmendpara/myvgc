<script setup lang="ts">
// The "Discard changes?" dialog. Forms don't use it directly: `useDiscardGuard` returns it wired up.
defineProps<{
  open: boolean
  /** What the unsaved edits are to, such as "this Tournament". */
  subject: string
}>()
const emit = defineEmits<{ answer: [leave: boolean] }>()
</script>

<template>
  <AlertDialog :open="open" @update:open="(isOpen: boolean) => isOpen || emit('answer', false)">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Discard changes?</AlertDialogTitle>
        <AlertDialogDescription
          >Your edits to {{ subject }} haven't been saved.</AlertDialogDescription
        >
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep editing</AlertDialogCancel>
        <Button variant="destructive" @click="emit('answer', true)">Discard changes</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

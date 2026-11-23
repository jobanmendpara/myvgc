<script setup lang="ts">
// Settings' "Clear data on this device": removes the last known User and the saved query cache,
// then logs out (ADR 17). For a shared phone, or one about to change hands. Changes not yet synced
// are lost too, so it says so first.
const logOut = useLogOut()
const { unsynced } = useOutbox()
const open = ref(false)

async function clear() {
  open.value = false
  await logOut({ unsyncedConfirmed: true })
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <h3 class="font-medium">Data on this device</h3>
    <p class="text-muted-foreground text-sm">
      MyVGC keeps a copy of your data on this device so it opens without a connection. If you delete
      your account, a copy on another device is only removed when that device next connects.
    </p>
    <div>
      <AlertDialog v-model:open="open">
        <AlertDialogTrigger as-child>
          <Button variant="outline">Clear data on this device</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear data on this device?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the copy of your data kept on this device and logs you out. Your data on
              the server stays.
              <template v-if="unsynced">
                {{ unsyncedChangesText(unsynced) }} Clear data and lose them?
              </template>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" @click="clear">{{
              unsynced ? 'Clear and lose them' : 'Clear and log out'
            }}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </div>
</template>

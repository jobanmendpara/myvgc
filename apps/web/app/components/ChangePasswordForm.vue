<script setup lang="ts">
import { useMutation } from '@tanstack/vue-query'
import { useOnline } from '@vueuse/core'
import { authClient } from '@/lib/auth-client'

/** Changes the User's password through Better Auth. Online only; nothing is queued. */
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const logOutOtherDevices = ref(false)
const mismatch = ref(false)
const doneMessage = ref('')

const online = useOnline()
const change = useMutation({
  mutationFn: async () => {
    const { error } = await authClient.changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      revokeOtherSessions: logOutOtherDevices.value,
    })
    if (error) throw new Error(error.message || "Couldn't change your password. Try again.")
  },
  networkMode: 'always',
  onSuccess: () => {
    doneMessage.value = logOutOtherDevices.value
      ? 'Password changed. Your other devices are logged out.'
      : 'Password changed.'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    logOutOtherDevices.value = false
  },
})

watch([currentPassword, newPassword, confirmPassword], () => {
  mismatch.value = false
  if (change.error.value) change.reset()
  if (currentPassword.value || newPassword.value) doneMessage.value = ''
})

function submit() {
  if (newPassword.value !== confirmPassword.value) {
    mismatch.value = true
    return
  }
  change.mutate()
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="submit">
    <p v-if="!online" class="text-muted-foreground text-sm">
      Online only. Connect to change your password.
    </p>
    <fieldset :disabled="!online" class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <Label for="current-password">Current password</Label>
        <Input
          id="current-password"
          v-model="currentPassword"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>
      <div class="flex flex-col gap-2">
        <Label for="new-password">New password</Label>
        <Input
          id="new-password"
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          required
        />
      </div>
      <div class="flex flex-col gap-2">
        <Label for="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          required
          :aria-invalid="mismatch ? true : undefined"
          aria-describedby="confirm-password-error"
        />
        <p v-if="mismatch" id="confirm-password-error" class="text-destructive text-sm">
          The new passwords don't match.
        </p>
      </div>
      <label class="flex min-h-9 items-center gap-2 text-sm font-medium">
        <input v-model="logOutOtherDevices" type="checkbox" class="size-5" />
        Log out other devices
      </label>
    </fieldset>
    <Alert v-if="change.error.value" variant="destructive" role="alert">
      <AlertDescription>{{ change.error.value.message }}</AlertDescription>
    </Alert>
    <div class="flex items-center gap-3">
      <Button type="submit" variant="outline" :disabled="!online || change.isPending.value">
        {{ change.isPending.value ? 'Changing…' : 'Change password' }}
      </Button>
      <p v-if="doneMessage" class="text-muted-foreground text-sm" role="status">
        {{ doneMessage }}
      </p>
    </div>
  </form>
</template>

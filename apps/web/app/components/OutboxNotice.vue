<script setup lang="ts">
// The least the outbox must show so no change is lost silently (ADR 17): how many changes wait to
// be sent, whether they wait for a login, and each change the server refused, to retry or
// discard. How pending changes look on a phone is still to be designed (DEV-167).
const { state, discard, retry } = useOutbox()
const pending = computed(() => state.value.pending.length)
</script>

<template>
  <div
    v-if="pending || state.rejected.length"
    class="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 pt-3 text-sm"
    data-testid="outbox"
  >
    <p v-if="pending" class="text-muted-foreground" role="status" data-testid="outbox-pending">
      {{
        pending === 1
          ? '1 change saved on this phone, not yet sent.'
          : `${pending} changes saved on this phone, not yet sent.`
      }}
      <template v-if="state.waitingForLogin">
        Your session has ended:
        <NuxtLink to="/login" class="underline">log in again</NuxtLink> to send them.
      </template>
    </p>
    <Alert
      v-for="write in state.rejected"
      :key="write.id"
      variant="destructive"
      data-testid="outbox-rejected"
    >
      <AlertDescription class="flex flex-col gap-2">
        <span
          ><strong>{{ write.label }}</strong> wasn't saved.
          {{ write.state.status === 'rejected' ? write.state.message : '' }}</span
        >
        <span class="flex gap-2">
          <Button size="sm" variant="outline" @click="retry(write.id)">Try again</Button>
          <Button size="sm" variant="ghost" @click="discard(write.id)">Discard</Button>
        </span>
      </AlertDescription>
    </Alert>
  </div>
</template>

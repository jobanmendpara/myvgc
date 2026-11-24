<script setup lang="ts">
import { CircleAlertIcon, CloudOffIcon, RefreshCwIcon, Trash2Icon } from '@lucide/vue'
import { type ItemMark, MARK_TEXT } from '@/lib/outbox-view'

// The short mark on a Round, Note entry or Opponent not yet synced (DEV-167): "Not synced",
// "Sending", "Deleting when the signal returns" or, in red, "Not saved". The row it sits in
// gets the coloured left edge from `syncEdge`.
defineProps<{ mark: ItemMark }>()
const icons = {
  waiting: CloudOffIcon,
  sending: RefreshCwIcon,
  deleting: Trash2Icon,
  rejected: CircleAlertIcon,
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1 text-xs font-medium"
    :class="mark.status === 'rejected' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'"
    data-testid="sync-mark"
  >
    <component
      :is="icons[mark.status]"
      class="size-3.5 shrink-0"
      :class="{ 'animate-spin motion-reduce:animate-none': mark.status === 'sending' }"
      aria-hidden="true"
    />
    {{ MARK_TEXT[mark.status] }}
  </span>
</template>

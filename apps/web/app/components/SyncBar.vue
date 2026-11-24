<script setup lang="ts">
import {
  CheckIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  ClockIcon,
  CloudOffIcon,
  LockIcon,
  RefreshCwIcon,
} from '@lucide/vue'
import { type SyncBar, syncBarText } from '@/lib/outbox-view'

// The bar pinned above the bottom of the screen while changes wait on this phone (DEV-167,
// option B of DEV-162). Amber while they wait or are sent, red for a refused change or a
// session that ended, green for a moment once they have all gone. Tapping it opens the list of
// changes; when the session ended, it goes to the login page.
const props = defineProps<{ bar: SyncBar; online: boolean }>()
const sheet = useChangesSheet()
const text = computed(() => syncBarText(props.bar))
const tone = computed(() =>
  props.bar.kind === 'sent'
    ? 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
    : props.bar.kind === 'rejected' || props.bar.kind === 'login'
      ? 'border-destructive/40 bg-red-50 dark:bg-red-950'
      : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950',
)
const icon = computed(() => {
  switch (props.bar.kind) {
    case 'login':
      return LockIcon
    case 'rejected':
      return CircleAlertIcon
    case 'sending':
      return RefreshCwIcon
    case 'sent':
      return CheckIcon
    default:
      return props.online ? ClockIcon : CloudOffIcon
  }
})
const iconTone = computed(() =>
  props.bar.kind === 'rejected' || props.bar.kind === 'login'
    ? 'text-destructive'
    : props.bar.kind === 'sent'
      ? ''
      : 'text-amber-700 dark:text-amber-400',
)
const element = computed(() =>
  props.bar.kind === 'sent'
    ? 'div'
    : props.bar.kind === 'login'
      ? resolveComponent('NuxtLink')
      : 'button',
)
const attributes = computed(() =>
  props.bar.kind === 'sent'
    ? { role: 'status' }
    : props.bar.kind === 'login'
      ? { to: '/login' }
      : { type: 'button', 'aria-haspopup': 'dialog', onClick: () => (sheet.value = true) },
)
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
  >
    <component
      :is="element"
      v-bind="attributes"
      class="focus-visible:ring-ring/50 pointer-events-auto mx-auto flex w-full max-w-md items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left shadow-lg outline-none focus-visible:ring-3"
      :class="tone"
      :data-kind="bar.kind"
      data-testid="sync-bar"
    >
      <component
        :is="icon"
        class="size-4 shrink-0"
        :class="[iconTone, { 'animate-spin motion-reduce:animate-none': bar.kind === 'sending' }]"
        aria-hidden="true"
      />
      <span class="flex min-w-0 flex-1 flex-col text-xs">
        <strong class="text-sm font-semibold" :class="{ 'text-foreground': bar.kind !== 'sent' }">{{
          text.title
        }}</strong>
        <span v-if="text.detail" class="text-muted-foreground">{{ text.detail }}</span>
      </span>
      <ChevronUpIcon
        v-if="bar.kind !== 'sent' && bar.kind !== 'login'"
        class="text-muted-foreground size-4 shrink-0"
        aria-hidden="true"
      />
      <ChevronRightIcon
        v-if="bar.kind === 'login'"
        class="text-muted-foreground size-4 shrink-0"
        aria-hidden="true"
      />
    </component>
  </div>
</template>

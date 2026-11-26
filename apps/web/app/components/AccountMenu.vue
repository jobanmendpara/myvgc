<script setup lang="ts">
import { ChevronDownIcon, LogOutIcon, SettingsIcon, UserIcon } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { WORDINGS } from '@/composables/usePrototypeOfflineReady'

// The header's menu for the logged-in User: Settings and Log out. With no connection, the User
// is the last known one saved on the device (ADR 17).
const user = useCurrentUser()
const logOut = useLogOut()
// PROTOTYPE (DEV-246), variant C: a dot until the User opens Settings, and a status line.
const offline = usePrototypeOfflineReady()
const offlineDot = computed(() => offline.choices.value.variant === 'C' && offline.unseen.value)
const offlineLine = computed(() => {
  if (offline.choices.value.variant !== 'C') return undefined
  const words = WORDINGS[offline.choices.value.wording]
  if (offline.phase.value === 'downloading') {
    const count = offline.choices.value.progress === 'count' ? ` · ${offline.percent.value}%` : ''
    return `${words.downloading[offline.reason.value]}${count}`
  }
  return words.short
})

const MENU_ITEM =
  'data-[highlighted]:bg-muted flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 text-sm outline-none [&_svg]:size-4'
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="relative min-w-0" aria-label="Account">
        <UserIcon aria-hidden="true" />
        <span
          v-if="offlineDot"
          class="bg-primary absolute top-1 left-5 size-2 rounded-full"
          aria-hidden="true"
        />
        <span v-if="user" class="hidden max-w-56 truncate sm:inline" data-testid="current-user">
          {{ user.email }}
        </span>
        <ChevronDownIcon class="text-muted-foreground" aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="4"
        class="bg-popover text-popover-foreground z-30 min-w-40 rounded-md border p-1 shadow-md"
      >
        <DropdownMenuItem
          v-if="offlineLine"
          :class="MENU_ITEM"
          class="text-muted-foreground text-xs"
          @select="navigateTo('/settings#offline')"
        >
          <span v-if="offlineDot" class="bg-primary size-2 rounded-full" aria-hidden="true" />
          {{ offlineLine }}
        </DropdownMenuItem>
        <DropdownMenuItem :class="MENU_ITEM" @select="navigateTo('/settings')">
          <SettingsIcon aria-hidden="true" /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem :class="MENU_ITEM" @select="logOut()">
          <LogOutIcon aria-hidden="true" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

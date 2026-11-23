<script setup lang="ts">
import { ChevronDownIcon, LogOutIcon, SettingsIcon, UserIcon } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'

// The header's menu for the logged-in User: Settings and Log out. With no connection, the User
// is the last known one saved on the device (ADR 17).
const user = useCurrentUser()
const logOut = useLogOut()

const MENU_ITEM =
  'data-[highlighted]:bg-muted flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 text-sm outline-none [&_svg]:size-4'
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="min-w-0" aria-label="Account">
        <UserIcon aria-hidden="true" />
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
        <DropdownMenuItem :class="MENU_ITEM" @select="navigateTo('/settings')">
          <SettingsIcon aria-hidden="true" /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem :class="MENU_ITEM" @select="logOut">
          <LogOutIcon aria-hidden="true" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

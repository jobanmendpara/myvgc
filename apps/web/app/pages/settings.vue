<script setup lang="ts">
import { authClient } from '@/lib/auth-client'

useHead({ title: 'Settings · MyVGC' })

// Account settings are kept on the User; Device settings in this browser (see CONTEXT.md).
const session = authClient.useSession()
const logOut = useLogOut()
</script>

<template>
  <div class="flex flex-col gap-8">
    <h1 class="text-2xl font-semibold">Settings</h1>

    <section id="account" aria-labelledby="account-heading" class="flex scroll-mt-4 flex-col gap-4">
      <h2 id="account-heading" class="text-lg font-semibold">Account</h2>
      <div class="flex flex-col gap-1">
        <p class="text-sm font-medium">Email</p>
        <p class="text-muted-foreground text-sm break-all" data-testid="settings-email">
          {{ session.data?.user.email }}
        </p>
      </div>
      <div class="flex flex-col gap-3">
        <h3 class="font-medium">Change password</h3>
        <ChangePasswordForm />
      </div>
      <div>
        <Button variant="outline" @click="logOut">Log out</Button>
      </div>
    </section>

    <section
      id="player-details"
      aria-labelledby="player-details-heading"
      class="flex scroll-mt-4 flex-col gap-4"
    >
      <div class="flex flex-col gap-1">
        <h2 id="player-details-heading" class="text-lg font-semibold">Player details</h2>
        <p class="text-muted-foreground text-sm">
          Written onto your Teamsheets. All optional. Your date of birth is never kept: write it on
          the printed Teamsheet by hand.
        </p>
      </div>
      <PlayerDetailsForm />
    </section>

    <section
      id="appearance"
      aria-labelledby="appearance-heading"
      class="flex scroll-mt-4 flex-col gap-4"
    >
      <div class="flex flex-col gap-1">
        <h2 id="appearance-heading" class="text-lg font-semibold">Appearance</h2>
        <p class="text-muted-foreground text-sm">Saved on this device only.</p>
      </div>
      <ThemePicker />
    </section>
  </div>
</template>

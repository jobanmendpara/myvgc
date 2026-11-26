<template>
  <!-- A bar along the top while a page change waits on the session check or a page load. -->
  <NuxtLoadingIndicator color="var(--primary)" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <UpdateBanner />
  <UnsyncedChangesDialog />
  <!-- PROTOTYPE (DEV-246), throwaway: never merge to main. -->
  <PrototypeOfflineToast />
  <PrototypeOfflineReadyBar />
</template>

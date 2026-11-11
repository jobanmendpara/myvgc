<script setup lang="ts">
// The link from a page in the list and detail layout back to its list, such as "← Your Teams".
// It shows on phones only: on wide screens the list already sits beside the page.
defineProps<{ to: string }>()
const wide = useWideLayout()
</script>

<template>
  <NuxtLink v-if="!wide" :to="to" class="text-muted-foreground text-sm hover:underline"
    >← <slot
  /></NuxtLink>
</template>

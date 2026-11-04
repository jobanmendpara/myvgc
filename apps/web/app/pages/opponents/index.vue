<script setup lang="ts">
import { type OpponentView, formatRecord } from '@myvgc/core/schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import { fieldErrorsOf, saveFailureMessage } from '@/lib/api'

useHead({ title: 'Opponents · MyVGC' })

const search = ref('')
const q = refDebounced(search, 200)
const opponents = useQuery({
  queryKey: computed(() => ['opponents', 'search', q.value.trim()]),
  queryFn: () =>
    $fetch<OpponentView[]>('/api/opponents', { query: { q: q.value.trim() || undefined } }),
  placeholderData: (previous) => previous,
})

const adding = ref(false)
const newName = ref('')
const queryClient = useQueryClient()
const add = useMutation({
  mutationFn: () =>
    $fetch<OpponentView>('/api/opponents', {
      method: 'POST',
      body: { displayName: newName.value },
    }),
  onSuccess: async (created) => {
    await queryClient.invalidateQueries({ queryKey: ['opponents'] })
    await navigateTo(`/opponents/${created.id}`)
  },
})
const addError = computed(
  () =>
    fieldErrorsOf(add.error.value)?.displayName ??
    (add.error.value ? saveFailureMessage(add.error.value, 'Opponent') : ''),
)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold">Opponents</h1>
      <Button v-if="!adding" variant="outline" @click="adding = true">Add Opponent</Button>
    </div>

    <form
      v-if="adding"
      class="flex flex-col gap-2 rounded-lg border p-4"
      novalidate
      @submit.prevent="add.mutate()"
    >
      <Label for="new-opponent">Name</Label>
      <div class="flex gap-2">
        <Input id="new-opponent" v-model="newName" autocomplete="off" class="flex-1" />
        <Button type="submit" :disabled="add.isPending.value">Add</Button>
      </div>
      <p v-if="addError" class="text-destructive text-sm">{{ addError }}</p>
    </form>

    <div class="flex flex-col gap-2">
      <Label for="opponent-search" class="sr-only">Find an Opponent</Label>
      <Input
        id="opponent-search"
        v-model="search"
        type="search"
        autocomplete="off"
        placeholder="Find by name or Alias"
      />
    </div>

    <p v-if="opponents.isPending.value" class="text-muted-foreground">Loading…</p>
    <Alert v-else-if="opponents.isError.value" variant="destructive" role="alert">
      <AlertDescription>Couldn't load your Opponents.</AlertDescription>
    </Alert>
    <p
      v-else-if="opponents.data.value?.length === 0"
      class="text-muted-foreground"
      data-testid="opponents-empty"
    >
      {{
        q.trim()
          ? `No Opponents match “${q.trim()}”.`
          : 'Opponents you play in Tournament Rounds will appear here.'
      }}
    </p>
    <ul v-else class="flex flex-col divide-y rounded-lg border" data-testid="opponents-list">
      <li v-for="o in opponents.data.value" :key="o.id">
        <NuxtLink
          :to="`/opponents/${o.id}`"
          class="hover:bg-muted/50 focus-visible:ring-ring/50 flex items-center justify-between gap-3 p-3 outline-none focus-visible:ring-3"
        >
          <span class="flex min-w-0 flex-col">
            <span class="font-medium break-words">{{ o.displayName }}</span>
            <span v-if="o.aliases.length" class="text-muted-foreground truncate text-xs">{{
              o.aliases.join(', ')
            }}</span>
          </span>
          <span class="shrink-0 text-right text-sm">
            <span class="font-medium">{{ formatRecord(o.headToHead) }}</span>
            <span class="text-muted-foreground block text-xs">{{
              o.roundCount === 1 ? '1 Round' : `${o.roundCount} Rounds`
            }}</span>
          </span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

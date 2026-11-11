<script setup lang="ts">
import type { OpponentView } from '@myvgc/core/schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import { fieldErrorsOf, saveFailureMessage } from '@/lib/api'

definePageMeta({ listDetail: true })
useHead({ title: 'Opponents · MyVGC' })

const search = ref('')
const q = refDebounced(search, 200)
const opponents = useQuery({
  queryKey: computed(() => ['opponents', 'search', q.value.trim()]),
  queryFn: () =>
    $fetch<OpponentView[]>('/api/opponents', { query: { q: q.value.trim() || undefined } }),
  placeholderData: (previous) => previous,
})

// The Opponent open in the pane.
const route = useRoute()
const selectedId = computed(() => ('id' in route.params ? String(route.params.id) : ''))

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
    // On wide screens the list stays, so close the form for the next one.
    adding.value = false
    newName.value = ''
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
  <ListDetail base="/opponents" placeholder="Select an Opponent">
    <template #list="{ wide }">
      <div :class="wide ? 'flex flex-col' : 'mx-auto flex w-full max-w-3xl flex-col gap-6'">
        <div
          class="flex flex-col"
          :class="wide ? 'bg-background sticky top-0 z-10 gap-3 border-b p-3' : 'gap-6'"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 :class="wide ? 'text-lg font-semibold' : 'text-2xl font-semibold'">Opponents</h1>
            <Button
              v-if="!adding"
              variant="outline"
              :size="wide ? 'sm' : 'default'"
              @click="adding = true"
              >Add Opponent</Button
            >
          </div>

          <form
            v-if="adding"
            class="flex flex-col gap-2 rounded-lg border"
            :class="wide ? 'p-3' : 'p-4'"
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
        </div>

        <div :class="{ 'p-2': wide }">
          <p
            v-if="opponents.isPending.value"
            class="text-muted-foreground"
            :class="{ 'p-1': wide }"
          >
            Loading…
          </p>
          <Alert v-else-if="opponents.isError.value" variant="destructive" role="alert">
            <AlertDescription>Couldn't load your Opponents.</AlertDescription>
          </Alert>
          <p
            v-else-if="opponents.data.value?.length === 0"
            class="text-muted-foreground"
            :class="{ 'p-1 text-sm': wide }"
            data-testid="opponents-empty"
          >
            {{
              q.trim()
                ? `No Opponents match “${q.trim()}”.`
                : 'Opponents you play in Tournament Rounds will appear here.'
            }}
          </p>

          <!-- Rows for the list column; the List style control (DEV-88) will choose these. -->
          <ul v-else-if="wide" class="flex flex-col gap-1" data-testid="opponents-list">
            <li v-for="o in opponents.data.value" :key="o.id">
              <NuxtLink
                :to="`/opponents/${o.id}`"
                :aria-current="o.id === selectedId ? 'page' : undefined"
                class="hover:bg-muted/50 focus-visible:ring-ring/50 aria-[current=page]:border-primary aria-[current=page]:bg-card aria-[current=page]:ring-primary flex items-center justify-between gap-3 rounded-lg border border-transparent p-3 text-sm outline-none focus-visible:ring-3 aria-[current=page]:shadow-sm aria-[current=page]:ring-1"
              >
                <OpponentSummary :opponent="o" />
              </NuxtLink>
            </li>
          </ul>

          <ul v-else class="flex flex-col divide-y rounded-lg border" data-testid="opponents-list">
            <li v-for="o in opponents.data.value" :key="o.id">
              <NuxtLink
                :to="`/opponents/${o.id}`"
                class="hover:bg-muted/50 focus-visible:ring-ring/50 flex items-center justify-between gap-3 p-3 outline-none focus-visible:ring-3"
              >
                <OpponentSummary :opponent="o" />
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>
    </template>
    <NuxtPage />
  </ListDetail>
</template>

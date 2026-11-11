<script setup lang="ts">
import { type OpponentView, groupOpponents } from '@myvgc/core/schema'
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
      <ListColumn
        list="opponents"
        title="Opponents"
        :wide="wide"
        :class="{ 'mx-auto w-full max-w-3xl': !wide }"
        :pending="opponents.isPending.value"
        :error="
          opponents.isError.value
            ? `Couldn't load your Opponents. Check your connection and try again.`
            : undefined
        "
        :empty="opponents.data.value?.length === 0"
      >
        <template #actions>
          <Button
            v-if="!adding"
            variant="outline"
            :size="wide ? 'sm' : 'default'"
            @click="adding = true"
            >Add Opponent</Button
          >
        </template>

        <template #header>
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
        </template>

        <template #empty>
          <p
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
        </template>

        <template #default="{ listStyle }">
          <!-- While searching, the best matches come first, so the Grouped List style drops its headings. -->
          <ListRows
            :items="opponents.data.value ?? []"
            :list-style="listStyle"
            :wide="wide"
            :selected-id="selectedId"
            base="/opponents"
            :group-by="q.trim() ? undefined : groupOpponents"
            data-testid="opponents-list"
          >
            <template #default="{ item }">
              <OpponentSummary :opponent="item" :list-style="listStyle" />
            </template>
          </ListRows>
        </template>
      </ListColumn>
    </template>
    <NuxtPage />
  </ListDetail>
</template>

<script setup lang="ts">
import { type OpponentView, groupOpponents } from '@myvgc/core/schema'
import { searchOpponents } from '@myvgc/core/search'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fieldErrorsOf, saveFailureMessage } from '@/lib/api'

definePageMeta({ listDetail: true })
useHead({ title: 'Opponents · MyVGC' })

// The whole list, searched in the browser so it also works offline. The Round form's Opponent
// picker still searches on the server.
const opponents = useQuery({
  queryKey: ['opponents', 'list'],
  queryFn: () => $fetch<OpponentView[]>('/api/opponents'),
})
const groupBy = (items: OpponentView[]) => groupOpponents(items)
const { query, searching, results, noMatches } = useListSearch(
  'opponents',
  () => opponents.data.value,
  (items: OpponentView[], q: string) => searchOpponents(items, q),
)

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
        v-model:query="query"
        list="opponents"
        title="Opponents"
        noun="Opponents"
        search-placeholder="Find by name or Alias"
        :wide="wide"
        :class="{ 'mx-auto w-full max-w-3xl': !wide }"
        :pending="opponents.isPending.value"
        :error="
          opponents.isError.value
            ? `Couldn't load your Opponents. Check your connection and try again.`
            : undefined
        "
        :empty="opponents.data.value?.length === 0"
        :no-matches="noMatches"
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
        </template>

        <template #empty>
          <p
            class="text-muted-foreground"
            :class="{ 'p-1 text-sm': wide }"
            data-testid="opponents-empty"
          >
            Opponents you play in Tournament Rounds will appear here.
          </p>
        </template>

        <template #default="{ listStyle }">
          <ListRows
            :items="results"
            :list-style="listStyle"
            :wide="wide"
            :selected-id="selectedId"
            base="/opponents"
            :group-by="searching ? undefined : groupBy"
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

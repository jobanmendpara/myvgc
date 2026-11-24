<script setup lang="ts">
import { newOpponentSchema, type OpponentView } from '@myvgc/core/schema'
import { searchOpponents } from '@myvgc/core/search'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { checkBeforeSaving, fieldErrorsOf, saveFailureMessage } from '@/lib/api'
import { addOpponent } from '@/lib/outbox-writes'
import { fetchEveryOpponent } from '@/lib/opponent-list'
import { opponentPath } from '@/lib/paths'

definePageMeta({ listDetail: true })
useHead({ title: 'Opponents · MyVGC' })

// The whole list, searched in the browser so it also works offline. The Round form's Opponent
// picker searches on the server, and searches this list when the server can't be reached.
const opponents = useQuery({
  queryKey: ['opponents', 'list'],
  queryFn: () => fetchEveryOpponent(),
})
const { query, searching, results, noMatches } = useListSearch(
  'opponents',
  () => opponents.data.value,
  (items: OpponentView[], q: string) => searchOpponents(items, q),
)

const adding = ref(false)
const newName = ref('')
// Kept on the phone first, so an Opponent can be added with no signal too (ADR 17).
const outbox = useOutbox()
const add = useMutation({
  // Runs with no signal too, as the outbox keeps the change (ADR 17).
  networkMode: 'always',
  mutationFn: async () => {
    const write = addOpponent(newName.value.trim())
    // Checked here too, as with no signal the server can't say what is wrong with it.
    checkBeforeSaving(newOpponentSchema, write.request.body)
    await outbox.save(write)
    return write.subject.opponentId!
  },
  onSuccess: async (id) => {
    // On wide screens the list stays, so close the form for the next one.
    adding.value = false
    newName.value = ''
    await navigateTo(opponentPath(id))
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
        :load-failed="opponents.isError.value && !opponents.data.value"
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
          <OpponentRows
            :opponents="results"
            :list-style="listStyle"
            :wide="wide"
            :searching="searching"
          />
        </template>
      </ListColumn>
    </template>
    <NuxtPage />
  </ListDetail>
</template>

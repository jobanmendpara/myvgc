<script setup lang="ts">
import { MAX_TEAM_NAME_LENGTH, randomTeamName } from '@myvgc/core/schema'
import { ShuffleIcon } from '@lucide/vue'

/** A Team's name, with a button that swaps in a random one. */
defineProps<{ error?: string }>()
const name = defineModel<string>({ required: true })
</script>

<template>
  <div class="flex flex-col gap-2">
    <Label for="name">Name</Label>
    <div class="flex gap-2">
      <Input
        id="name"
        v-model="name"
        autocomplete="off"
        required
        :maxlength="MAX_TEAM_NAME_LENGTH"
        :aria-invalid="error ? true : undefined"
        aria-describedby="name-error"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="New name"
        title="New name"
        @click="name = randomTeamName()"
      >
        <ShuffleIcon aria-hidden="true" />
      </Button>
    </div>
    <p v-if="error" id="name-error" class="text-destructive text-sm">{{ error }}</p>
  </div>
</template>

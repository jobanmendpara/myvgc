<script setup lang="ts">
import {
  MAX_NOTES_LENGTH,
  MAX_REPLICA_TEAM_ID_LENGTH,
  REGULATIONS,
  type TeamFields,
} from '@myvgc/core/schema'

/**
 * The inputs for a Team's own fields, on every form that makes or edits one. A new Team field's
 * input goes here. The slot holds what comes between them and the notes: the paste, or the
 * Pokémon builds.
 */
defineProps<{ errors: Partial<Record<keyof TeamFields, string>> }>()
const fields = defineModel<TeamFields>('fields', { required: true })
</script>

<template>
  <TeamNameField v-model="fields.name" :error="errors.name" />

  <div class="flex flex-col gap-2">
    <Label for="regulation">Regulation</Label>
    <NativeSelect id="regulation" v-model="fields.regulation" class="w-40">
      <NativeSelectOption v-for="reg in REGULATIONS" :key="reg" :value="reg">
        Reg {{ reg }}
      </NativeSelectOption>
    </NativeSelect>
  </div>

  <div class="flex flex-col gap-2">
    <Label for="replica-team-id"
      >Replica Team ID <span class="text-muted-foreground font-normal">(optional)</span></Label
    >
    <Input
      id="replica-team-id"
      v-model="fields.replicaTeamId"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      class="w-60 font-mono uppercase"
      placeholder="9TCG84KWXK"
      :maxlength="MAX_REPLICA_TEAM_ID_LENGTH"
      :aria-invalid="errors.replicaTeamId ? true : undefined"
      aria-describedby="replica-team-id-hint replica-team-id-error"
    />
    <p id="replica-team-id-hint" class="text-muted-foreground text-sm">
      The code Champions gives this Battle Team as a Replica Team, for when a judge asks.
    </p>
    <p v-if="errors.replicaTeamId" id="replica-team-id-error" class="text-destructive text-sm">
      {{ errors.replicaTeamId }}
    </p>
  </div>

  <slot />

  <div class="flex flex-col gap-2">
    <Label for="notes"
      >Notes <span class="text-muted-foreground font-normal">(optional)</span></Label
    >
    <Textarea
      id="notes"
      v-model="fields.notes"
      rows="4"
      :maxlength="MAX_NOTES_LENGTH"
      placeholder="Leads, game plans, things to remember…"
      :aria-invalid="errors.notes ? true : undefined"
      aria-describedby="notes-error"
    />
    <p v-if="errors.notes" id="notes-error" class="text-destructive text-sm">
      {{ errors.notes }}
    </p>
  </div>
</template>

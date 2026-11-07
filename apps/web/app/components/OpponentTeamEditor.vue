<script setup lang="ts">
import { MAX_MOVES, MAX_TEAM_SIZE } from '@myvgc/core/schema'

/** One Pokémon of an Opponent's Team as the form holds it: empty fields are null. */
export interface TheirBuild {
  species: string
  ability: string | null
  item: string | null
  /** Always `MAX_MOVES` slots, so each has its own picker. */
  moves: (string | null)[]
}

/**
 * The Opponent's Team of one Opponent in one Tournament (ADR 22). Species are chips; tapping one
 * opens what an open teamsheet shows: ability, held item and moves.
 */
const pokemon = defineModel<TheirBuild[]>({ required: true })
const props = defineProps<{
  /** Messages keyed by field, such as `0.species` or `1.moves.2`. */
  errors: Record<string, string>
}>()

const names = useChampionsNames()
const nameOf = (species: string) => names.data.value?.species[species] ?? species

const opened = ref<string | null>(null)
const adding = ref<string | null>(null)

function add(species: string | null) {
  adding.value = null
  if (!species || pokemon.value.some((p) => p.species === species)) return
  if (pokemon.value.length >= MAX_TEAM_SIZE) return
  pokemon.value.push({ species, ability: null, item: null, moves: Array(MAX_MOVES).fill(null) })
}

function remove(index: number) {
  if (opened.value === pokemon.value[index]?.species) opened.value = null
  pokemon.value.splice(index, 1)
}

const errorsOf = (index: number) =>
  Object.entries(props.errors).filter(([field]) => field.split('.')[0] === String(index))
const error = (index: number, field: string) => props.errors[`${index}.${field}`]
</script>

<template>
  <div class="flex flex-col gap-3">
    <ul v-if="pokemon.length" class="flex flex-col gap-2" data-testid="their-team">
      <li
        v-for="(build, index) in pokemon"
        :key="build.species"
        class="rounded-md border"
        :data-testid="`their-pokemon-${index}`"
      >
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="focus-visible:ring-ring/50 flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-3 text-left text-sm font-medium outline-none focus-visible:ring-3"
            :aria-expanded="opened === build.species"
            @click="opened = opened === build.species ? null : build.species"
          >
            <span class="break-words">{{ nameOf(build.species) }}</span>
            <span v-if="errorsOf(index).length" class="text-destructive text-xs font-normal"
              >· check this Pokémon</span
            >
          </button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            :aria-label="`Remove ${nameOf(build.species)}`"
            @click="remove(index)"
            >Remove</Button
          >
        </div>
        <div v-if="opened === build.species" class="flex flex-col gap-4 border-t p-3">
          <p v-if="error(index, 'species')" class="text-destructive text-sm">
            {{ error(index, 'species') }}
          </p>
          <NamePicker
            :id="`their-${index}-ability`"
            v-model="build.ability"
            label="Ability"
            kind="abilities"
            :species="build.species"
            placeholder="Search all abilities"
            :error="error(index, 'ability')"
          />
          <NamePicker
            :id="`their-${index}-item`"
            v-model="build.item"
            label="Held item"
            kind="items"
            placeholder="Search items"
            :error="error(index, 'item')"
          />
          <fieldset class="flex flex-col gap-4">
            <legend class="mb-2 text-sm leading-none font-medium select-none">Moves</legend>
            <NamePicker
              v-for="slot in MAX_MOVES"
              :id="`their-${index}-move-${slot}`"
              :key="slot"
              v-model="build.moves[slot - 1]!"
              :label="`Move ${slot}`"
              kind="moves"
              placeholder="Search moves"
              :error="error(index, `moves.${slot - 1}`)"
            />
          </fieldset>
        </div>
      </li>
    </ul>
    <NamePicker
      v-if="pokemon.length < MAX_TEAM_SIZE"
      id="their-team-add"
      :model-value="adding"
      :label="pokemon.length ? 'Add another species' : 'Add a species'"
      kind="species"
      placeholder="Search Pokémon"
      @update:model-value="add"
    />
  </div>
</template>

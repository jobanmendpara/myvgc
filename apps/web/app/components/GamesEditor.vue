<script setup lang="ts">
import {
  GAME_SIDES,
  MAX_BROUGHT,
  MAX_LEADS,
  MAX_NOTES_LENGTH,
  ROUND_RESULTS,
  ROUND_RESULT_LABELS,
  type Game,
  type RoundResult,
} from '@myvgc/core/schema'

type Side = (typeof GAME_SIDES)[number]

/**
 * The Games of one Round (ADR 21). Each side's Pokémon are tap targets: tap once for Brought,
 * again for Lead, again to clear. The User's side offers their Team snapshot first; any other
 * species can be added from the names list, which works with no signal.
 */
const props = defineProps<{
  /** The Games to show, by number. Each is changed in place. */
  games: Game[]
  /** Species IDs to offer the User first: the Tournament's Team snapshot. */
  yours: string[]
  /** Messages for each Game's fields, keyed by Game number, then field such as `leads.0`. */
  errors: Record<number, Record<string, string>>
}>()

const names = useChampionsNames()
const nameOf = (species: string) => names.data.value?.species[species] ?? species

const sides: { side: Side; label: string; offered: () => string[] }[] = [
  { side: GAME_SIDES[0], label: 'You', offered: () => props.yours },
  // Their Team snapshot comes with DEV-55; until then, only what was added here.
  { side: GAME_SIDES[1], label: 'Opponent', offered: () => [] },
]

type ResultChoice = RoundResult | 'none'
const resultOptions: { value: ResultChoice; label: string }[] = [
  ...ROUND_RESULTS.map((value) => ({ value, label: ROUND_RESULT_LABELS[value] })),
  { value: 'none', label: 'Not recorded' },
]

/** The species offered first, then any other the User added. */
const choices = (game: Game, side: Side, offered: string[]) => [
  ...offered,
  ...game[side.brought].filter((species) => !offered.includes(species)),
]

const stateOf = (game: Game, side: Side, species: string) =>
  game[side.leads].includes(species)
    ? 'lead'
    : game[side.brought].includes(species)
      ? 'brought'
      : 'none'

const without = (list: string[], species: string) => {
  const index = list.indexOf(species)
  if (index !== -1) list.splice(index, 1)
}

function tap(game: Game, side: Side, species: string) {
  const brought = game[side.brought]
  const leads = game[side.leads]
  if (leads.includes(species)) {
    without(leads, species)
    without(brought, species)
  } else if (brought.includes(species)) {
    if (leads.length < MAX_LEADS) leads.push(species)
    else without(brought, species)
  } else if (brought.length < MAX_BROUGHT) {
    brought.push(species)
  }
}

// The "Other species…" picker of each side of each Game. Picking one brings it.
const adding = reactive<Record<string, string | null>>({})
const addKey = (game: Game, side: Side) => `${game.number}-${side.brought}`
function add(game: Game, side: Side, species: string | null) {
  adding[addKey(game, side)] = null
  if (species && !game[side.brought].includes(species) && game[side.brought].length < MAX_BROUGHT)
    game[side.brought].push(species)
}

function setResult(game: Game, value: ResultChoice | undefined) {
  game.result = !value || value === 'none' ? null : value
}

/** The first message for a side of a Game, whichever of its fields it is on. */
const sideError = (game: Game, side: Side) =>
  Object.entries(props.errors[game.number] ?? {}).find(
    ([field]) => field.startsWith(side.brought) || field.startsWith(side.leads),
  )?.[1]
</script>

<template>
  <div class="flex flex-col gap-4">
    <section
      v-for="game in props.games"
      :key="game.number"
      class="flex flex-col gap-4 rounded-lg border p-3"
      :aria-labelledby="`game-${game.number}-title`"
      :data-testid="`game-${game.number}`"
    >
      <h3 :id="`game-${game.number}-title`" class="font-medium">Game {{ game.number }}</h3>

      <fieldset
        v-for="{ side, label, offered } in sides"
        :key="side.brought"
        class="flex flex-col gap-2"
      >
        <legend class="mb-2 text-sm font-medium">
          {{ label }}
          <span class="text-muted-foreground font-normal">
            · {{ game[side.brought].length }}/{{ MAX_BROUGHT }} brought,
            {{ game[side.leads].length }}/{{ MAX_LEADS }} leads
          </span>
        </legend>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="species in choices(game, side, offered())"
            :key="species"
            type="button"
            :data-state="stateOf(game, side, species)"
            :disabled="
              stateOf(game, side, species) === 'none' && game[side.brought].length >= MAX_BROUGHT
            "
            class="focus-visible:ring-ring/50 data-[state=brought]:border-primary data-[state=lead]:border-primary data-[state=lead]:bg-primary data-[state=lead]:text-primary-foreground data-[state=brought]:bg-primary/10 flex min-h-11 items-center gap-1 rounded-md border px-3 text-sm font-medium outline-none focus-visible:ring-3 disabled:opacity-50"
            @click="tap(game, side, species)"
          >
            {{ nameOf(species) }}
            <span v-if="stateOf(game, side, species) !== 'none'" class="text-xs font-normal">
              · {{ stateOf(game, side, species) === 'lead' ? 'Lead' : 'Brought' }}
            </span>
          </button>
        </div>
        <NamePicker
          v-if="game[side.brought].length < MAX_BROUGHT"
          :id="`game-${game.number}-${side.brought}-other`"
          :model-value="adding[addKey(game, side)] ?? null"
          label="Other species…"
          kind="species"
          placeholder="Search Pokémon"
          @update:model-value="(species: string | null) => add(game, side, species)"
        />
        <p v-if="sideError(game, side)" class="text-destructive text-sm">
          {{ sideError(game, side) }}
        </p>
      </fieldset>

      <div class="flex flex-col gap-2">
        <ChoiceGroup
          :model-value="game.result ?? 'none'"
          :options="resultOptions"
          label="Result"
          :name="`game-${game.number}-result`"
          @update:model-value="(value: ResultChoice | undefined) => setResult(game, value)"
        />
        <p v-if="props.errors[game.number]?.result" class="text-destructive text-sm">
          {{ props.errors[game.number]?.result }}
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <Label :for="`game-${game.number}-notes`"
          >Notes <span class="text-muted-foreground font-normal">(optional)</span></Label
        >
        <Textarea
          :id="`game-${game.number}-notes`"
          v-model="game.notes"
          rows="2"
          :maxlength="MAX_NOTES_LENGTH"
        />
      </div>
    </section>
  </div>
</template>

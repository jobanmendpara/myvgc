<script setup lang="ts">
import {
  type LegalityProblem,
  moveProblems,
  type NamedPokemonBuild,
  STAT_IDS,
  STAT_LABELS,
  wholeBuildProblems,
} from '@myvgc/core/schema'
import { MOVE_TYPE_ICON_SIZE, powerAccuracyLabel, powerAccuracyText } from '@/lib/icons'

const props = defineProps<{ build: NamedPokemonBuild; problems?: LegalityProblem[] }>()

const title = computed(() =>
  props.build.nickname
    ? `${props.build.nickname} (${props.build.names.species})`
    : props.build.names.species,
)
// Each move's problems show by that move; the rest below the build.
const buildWarnings = computed(() => wholeBuildProblems(props.problems ?? []))
const moveWarnings = computed(() =>
  props.build.names.moves.map((_, index) => moveProblems(props.problems ?? [], index)),
)
// Shown only once something about the spread is known, so a partly known Opponent's build
// doesn't show stat values as if they were real.
const spreadKnown = computed(
  () => Boolean(props.build.nature) || STAT_IDS.some((stat) => props.build.statPoints[stat] > 0),
)
const values = useStatValues(() => props.build)
const { style: spriteStyle } = useSpriteStyle()
const { moveLayout } = useBuildCardDisplay()

// Types and power/accuracy come from the names list (DEV-222); until it has loaded, the build
// shows no Type icons and each move a gap where its Type icon goes.
const names = useChampionsNames()
const types = computed(() => names.data.value?.typesBySpecies[props.build.species] ?? [])
const moveRows = computed(() =>
  props.build.names.moves.map((name, index) => {
    const id = props.build.moves[index] ?? ''
    const powerAccuracy = names.data.value?.powerAndAccuracy[id]
    return {
      name,
      type: names.data.value?.moveTypes[id],
      powerAccuracy: powerAccuracy && {
        text: powerAccuracyText(powerAccuracy),
        label: powerAccuracyLabel(powerAccuracy),
      },
    }
  }),
)
</script>

<template>
  <article class="flex flex-col gap-3 rounded-lg border p-4" data-testid="pokemon-build">
    <!-- Inline: the Sprite before the title. Leading slot: a slot left of the title and item.
         Stacked tiles: in the top-right corner. The Type icons sit at the top right, under the
         Sprite with Stacked tiles (DEV-218). -->
    <header
      class="flex justify-between gap-3"
      :class="spriteStyle === 'leading-slot' ? 'items-center' : 'items-start'"
    >
      <div class="flex min-w-0 items-center gap-3">
        <Sprite
          v-if="spriteStyle === 'leading-slot'"
          :species="build.species"
          surface="build-card"
        />
        <div class="flex min-w-0 flex-col gap-0.5">
          <h2 class="flex items-center gap-1.5 font-semibold">
            <Sprite v-if="spriteStyle === 'inline'" :species="build.species" surface="build-card" />
            <span class="min-w-0 break-words"
              >{{ title }}
              <span v-if="build.gender" class="text-muted-foreground font-normal"
                >({{ build.gender }})</span
              ></span
            >
          </h2>
          <p v-if="build.names.item" class="text-muted-foreground flex items-center gap-1 text-sm">
            <span>@</span>
            <ItemIcon v-if="build.item" :item="build.item" />
            <span class="min-w-0">{{ build.names.item }}</span>
          </p>
        </div>
      </div>
      <div
        v-if="spriteStyle === 'stacked-tiles' || types.length"
        class="flex shrink-0 flex-col items-end gap-1"
      >
        <Sprite
          v-if="spriteStyle === 'stacked-tiles'"
          :species="build.species"
          surface="build-card"
        />
        <div v-if="types.length" class="flex gap-1" data-testid="build-types">
          <TypeIcon v-for="type in types" :key="type" :type="type" />
        </div>
      </div>
    </header>

    <!-- Each value stays on one line: one that can't fit beside its label moves under it,
         still at the right (DEV-223). -->
    <dl class="flex flex-col gap-y-1 text-sm">
      <div v-if="build.names.ability" class="flex flex-wrap justify-between gap-x-3">
        <dt class="text-muted-foreground whitespace-nowrap">Ability</dt>
        <dd class="ml-auto whitespace-nowrap">{{ build.names.ability }}</dd>
      </div>
      <div v-if="build.names.nature" class="flex flex-wrap justify-between gap-x-3">
        <dt class="text-muted-foreground whitespace-nowrap">Stat Alignment</dt>
        <dd class="ml-auto whitespace-nowrap">{{ build.names.nature }}</dd>
      </div>
    </dl>

    <!-- One column: a Type icon before each move's name, which stays on one line, and its
         power/accuracy at the right. -->
    <ul
      v-if="moveRows.length"
      class="grid gap-1.5 text-sm"
      :class="moveLayout === 'one-column' ? 'grid-cols-1' : 'grid-cols-2'"
      aria-label="Moves"
    >
      <li
        v-for="(move, index) in moveRows"
        :key="index"
        class="bg-muted flex flex-col gap-1 rounded px-2 py-1"
      >
        <span class="flex items-center gap-1.5">
          <TypeIcon :type="move.type" :size="MOVE_TYPE_ICON_SIZE" />
          <span class="min-w-0 flex-1 truncate whitespace-nowrap" :title="move.name">{{
            move.name
          }}</span>
          <span
            v-if="moveLayout === 'one-column' && move.powerAccuracy"
            class="text-muted-foreground shrink-0 text-xs tabular-nums"
            :aria-label="move.powerAccuracy.label"
            >{{ move.powerAccuracy.text }}</span
          >
        </span>
        <LegalityWarnings v-if="moveWarnings[index]?.length" :problems="moveWarnings[index]!" />
      </li>
    </ul>

    <div v-if="spreadKnown">
      <h3 class="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Stats</h3>
      <dl class="grid grid-cols-6 gap-1 text-center text-sm">
        <div
          v-for="stat in STAT_IDS"
          :key="stat"
          class="rounded border py-1"
          :data-testid="`stat-${stat}`"
        >
          <!-- The ▲ or ▼ stays beside the label on one line (DEV-212). A stat box can be under
               30 px wide inside, so the box has no side padding, there's only a hairline gap
               and the mark is drawn a little smaller than the label. -->
          <dt
            class="text-muted-foreground flex items-center justify-center gap-px text-xs whitespace-nowrap"
          >
            {{ STAT_LABELS[stat]
            }}<StatAlignmentMark
              class="text-[0.625rem]"
              :stat-alignment="build.nature"
              :stat="stat"
            />
          </dt>
          <dd class="font-medium tabular-nums">{{ values?.[stat] ?? '—' }}</dd>
          <dd
            class="text-muted-foreground text-xs tabular-nums"
            :aria-label="`${build.statPoints[stat]} Stat Points`"
          >
            {{ build.statPoints[stat] }}
          </dd>
        </div>
      </dl>
    </div>

    <LegalityWarnings v-if="buildWarnings.length" :problems="buildWarnings" />
  </article>
</template>

<script setup lang="ts">
import {
  type LegalityProblem,
  moveProblems,
  type NamedPokemonBuild,
  STAT_IDS,
  STAT_LABELS,
  wholeBuildProblems,
} from '@myvgc/core/schema'

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
</script>

<template>
  <article class="flex flex-col gap-3 rounded-lg border p-4" data-testid="pokemon-build">
    <!-- Inline: the Sprite before the title. Leading slot: a slot left of the title and item.
         Stacked tiles: in the top-right corner. -->
    <header
      class="flex gap-3"
      :class="{
        'items-center': spriteStyle === 'leading-slot',
        'items-start justify-between': spriteStyle === 'stacked-tiles',
      }"
    >
      <Sprite v-if="spriteStyle === 'leading-slot'" :species="build.species" surface="build-card" />
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
        <p v-if="build.names.item" class="text-muted-foreground text-sm">
          @ {{ build.names.item }}
        </p>
      </div>
      <Sprite
        v-if="spriteStyle === 'stacked-tiles'"
        :species="build.species"
        surface="build-card"
      />
    </header>

    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <template v-if="build.names.ability">
        <dt class="text-muted-foreground">Ability</dt>
        <dd>{{ build.names.ability }}</dd>
      </template>
      <template v-if="build.names.nature">
        <dt class="text-muted-foreground">
          Stat Alignment <span class="font-normal">(Nature)</span>
        </dt>
        <dd>{{ build.names.nature }}</dd>
      </template>
    </dl>

    <ul v-if="build.names.moves.length" class="grid grid-cols-2 gap-1.5 text-sm" aria-label="Moves">
      <li
        v-for="(move, index) in build.names.moves"
        :key="index"
        class="bg-muted flex flex-col gap-1 rounded px-2 py-1"
      >
        {{ move }}
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

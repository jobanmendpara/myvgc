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
const hasStatPoints = computed(() => STAT_IDS.some((stat) => props.build.statPoints[stat] > 0))
</script>

<template>
  <article class="flex flex-col gap-3 rounded-lg border p-4" data-testid="pokemon-build">
    <header class="flex flex-col gap-0.5">
      <h2 class="font-semibold break-words">
        {{ title }}
        <span v-if="build.gender" class="text-muted-foreground font-normal"
          >({{ build.gender }})</span
        >
      </h2>
      <p v-if="build.names.item" class="text-muted-foreground text-sm">@ {{ build.names.item }}</p>
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

    <div v-if="hasStatPoints">
      <h3 class="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
        Stat Points
      </h3>
      <dl class="grid grid-cols-6 gap-1 text-center text-sm">
        <div v-for="stat in STAT_IDS" :key="stat" class="rounded border px-0.5 py-1">
          <dt class="text-muted-foreground text-xs">{{ STAT_LABELS[stat] }}</dt>
          <dd :class="build.statPoints[stat] ? 'font-medium' : 'text-muted-foreground'">
            {{ build.statPoints[stat] }}
          </dd>
        </div>
      </dl>
    </div>

    <LegalityWarnings v-if="buildWarnings.length" :problems="buildWarnings" />
  </article>
</template>

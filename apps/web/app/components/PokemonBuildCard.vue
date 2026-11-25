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
// PROTOTYPE (DEV-218)
const { variant, speciesTypes, moveType } = usePrototypeIcons()
const types = computed(() => speciesTypes(props.build.species) ?? [])
</script>

<template>
  <article class="flex flex-col gap-3 rounded-lg border p-4" data-testid="pokemon-build">
    <!-- Inline: the Sprite before the title. Leading slot: a slot left of the title and item.
         Stacked tiles: in the top-right corner. -->
    <!-- PROTOTYPE (DEV-218): Type icons top right; three variants. -->
    <header
      class="flex gap-3"
      :class="{
        'items-center': spriteStyle === 'leading-slot',
        'items-start': spriteStyle !== 'leading-slot',
      }"
    >
      <Sprite v-if="spriteStyle === 'leading-slot'" :species="build.species" surface="build-card" />
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
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
          <template v-if="variant === 'B'">
            <PrototypeItemIcon v-if="build.item" :item="build.item" :size="20" />
          </template>
          <template v-else>
            <span>@</span>
            <PrototypeItemIcon v-if="build.item" :item="build.item" :size="variant === 'C' ? 20 : 16" />
          </template>
          <span>{{ build.names.item }}</span>
        </p>
      </div>

      <!-- A: one row of 20 px squares; with Stacked tiles they sit under the Sprite. -->
      <div
        v-if="variant === 'A'"
        class="flex shrink-0 items-end gap-1"
        :class="spriteStyle === 'stacked-tiles' ? 'flex-col' : 'flex-row'"
      >
        <Sprite v-if="spriteStyle === 'stacked-tiles'" :species="build.species" surface="build-card" />
        <div v-if="types.length" class="flex gap-1">
          <PrototypeTypeIcon v-for="type in types" :key="type" :type="type" :size="20" />
        </div>
      </div>

      <!-- B: a column of 24 px squares; with Stacked tiles, 18 px badges overlap the Sprite. -->
      <div v-else-if="variant === 'B'" class="shrink-0">
        <div v-if="spriteStyle === 'stacked-tiles'" class="relative">
          <Sprite :species="build.species" surface="build-card" />
          <div class="absolute -right-1 -bottom-1 flex gap-0.5">
            <PrototypeTypeIcon v-for="type in types" :key="type" :type="type" :size="18" />
          </div>
        </div>
        <div v-else class="flex flex-col gap-1">
          <PrototypeTypeIcon v-for="type in types" :key="type" :type="type" :size="24" />
        </div>
      </div>

      <!-- C: pills with the type's name; with Stacked tiles the pills sit left of the Sprite. -->
      <div v-else class="flex shrink-0 items-start gap-2">
        <div class="flex flex-col items-end gap-1">
          <PrototypeTypeIcon v-for="type in types" :key="type" :type="type" :size="18" label />
        </div>
        <Sprite v-if="spriteStyle === 'stacked-tiles'" :species="build.species" surface="build-card" />
      </div>
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

    <!-- PROTOTYPE (DEV-218): a Type icon before each move's name. -->
    <ul v-if="build.names.moves.length" class="grid grid-cols-2 gap-1.5 text-sm" aria-label="Moves">
      <li
        v-for="(move, index) in build.names.moves"
        :key="index"
        class="bg-muted flex flex-col gap-1 rounded"
        :class="variant === 'B' ? 'overflow-hidden' : 'px-2 py-1'"
      >
        <span v-if="variant === 'B'" class="flex items-stretch">
          <span class="flex shrink-0 items-center bg-black/10 p-1 dark:bg-white/5">
            <PrototypeTypeIcon :type="moveType(build.moves[index]!)" :size="20" />
          </span>
          <span class="flex min-w-0 items-center px-2 py-1">{{ move }}</span>
        </span>
        <span v-else class="flex items-center gap-1.5">
          <PrototypeTypeIcon :type="moveType(build.moves[index]!)" :size="variant === 'C' ? 18 : 16" />
          <span class="min-w-0">{{ move }}</span>
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
          class="rounded border px-0.5 py-1"
          :data-testid="`stat-${stat}`"
        >
          <dt class="text-muted-foreground text-xs">
            {{ STAT_LABELS[stat] }}
            <StatAlignmentMark :stat-alignment="build.nature" :stat="stat" />
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

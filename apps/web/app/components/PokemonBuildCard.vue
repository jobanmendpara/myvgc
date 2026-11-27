<script setup lang="ts">
import {
  type LegalityProblem,
  moveProblems,
  type NamedPokemonBuild,
  STAT_IDS,
  STAT_LABELS,
  wholeBuildProblems,
} from '@myvgc/core/schema'
import {
  BADGE_MOVE_TYPE_ICON_SIZE,
  BADGE_TYPE_ICON_SIZE,
  LABELLED_MOVE_TYPE_ICON_SIZE,
  LABELLED_TYPE_ICON_SIZE,
  LARGE_ITEM_ICON_SIZE,
  MOVE_TYPE_ICON_SIZE,
  powerAccuracyLabel,
  powerAccuracyText,
  STACKED_BADGE_TYPE_ICON_SIZE,
} from '@/lib/icons'

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
const { typeIconStyle, moveLayout } = useBuildCardDisplay()
const stacked = computed(() => spriteStyle.value === 'stacked-tiles')
const badges = computed(() => typeIconStyle.value === 'badges')
// Labelled pills go in a row under the item with Stacked tiles, and stacked at the top right
// with Inline and Leading slot (DEV-244).
const labelled = computed(() => typeIconStyle.value === 'labelled')
const labelledUnderItem = computed(() => labelled.value && stacked.value)
const itemUnderPills = computed(
  () =>
    labelled.value &&
    spriteStyle.value === 'leading-slot' &&
    Boolean(props.build.names.item) &&
    types.value.length > 0,
)
const moveTypeIconSize = computed(() =>
  typeIconStyle.value === 'labelled' ? LABELLED_MOVE_TYPE_ICON_SIZE : MOVE_TYPE_ICON_SIZE,
)

// Types and power/accuracy come from the names list (DEV-222); until it has loaded, the build
// shows no Type icons and each move a gap where its Type icon goes.
const names = useChampionsNames()
// PROTOTYPE (DEV-265): detail tooltips, and variant C's card-level ⓘ.
const { variant: tipVariant } = usePrototypeTooltips()
const inlineDetails = ref(false)
const pokedex = usePrototypePokedexData()
const types = computed(() => names.data.value?.typesBySpecies[props.build.species] ?? [])
const moveRows = computed(() =>
  props.build.names.moves.map((name, index) => {
    const id = props.build.moves[index] ?? ''
    const powerAccuracy = names.data.value?.powerAndAccuracy[id]
    return {
      name,
      id,
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
         Stacked tiles: in the top-right corner. The Type icons show in the page's Type icon
         style (DEV-218, DEV-226): Compact, a row at the top right, under a Stacked tile's
         Sprite; Badges, a column at the top right, or over a Stacked tile's bottom-right corner;
         Labelled, pills stacked at the top right, or in a row under a Stacked tile's item
         (DEV-244). With Leading slot the item runs under the pills, so a long item name keeps
         the width right of the Sprite and stays on one line: the header turns into a grid, and
         the wrappers step aside (`contents`) so the Sprite, title and item are its cells. -->
    <header
      :class="
        itemUnderPills
          ? 'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5'
          : [
              'flex justify-between gap-3',
              spriteStyle === 'leading-slot' ? 'items-center' : 'items-start',
            ]
      "
    >
      <div :class="itemUnderPills ? 'contents' : 'flex min-w-0 items-center gap-3'">
        <Sprite
          v-if="spriteStyle === 'leading-slot'"
          :class="{ 'row-span-2': itemUnderPills }"
          :species="build.species"
          surface="build-card"
        />
        <div :class="itemUnderPills ? 'contents' : 'flex min-w-0 flex-col gap-0.5'">
          <h2
            class="flex items-center gap-1.5 font-semibold"
            :class="{ 'col-start-2 row-start-1 min-w-0': itemUnderPills }"
          >
            <Sprite v-if="spriteStyle === 'inline'" :species="build.species" surface="build-card" />
            <span class="min-w-0 break-words"
              >{{ title }}
              <span v-if="build.gender" class="text-muted-foreground font-normal"
                >({{ build.gender }})</span
              ></span
            >
          </h2>
          <!-- Badges: the Item icon takes the place of the @, which stays when there's no icon
               to show. -->
          <p
            v-if="build.names.item"
            class="text-muted-foreground flex items-center gap-1 text-sm"
            :class="{ 'col-span-2 col-start-2 row-start-2 min-w-0': itemUnderPills }"
          >
            <span v-if="!(badges && build.item)">@</span>
            <ItemIcon
              v-if="build.item"
              :item="build.item"
              :size="typeIconStyle === 'compact' ? undefined : LARGE_ITEM_ICON_SIZE"
            />
            <span
              v-if="labelled"
              class="min-w-0 truncate whitespace-nowrap"
              :title="build.names.item"
              ><PrototypeDetail kind="items" :id="build.item ?? undefined">{{ build.names.item }}</PrototypeDetail></span
            >
            <span v-else class="min-w-0"><PrototypeDetail kind="items" :id="build.item ?? undefined">{{ build.names.item }}</PrototypeDetail></span>
          </p>
          <div
            v-if="labelledUnderItem && types.length"
            class="mt-1 flex flex-wrap gap-1"
            data-testid="build-types"
          >
            <PrototypeDetail kind="types" :types="types" trigger-class="flex flex-wrap gap-1">
            <TypeIcon
              v-for="type in types"
              :key="type"
              :type="type"
              :size="LABELLED_TYPE_ICON_SIZE"
              labelled
            />
            </PrototypeDetail>
          </div>
        </div>
      </div>
      <div v-if="badges && stacked" class="relative shrink-0">
        <Sprite :species="build.species" surface="build-card" />
        <div
          v-if="types.length"
          class="absolute -right-1 -bottom-1 flex gap-0.5"
          data-testid="build-types"
        >
          <PrototypeDetail kind="types" :types="types" trigger-class="flex gap-0.5">
          <TypeIcon
            v-for="type in types"
            :key="type"
            :type="type"
            :size="STACKED_BADGE_TYPE_ICON_SIZE"
          />
          </PrototypeDetail>
        </div>
      </div>
      <div
        v-else-if="badges && types.length"
        class="flex shrink-0 flex-col gap-1"
        data-testid="build-types"
      >
        <PrototypeDetail kind="types" :types="types" trigger-class="flex flex-col gap-1">
        <TypeIcon v-for="type in types" :key="type" :type="type" :size="BADGE_TYPE_ICON_SIZE" />
        </PrototypeDetail>
      </div>
      <div
        v-else-if="labelled && !stacked && types.length"
        class="flex shrink-0 flex-col items-end gap-1"
        :class="{ 'col-start-3 row-start-1 self-start': itemUnderPills }"
        data-testid="build-types"
      >
        <PrototypeDetail kind="types" :types="types" trigger-class="flex flex-col items-end gap-1">
        <TypeIcon
          v-for="type in types"
          :key="type"
          :type="type"
          :size="LABELLED_TYPE_ICON_SIZE"
          labelled
        />
        </PrototypeDetail>
      </div>
      <div
        v-else-if="stacked || (typeIconStyle === 'compact' && types.length)"
        class="flex shrink-0 flex-col items-end gap-1"
      >
        <Sprite v-if="stacked" :species="build.species" surface="build-card" />
        <div
          v-if="typeIconStyle === 'compact' && types.length"
          class="flex gap-1"
          data-testid="build-types"
        >
          <PrototypeDetail kind="types" :types="types" trigger-class="flex gap-1">
          <TypeIcon v-for="type in types" :key="type" :type="type" />
          </PrototypeDetail>
        </div>
      </div>
    </header>

    <!-- Each value stays on one line: one that can't fit beside its label moves under it,
         still at the right (DEV-223). -->
    <dl class="flex flex-col gap-y-1 text-sm">
      <div v-if="build.names.ability" class="flex flex-wrap justify-between gap-x-3">
        <dt class="text-muted-foreground whitespace-nowrap">Ability</dt>
        <dd class="ml-auto whitespace-nowrap"><PrototypeDetail kind="abilities" :id="build.ability ?? undefined">{{ build.names.ability }}</PrototypeDetail></dd>
      </div>
      <div v-if="build.names.nature" class="flex flex-wrap justify-between gap-x-3">
        <dt class="text-muted-foreground whitespace-nowrap">Stat Alignment</dt>
        <dd class="ml-auto whitespace-nowrap">{{ build.names.nature }}</dd>
      </div>
    </dl>

    <!-- PROTOTYPE (DEV-265) variant C: details inline, from the card's own ⓘ. -->
    <div
      v-if="tipVariant === 'C' && inlineDetails"
      class="bg-muted/50 flex flex-col gap-2 rounded-md p-2 text-xs"
    >
      <p v-if="build.item && pokedex.data.value?.items[build.item]">
        <span class="font-medium">{{ build.names.item }}:</span>
        <span class="text-muted-foreground ml-1">{{ pokedex.data.value.items[build.item]!.shortDesc }}</span>
      </p>
      <p v-if="build.ability && pokedex.data.value?.abilities[build.ability]">
        <span class="font-medium">{{ build.names.ability }}:</span>
        <span class="text-muted-foreground ml-1">{{ pokedex.data.value.abilities[build.ability]!.shortDesc }}</span>
      </p>
      <PrototypeDetailContent v-if="types.length" kind="types" :types="types" />
    </div>

    <!-- A Type icon before each move's name, which stays on one line; in Badges it sits in a
         shaded block on the row's left edge. One column shows power/accuracy at the right; Two
         columns hides it and cuts a name that doesn't fit with "…", the whole name in the
         tooltip (DEV-226). -->
    <ul
      v-if="moveRows.length"
      class="grid gap-1.5 text-sm"
      :class="moveLayout === 'one-column' ? 'grid-cols-1' : 'grid-cols-2'"
      aria-label="Moves"
    >
      <li
        v-for="(move, index) in moveRows"
        :key="index"
        class="bg-muted flex min-w-0 flex-col gap-1 rounded"
        :class="badges ? 'overflow-hidden' : 'px-2 py-1'"
      >
        <span class="flex items-stretch gap-1.5">
          <span
            v-if="badges"
            class="flex shrink-0 items-center bg-black/10 p-1 dark:bg-white/5"
            data-testid="move-type-badge"
          >
            <TypeIcon :type="move.type" :size="BADGE_MOVE_TYPE_ICON_SIZE" />
          </span>
          <TypeIcon v-else class="self-center" :type="move.type" :size="moveTypeIconSize" />
          <span class="flex min-w-0 flex-1 items-center gap-1.5" :class="{ 'py-1 pr-2': badges }">
            <span class="min-w-0 flex-1 truncate whitespace-nowrap" :title="move.name"><PrototypeDetail kind="moves" :id="move.id">{{
              move.name
            }}</PrototypeDetail></span>
            <span
              v-if="moveLayout === 'one-column' && move.powerAccuracy"
              class="text-muted-foreground shrink-0 text-xs tabular-nums"
              :aria-label="move.powerAccuracy.label"
              >{{ move.powerAccuracy.text }}</span
            >
          </span>
        </span>
        <p
          v-if="tipVariant === 'C' && inlineDetails && pokedex.data.value?.moves[move.id]"
          class="text-muted-foreground px-0.5 text-xs"
          :class="{ 'px-2 pb-1': badges }"
        >
          {{ pokedex.data.value.moves[move.id]!.shortDesc }}
        </p>
        <LegalityWarnings
          v-if="moveWarnings[index]?.length"
          :class="{ 'px-2 pb-1': badges }"
          :problems="moveWarnings[index]!"
        />
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
    <button
      v-if="tipVariant === 'C'"
      type="button"
      class="text-muted-foreground hover:text-foreground -mb-1 flex items-center gap-1 self-start text-xs"
      :aria-expanded="inlineDetails"
      @click="inlineDetails = !inlineDetails"
    >
      ⓘ {{ inlineDetails ? 'Hide details' : 'Details' }}
    </button>
  </article>
</template>

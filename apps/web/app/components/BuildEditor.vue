<script setup lang="ts">
import {
  type LegalityProblem,
  MAX_MOVES,
  MAX_NICKNAME_LENGTH,
  MAX_STAT_POINTS,
  MAX_TOTAL_STAT_POINTS,
  moveProblems,
  STAT_ALIGNMENTS,
  STAT_IDS,
  STAT_LABELS,
  type StatId,
  statAlignmentLabel,
  totalStatPoints,
  wholeBuildProblems,
} from '@myvgc/core/schema'
import { MinusIcon, PlusIcon } from '@lucide/vue'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { type BuildDraft, moveField, sentMoveIndex } from '@/lib/team-form'

/**
 * The editor for one slot's Pokémon build: full screen on a phone, a side panel on desktop.
 * Edits apply to the form straight away; the Team's one Save button saves them.
 */
const props = defineProps<{
  index: number
  errors: Record<string, string>
  /** What's illegal about this build, live as it's edited. These never stop a save (ADR 18). */
  problems?: LegalityProblem[]
}>()
const open = defineModel<boolean>('open', { required: true })
const build = defineModel<BuildDraft>('build', { required: true })

const error = (field: string) => props.errors[`pokemon.${props.index}.${field}`]
const moveError = (picker: number) => props.errors[moveField(build.value, props.index, picker)]
// Each move's problems show by its picker; the rest at the top.
const buildWarnings = computed(() => wholeBuildProblems(props.problems ?? []))
const moveWarnings = (picker: number) =>
  moveProblems(props.problems ?? [], sentMoveIndex(build.value, picker))

const moreHasError = computed(() => Boolean(error('nickname') || error('gender')))
const remaining = computed(() => MAX_TOTAL_STAT_POINTS - totalStatPoints(build.value.statPoints))
// Live as Stat Points, the Stat Alignment or the species change.
const values = useStatValues(build)

function setStat(stat: StatId, value: string | number) {
  build.value.statPoints[stat] = Math.max(0, Math.trunc(Number(value) || 0))
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/50" />
      <DialogContent
        :aria-describedby="undefined"
        class="bg-background fixed inset-0 z-40 flex flex-col gap-5 overflow-y-auto p-4 outline-none sm:left-auto sm:w-[28rem] sm:border-l sm:p-6"
        data-testid="build-editor"
      >
        <div class="flex items-center justify-between gap-3">
          <DialogTitle class="text-lg font-semibold">Pokémon {{ props.index + 1 }}</DialogTitle>
          <Button type="button" @click="open = false">Done</Button>
        </div>

        <ReadFlags :flags="build.readFlags" />

        <LegalityWarnings v-if="buildWarnings.length" :problems="buildWarnings" />

        <NamePicker
          id="build-species"
          v-model="build.species"
          label="Species"
          kind="species"
          placeholder="Search species"
          :error="error('species')"
        />
        <NamePicker
          id="build-ability"
          v-model="build.ability"
          label="Ability"
          kind="abilities"
          :species="build.species"
          placeholder="Search all abilities"
          :error="error('ability')"
        />
        <NamePicker
          id="build-item"
          v-model="build.item"
          label="Held item"
          kind="items"
          placeholder="Search items"
          :error="error('item')"
        />

        <div class="flex flex-col gap-2">
          <Label for="build-nature"
            >Stat Alignment <span class="text-muted-foreground font-normal">(Nature)</span></Label
          >
          <NativeSelect
            id="build-nature"
            v-model="build.nature"
            class="w-full"
            :aria-invalid="error('nature') ? true : undefined"
            aria-describedby="build-nature-error"
          >
            <NativeSelectOption value="">None</NativeSelectOption>
            <NativeSelectOption
              v-for="alignment in STAT_ALIGNMENTS"
              :key="alignment.id"
              :value="alignment.id"
            >
              {{ statAlignmentLabel(alignment) }}
            </NativeSelectOption>
          </NativeSelect>
          <p v-if="error('nature')" id="build-nature-error" class="text-destructive text-sm">
            {{ error('nature') }}
          </p>
        </div>

        <fieldset class="flex flex-col gap-4">
          <legend class="mb-2 text-sm leading-none font-medium select-none">Moves</legend>
          <NamePicker
            v-for="picker in MAX_MOVES"
            :id="`build-move-${picker}`"
            :key="picker"
            v-model="build.moves[picker - 1]!"
            :label="`Move ${picker}`"
            kind="moves"
            placeholder="Search moves"
            :error="build.moves[picker - 1] ? moveError(picker - 1) : undefined"
            :problems="build.moves[picker - 1] ? moveWarnings(picker - 1) : undefined"
          />
          <p v-if="error('moves')" class="text-destructive text-sm">{{ error('moves') }}</p>
        </fieldset>

        <fieldset class="flex flex-col gap-3">
          <legend class="mb-2 flex w-full justify-between gap-2 text-sm font-medium select-none">
            <span>Stat Points</span>
            <span class="text-muted-foreground font-normal" data-testid="stat-points-remaining"
              >{{ Math.max(0, remaining) }} remaining of {{ MAX_TOTAL_STAT_POINTS }}</span
            >
          </legend>
          <div v-for="stat in STAT_IDS" :key="stat" class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <Label :for="`build-stat-${stat}`" class="w-10">{{ STAT_LABELS[stat] }}</Label>
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="size-11"
                :aria-label="`Lower ${STAT_LABELS[stat]}`"
                :disabled="build.statPoints[stat] <= 0"
                @click="setStat(stat, build.statPoints[stat] - 1)"
              >
                <MinusIcon aria-hidden="true" />
              </Button>
              <Input
                :id="`build-stat-${stat}`"
                :model-value="String(build.statPoints[stat])"
                type="number"
                inputmode="numeric"
                min="0"
                :max="MAX_STAT_POINTS"
                autocomplete="off"
                class="h-11 w-20 text-center"
                :aria-invalid="error(`statPoints.${stat}`) ? true : undefined"
                :aria-describedby="`build-stat-${stat}-error`"
                @update:model-value="setStat(stat, $event)"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="size-11"
                :aria-label="`Raise ${STAT_LABELS[stat]}`"
                :disabled="build.statPoints[stat] >= MAX_STAT_POINTS || remaining <= 0"
                @click="setStat(stat, build.statPoints[stat] + 1)"
              >
                <PlusIcon aria-hidden="true" />
              </Button>
              <output
                :for="`build-stat-${stat}`"
                class="ml-auto flex min-w-14 items-center justify-end gap-1 tabular-nums"
                :aria-label="`${STAT_LABELS[stat]} stat value`"
                :data-testid="`stat-value-${stat}`"
              >
                <StatAlignmentMark :stat-alignment="build.nature" :stat="stat" />
                <span :class="values ? 'font-medium' : 'text-muted-foreground'">{{
                  values?.[stat] ?? '—'
                }}</span>
              </output>
            </div>
            <p
              v-if="error(`statPoints.${stat}`)"
              :id="`build-stat-${stat}-error`"
              class="text-destructive text-sm"
            >
              {{ error(`statPoints.${stat}`) }}
            </p>
          </div>
          <p v-if="error('statPoints')" class="text-destructive text-sm">
            {{ error('statPoints') }}
          </p>
        </fieldset>

        <details class="flex flex-col gap-4" :open="moreHasError">
          <summary class="min-h-11 cursor-pointer py-2 text-sm font-medium">More</summary>
          <div class="flex flex-col gap-4 pt-2">
            <div class="flex flex-col gap-2">
              <Label for="build-nickname"
                >Nickname <span class="text-muted-foreground font-normal">(optional)</span></Label
              >
              <Input
                id="build-nickname"
                v-model="build.nickname"
                autocomplete="off"
                :maxlength="MAX_NICKNAME_LENGTH"
                :aria-invalid="error('nickname') ? true : undefined"
                aria-describedby="build-nickname-error"
              />
              <p
                v-if="error('nickname')"
                id="build-nickname-error"
                class="text-destructive text-sm"
              >
                {{ error('nickname') }}
              </p>
            </div>
            <div class="flex flex-col gap-2">
              <Label for="build-gender">Gender</Label>
              <NativeSelect id="build-gender" v-model="build.gender" class="w-full">
                <NativeSelectOption value="">Not set</NativeSelectOption>
                <NativeSelectOption value="M">Male</NativeSelectOption>
                <NativeSelectOption value="F">Female</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>
        </details>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

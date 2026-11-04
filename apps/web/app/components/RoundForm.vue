<script setup lang="ts">
import {
  BEST_OF,
  MAX_NOTES_LENGTH,
  ROUND_RESULTS,
  ROUND_RESULT_LABELS,
  TOP_CUT_STAGES,
  TOP_CUT_STAGE_LABELS,
  type BestOf,
  type GameScore,
  type RoundInput,
  type RoundPhase,
  type RoundResult,
  type RoundView,
  type TopCutStage,
  type TournamentView,
} from '@myvgc/core/schema'
import type { OpponentChoice } from './OpponentPicker.vue'

const props = defineProps<{
  tournament: TournamentView
  /** The Round being changed, or nothing to log a new one. */
  round?: RoundView
  fieldErrors?: Record<string, string>
  pending: boolean
}>()
const emit = defineEmits<{ submit: [body: RoundInput] }>()

const logged = computed(() => props.tournament.rounds.filter((r) => r.id !== props.round?.id))
const nextNumber = computed(() => Math.max(0, ...logged.value.map((r) => r.roundNumber ?? 0)) + 1)
const nextStage = computed(
  () =>
    TOP_CUT_STAGES.find(
      (stage, index) =>
        !logged.value.some((r) => r.stage === stage) &&
        // The stage after the latest one logged, or the first free one.
        (logged.value.some((r) => r.stage === TOP_CUT_STAGES[index - 1]) ||
          !logged.value.some((r) => r.stage)),
    ) ?? 'top-8',
)

// A Game score, as one of the choices below. "none" means only the result is recorded.
type ScoreChoice = 'none' | '2-0' | '2-1' | '1-2' | '0-2' | '1-1'
const SCORES: { value: ScoreChoice; label: string }[] = [
  { value: '2-0', label: '2-0' },
  { value: '2-1', label: '2-1' },
  { value: '1-2', label: '1-2' },
  { value: '0-2', label: '0-2' },
  { value: '1-1', label: '1-1' },
  { value: 'none', label: 'No score' },
]
const toScore = (choice: ScoreChoice): GameScore | null => {
  if (choice === 'none') return null
  const [won, lost] = choice.split('-').map(Number)
  return { won: won!, lost: lost! }
}
const fromScore = (score: GameScore | null): ScoreChoice => {
  const key = score ? `${score.won}-${score.lost}` : 'none'
  return SCORES.some((s) => s.value === key) ? (key as ScoreChoice) : 'none'
}

const r = props.round
const phase = ref<RoundPhase>(r?.phase ?? (logged.value.some((x) => x.stage) ? 'top-cut' : 'swiss'))
const roundNumber = ref(String(r?.roundNumber ?? nextNumber.value))
const stage = ref<TopCutStage>(r?.stage ?? nextStage.value)
const bestOf = ref<BestOf>(r?.bestOf ?? props.tournament.defaultBestOf)
const bye = ref(r?.bye ?? false)
const result = ref<RoundResult | undefined>(r && !r.gameScore && !r.bye ? r.result : undefined)
const score = ref<ScoreChoice>(fromScore(r?.gameScore ?? null))
const opponent = ref<OpponentChoice | null>(
  r?.opponent ? { kind: 'existing', id: r.opponent.id, displayName: r.opponent.displayName } : null,
)
const notes = ref(r?.notes ?? '')

const phaseOptions = [
  { value: 'swiss' as const, label: 'Swiss' },
  { value: 'top-cut' as const, label: 'Top cut' },
]
const stageOptions = TOP_CUT_STAGES.map((value) => ({ value, label: TOP_CUT_STAGE_LABELS[value] }))
const bestOfOptions = BEST_OF.map((value) => ({ value, label: `Best of ${value}` }))
const resultOptions = ROUND_RESULTS.map((value) => ({ value, label: ROUND_RESULT_LABELS[value] }))

const scored = computed(() => bestOf.value === 3 && score.value !== 'none')
const localError = ref<Record<string, string>>({})
const error = (field: string) => localError.value[field] ?? props.fieldErrors?.[field]

function submit() {
  localError.value = {}
  const number = Number(roundNumber.value)
  if (phase.value === 'swiss' && !(Number.isInteger(number) && number >= 1)) {
    localError.value = { roundNumber: 'Use a round number such as 3.' }
    return
  }
  emit('submit', {
    phase: phase.value,
    roundNumber: phase.value === 'swiss' ? number : null,
    stage: phase.value === 'top-cut' ? stage.value : null,
    bestOf: bestOf.value,
    bye: bye.value,
    result: bye.value || scored.value ? null : (result.value ?? null),
    gameScore: bye.value || !scored.value ? null : toScore(score.value),
    opponentId: !bye.value && opponent.value?.kind === 'existing' ? opponent.value.id : null,
    newOpponentName:
      !bye.value && opponent.value?.kind === 'new' ? opponent.value.displayName : null,
    notes: notes.value,
  })
}
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
    <ChoiceGroup v-model="phase" :options="phaseOptions" label="Phase" name="phase" />

    <div v-if="phase === 'swiss'" class="flex flex-col gap-2">
      <Label for="round-number">Round</Label>
      <Input
        id="round-number"
        v-model="roundNumber"
        inputmode="numeric"
        class="w-24"
        :aria-invalid="error('roundNumber') ? true : undefined"
        aria-describedby="round-number-error"
      />
      <p v-if="error('roundNumber')" id="round-number-error" class="text-destructive text-sm">
        {{ error('roundNumber') }}
      </p>
    </div>
    <div v-else class="flex flex-col gap-2">
      <ChoiceGroup v-model="stage" :options="stageOptions" label="Stage" name="stage" />
      <p v-if="error('stage')" class="text-destructive text-sm">{{ error('stage') }}</p>
    </div>

    <label class="flex min-h-9 items-center gap-2 text-sm font-medium">
      <input v-model="bye" type="checkbox" class="size-5" />
      Bye (no Opponent, counts as a win)
    </label>

    <template v-if="!bye">
      <OpponentPicker
        v-model="opponent"
        :error="error('opponent') ?? error('opponentId') ?? error('newOpponentName')"
      />

      <ChoiceGroup v-model="bestOf" :options="bestOfOptions" label="Best of" name="best-of" />

      <div v-if="bestOf === 3" class="flex flex-col gap-2">
        <ChoiceGroup
          v-model="score"
          :options="SCORES"
          label="Game score (yours first)"
          name="score"
        />
        <p v-if="error('gameScore')" class="text-destructive text-sm">{{ error('gameScore') }}</p>
      </div>

      <div v-if="!scored" class="flex flex-col gap-2">
        <ChoiceGroup v-model="result" :options="resultOptions" label="Result" name="result" />
        <p v-if="error('result')" class="text-destructive text-sm">{{ error('result') }}</p>
      </div>
    </template>

    <div class="flex flex-col gap-2">
      <Label for="round-notes"
        >Notes <span class="text-muted-foreground font-normal">(optional)</span></Label
      >
      <Textarea
        id="round-notes"
        v-model="notes"
        rows="4"
        :maxlength="MAX_NOTES_LENGTH"
        placeholder="Leads, what they brought, key turns…"
      />
    </div>

    <slot name="problem" />

    <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button as-child variant="outline" size="lg"
        ><NuxtLink :to="`/tournaments/${tournament.id}`">Cancel</NuxtLink></Button
      >
      <Button type="submit" size="lg" :disabled="pending">
        {{ pending ? 'Saving…' : round ? 'Save Round' : 'Log Round' }}
      </Button>
    </div>
  </form>
</template>

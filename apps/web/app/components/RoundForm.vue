<script setup lang="ts">
import {
  BEST_OF,
  GAME_NUMBERS,
  MAX_NOTES_LENGTH,
  ROUND_RESULTS,
  ROUND_RESULT_LABELS,
  TOP_CUT_STAGES,
  TOP_CUT_STAGE_LABELS,
  type BestOf,
  type Game,
  type GameScore,
  type RoundInput,
  type RoundPhase,
  type RoundResult,
  type RoundView,
  type TopCutStage,
  type TournamentView,
  isEmptyGame,
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
// The stage after the latest one logged. The first Top cut Round defaults to Top 8, the most
// common cut, and the User picks another if theirs was bigger.
const nextStage = computed((): TopCutStage => {
  const latest = Math.max(
    -1,
    ...logged.value.map((r) => (r.stage ? TOP_CUT_STAGES.indexOf(r.stage) : -1)),
  )
  return latest === -1
    ? 'top-8'
    : (TOP_CUT_STAGES[Math.min(latest + 1, TOP_CUT_STAGES.length - 1)] ?? 'finals')
})

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

// A draft of every Game. Only those with something recorded are sent.
const emptyGame = (number: Game['number']): Game => ({
  number,
  brought: [],
  leads: [],
  opponentBrought: [],
  opponentLeads: [],
  result: null,
  notes: '',
})
const copyGame = (game: Game): Game => ({
  ...game,
  brought: [...game.brought],
  leads: [...game.leads],
  opponentBrought: [...game.opponentBrought],
  opponentLeads: [...game.opponentLeads],
})
const games = ref<Game[]>(
  GAME_NUMBERS.map((n) => {
    const saved = r?.games.find((g) => g.number === n)
    return saved ? copyGame(saved) : emptyGame(n)
  }),
)
// Games beyond best-of stay in view while they hold anything, so they're never dropped unseen.
const shownGames = computed(() =>
  games.value.filter((g) => g.number <= bestOf.value || !isEmptyGame(g)),
)
const recordedCount = computed(() => games.value.filter((g) => !isEmptyGame(g)).length)
const yours = computed(() => props.tournament.team?.pokemon.map((p) => p.species) ?? [])
// The numbers of the Games last sent, as the API names their fields by position.
const sentNumbers = ref<number[]>([])
const gameErrors = computed(() => {
  const byNumber: Record<number, Record<string, string>> = {}
  for (const [field, message] of Object.entries(props.fieldErrors ?? {})) {
    const [, position, ...rest] = field.split('.')
    const number = sentNumbers.value[Number(position)]
    if (!field.startsWith('games.') || number === undefined || !rest.length) continue
    ;(byNumber[number] ??= {})[rest.join('.')] = message
  }
  return byNumber
})
// The Games are only rendered while their section is open; the drafts above keep them meanwhile.
// It opens by itself when the API reports a problem with them.
const gamesOpen = ref(recordedCount.value > 0)
watch(
  () => Object.keys(gameErrors.value).length > 0 || Boolean(props.fieldErrors?.games),
  (problem) => {
    if (problem) gamesOpen.value = true
  },
)

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
  const recorded = games.value.filter((g) => !isEmptyGame(g)).map(copyGame)
  sentNumbers.value = recorded.map((g) => g.number)
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
    // Sent even with a Bye, so the API says to remove them rather than them vanishing.
    games: recorded,
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
    <p v-if="bye && error('games')" class="text-destructive text-sm">
      {{ error('games') }} Untick Bye to see them.
    </p>

    <template v-if="!bye">
      <OpponentPicker
        v-model="opponent"
        :error="error('opponent') ?? error('opponentId') ?? error('newOpponentName')"
      />

      <div class="flex flex-col gap-2">
        <ChoiceGroup v-model="bestOf" :options="bestOfOptions" label="Best of" name="best-of" />
        <p v-if="error('bestOf')" class="text-destructive text-sm">{{ error('bestOf') }}</p>
      </div>

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

      <details
        class="group flex flex-col gap-3"
        :open="gamesOpen"
        data-testid="games"
        @toggle="gamesOpen = ($event.target as HTMLDetailsElement).open"
      >
        <summary class="flex min-h-11 cursor-pointer items-center text-sm font-medium">
          Games
          <span class="text-muted-foreground ml-1 font-normal"
            >({{ recordedCount ? `${recordedCount} recorded` : 'optional' }})</span
          >
        </summary>
        <p class="text-muted-foreground mb-3 text-sm">
          Game results that finish the Round fill in its score and result.
        </p>
        <p v-if="error('games')" class="text-destructive mb-3 text-sm">{{ error('games') }}</p>
        <GamesEditor v-if="gamesOpen" :games="shownGames" :yours="yours" :errors="gameErrors" />
      </details>
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
        placeholder="Key turns, what to remember for next time…"
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

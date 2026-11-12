<script setup lang="ts">
import {
  BEST_OF,
  GAME_NUMBERS,
  MAX_NOTES_LENGTH,
  MAX_TEAM_SIZE,
  ROUND_RESULTS,
  ROUND_RESULT_LABELS,
  TOP_CUT_STAGES,
  TOP_CUT_STAGE_LABELS,
  type BestOf,
  type Game,
  type GameScore,
  type OpponentTeamInput,
  type RoundInput,
  type RoundPhase,
  type RoundResult,
  type RoundView,
  type TopCutStage,
  type TournamentView,
  isEmptyGame,
  latestOpponentTeam,
  losesOpponentTeam,
  opponentTeamOf,
} from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'
import { TEAM_FILE_TYPES } from '@/composables/useTeamReader'
import { formatDates } from '@/lib/format'
import type { OpponentChoice } from './OpponentPicker.vue'
import {
  type OpponentBuildDraft,
  newOpponentBuild,
  readToOpponentTeam,
  toOpponentBuildDraft,
  toOpponentTeamInput,
} from '@/lib/opponent-team'

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

// The Opponent's Team (ADR 22), shared by every Round against them in this Tournament. Each
// Opponent chosen has their own draft of it and of their side of the Games, loaded from what is
// saved and kept while the User picks someone else, so picking them again brings it back.
const opponentId = computed(() =>
  opponent.value?.kind === 'existing' ? opponent.value.id : undefined,
)
const savedTeamOf = (id: string | undefined) =>
  opponentTeamOf(props.tournament.opponentTeams, id)?.pokemon.map(toOpponentBuildDraft) ?? []
const opponentTeam = ref<OpponentBuildDraft[]>(savedTeamOf(opponentId.value))
const opponentSpecies = computed(() => opponentTeam.value.map((p) => p.species))
const opponentTeamOpen = ref(opponentTeam.value.length > 0)

type OpponentSide = Pick<Game, 'opponentBrought' | 'opponentLeads'>
interface OpponentDraft {
  team: OpponentBuildDraft[]
  sides: Map<Game['number'], OpponentSide>
}
const opponentSideOf = (game: Game): OpponentSide => ({
  opponentBrought: [...game.opponentBrought],
  opponentLeads: [...game.opponentLeads],
})
const drafts = new Map<string, OpponentDraft>()
const NO_OPPONENT = 'none'
const draftKey = (choice: OpponentChoice | null) =>
  choice?.kind === 'existing' ? choice.id : (choice?.kind ?? NO_OPPONENT)
watch(
  () => draftKey(opponent.value),
  (key, before) => {
    if (key === before) return
    // With no Opponent chosen yet, what was picked for their side is about whoever is chosen.
    const carried = before === NO_OPPONENT
    if (!carried)
      drafts.set(before, {
        team: opponentTeam.value,
        sides: new Map(games.value.map((g) => [g.number, opponentSideOf(g)])),
      })
    const back = drafts.get(key)
    const saved = savedTeamOf(opponentId.value)
    const picked = carried
      ? opponentTeam.value.filter((p) => !saved.some((s) => s.species === p.species))
      : []
    opponentTeam.value = back?.team ?? [...saved, ...picked].slice(0, MAX_TEAM_SIZE)
    if (carried && !back) return
    for (const game of games.value)
      Object.assign(
        game,
        back?.sides.get(game.number) ?? { opponentBrought: [], opponentLeads: [] },
      )
  },
)
// A species picked for their side of a Game joins their Team, up to six (ADR 22).
function addToOpponentTeam(species: string) {
  if (opponentTeam.value.length >= MAX_TEAM_SIZE || opponentSpecies.value.includes(species)) return
  opponentTeam.value.push(newOpponentBuild(species))
}

const otherRoundsAgainst = (id: string | undefined) =>
  id ? logged.value.filter((r) => r.opponent?.id === id) : []
// Read from the cached Tournaments list, so the offer works with no signal. It is only made while
// the Opponent has no Team saved here.
const tournaments = useQuery({
  queryKey: ['tournaments'],
  queryFn: () => $fetch<TournamentView[]>('/api/tournaments'),
})
const copyable = computed(() => {
  const id = opponentId.value
  if (!id || savedTeamOf(id).length || opponentTeam.value.length) return undefined
  return latestOpponentTeam(tournaments.data.value ?? [], {
    opponentId: id,
    regulation: props.tournament.regulation,
    tournamentId: props.tournament.id,
  })
})
function copyOpponentTeam() {
  if (!copyable.value) return
  opponentTeam.value = copyable.value.pokemon.map(toOpponentBuildDraft)
  opponentTeamOpen.value = true
}

// Reading their open teamsheet (ADR 24) fills in their Team for the User to check before saving.
// What it read replaces what was there, though species picked for their side of a Game stay
// while there's room. A read that finishes after the User picked another Opponent is dropped.
const names = useChampionsNames()
const leftOutOfRead = ref<string[]>([])
let readingFor: string | undefined
const reader = useTeamReader((read) => {
  if (readingFor !== draftKey(opponent.value)) return
  const { pokemon, leftOut } = readToOpponentTeam(read)
  opponentTeam.value = pokemon
  const picked = new Set(games.value.flatMap((g) => [...g.opponentBrought, ...g.opponentLeads]))
  for (const species of picked) {
    addToOpponentTeam(species)
    if (!opponentSpecies.value.includes(species))
      leftOut.push(
        `${names.data.value?.species[species] ?? species}, picked for a Game, wasn't added: their Team already has ${MAX_TEAM_SIZE} Pokémon.`,
      )
  }
  leftOutOfRead.value = leftOut
  opponentTeamOpen.value = true
})
const readFileInput = reader.fileInput
function chooseTeamsheet(event: Event) {
  readingFor = draftKey(opponent.value)
  reader.choose(event)
}
const readFlagged = computed(() => opponentTeam.value.some((build) => build.readFlags.length))
watch(
  () => draftKey(opponent.value),
  () => {
    leftOutOfRead.value = []
    reader.read.reset()
  },
)

const opponentName = computed(() => opponent.value?.displayName ?? 'them')
// What saving this Round with another Opponent loses: the old Opponent's Team, if no other
// Round here is against them.
const losesTeamOf = computed(() => {
  const before = r?.opponent
  if (!before || before.id === opponentId.value) return undefined
  return losesOpponentTeam(props.tournament, r?.id, before.id) ? before.displayName : undefined
})
const opponentTeamErrors = computed(() => {
  const errors: Record<string, string> = {}
  for (const [field, message] of Object.entries(props.fieldErrors ?? {}))
    if (field.startsWith('opponentTeam.')) errors[field.slice('opponentTeam.'.length)] = message
  return errors
})
watch(
  () =>
    Object.keys(opponentTeamErrors.value).length > 0 || Boolean(props.fieldErrors?.opponentTeam),
  (problem) => {
    if (problem) opponentTeamOpen.value = true
  },
)
/**
 * Their Team as the API takes it, only when it differs from what is saved: a save without it
 * leaves the saved Team as it is, so an untouched form never overwrites one saved meanwhile.
 */
function changedOpponentTeam(): OpponentTeamInput | undefined {
  const team = toOpponentTeamInput(opponentTeam.value)
  const saved = toOpponentTeamInput(savedTeamOf(opponentId.value))
  return JSON.stringify(team) === JSON.stringify(saved) ? undefined : team
}
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
    // A list replaces their Team, and an empty one deletes it. Left out on a Bye.
    ...(!bye.value && opponent.value ? { opponentTeam: changedOpponentTeam() } : {}),
  })
}

// Leaving with unsaved edits asks first, except while saving, when the page moves on by itself.
const draft = () =>
  JSON.stringify([
    phase.value,
    roundNumber.value,
    stage.value,
    bestOf.value,
    bye.value,
    result.value,
    score.value,
    opponent.value,
    notes.value,
    games.value,
    opponentTeam.value,
  ])
const startedWith = draft()
const dirty = computed(() => !props.pending && draft() !== startedWith)
const { DiscardDialog } = useDiscardGuard(dirty, 'this Round')
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
      <p v-if="losesTeamOf" class="text-destructive text-sm" data-testid="loses-team">
        Saving deletes {{ losesTeamOf }}’s Team in this Tournament, as no other Round here is
        against them.
      </p>

      <details
        v-if="opponent"
        class="flex flex-col gap-3"
        :open="opponentTeamOpen"
        data-testid="their-team-section"
        @toggle="opponentTeamOpen = ($event.target as HTMLDetailsElement).open"
      >
        <summary class="flex min-h-11 cursor-pointer items-center text-sm font-medium">
          Their Team
          <span class="text-muted-foreground ml-1 font-normal"
            >({{
              opponentTeam.length ? `${opponentTeam.length} of ${MAX_TEAM_SIZE}` : 'optional'
            }})</span
          >
        </summary>
        <p v-if="otherRoundsAgainst(opponentId).length" class="text-muted-foreground mb-3 text-sm">
          Shared by every Round against {{ opponentName }} in this Tournament.
        </p>
        <div v-if="copyable" class="mb-3 flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            class="self-start"
            data-testid="copy-their-team"
            @click="copyOpponentTeam"
            >Copy their Team from {{ copyable.tournament.name }},
            {{ formatDates(copyable.tournament.startDate) }}</Button
          >
        </div>
        <div class="mb-3 flex flex-col gap-2" data-testid="read-their-teamsheet">
          <input
            ref="readFileInput"
            type="file"
            :accept="TEAM_FILE_TYPES"
            class="sr-only"
            data-testid="their-teamsheet-file"
            @change="chooseTeamsheet"
          />
          <Button
            type="button"
            variant="outline"
            class="self-start"
            :disabled="!reader.online.value || reader.read.isPending.value"
            @click="readFileInput?.click()"
            >{{ reader.read.isPending.value ? 'Reading…' : 'Read their Teamsheet' }}</Button
          >
          <p class="text-muted-foreground text-sm">
            <template v-if="!reader.online.value">Reading a Teamsheet needs a connection.</template>
            <template v-else
              >A Teamsheet PDF filled in on teamsheet.gg. Only species, abilities, held items and
              moves are kept<template v-if="opponentTeam.length"
                >, and they replace the Pokémon below</template
              >. The file isn't kept.</template
            >
          </p>
          <Alert v-if="reader.failure.value" variant="destructive" role="alert">
            <AlertDescription>{{ reader.failure.value }}</AlertDescription>
          </Alert>
          <Alert v-if="readFlagged || leftOutOfRead.length" data-testid="read-flags-note">
            <AlertDescription>
              <p v-if="readFlagged">
                MyVGC wasn't sure of everything on the file. Check the Pokémon marked below before
                saving.
              </p>
              <template v-if="leftOutOfRead.length">
                <p>Some Pokémon were left out:</p>
                <ul class="list-disc pl-5">
                  <li v-for="(reason, index) in leftOutOfRead" :key="index">{{ reason }}</li>
                </ul>
              </template>
            </AlertDescription>
          </Alert>
        </div>
        <p v-if="error('opponentTeam')" class="text-destructive mb-3 text-sm">
          {{ error('opponentTeam') }}
        </p>
        <OpponentTeamEditor
          v-if="opponentTeamOpen"
          v-model="opponentTeam"
          :errors="opponentTeamErrors"
        />
      </details>

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
        <GamesEditor
          v-if="gamesOpen"
          :games="shownGames"
          :yours="yours"
          :opponent-team="opponentSpecies"
          :errors="gameErrors"
          @pick-opponent="addToOpponentTeam"
        />
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

    <DiscardDialog />
  </form>
</template>

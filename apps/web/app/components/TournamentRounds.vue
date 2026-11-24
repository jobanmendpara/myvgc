<script setup lang="ts">
import {
  type Game,
  ROUND_RESULT_LABELS,
  type RoundView,
  type TournamentView,
  formatRecord,
  opponentAgeDivisionOf,
  opponentTeamOf,
} from '@myvgc/core/schema'
import { roundLabel } from '@/lib/format'
import { roundRows, syncEdge } from '@/lib/outbox-view'
import { newRoundPath, roundPath } from '@/lib/paths'

const props = defineProps<{ tournament: TournamentView }>()

const resultClass: Record<RoundView['result'], string> = {
  win: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  loss: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  tie: 'bg-muted text-foreground',
}
const names = useChampionsNames()
const nameOf = (species: string) => names.data.value?.species[species] ?? species
// One line per Game, such as "Game 1 · Win · Incineroar + Rillaboom vs Kingambit + Sneasler".
// It shows Leads, or the Brought Pokémon when no Leads were recorded.
const sideText = (leads: string[], brought: string[]) =>
  (leads.length ? leads : brought).map(nameOf).join(' + ')
function gameLine(game: Game) {
  const yours = sideText(game.leads, game.brought)
  const theirs = sideText(game.opponentLeads, game.opponentBrought)
  return [
    `Game ${game.number}`,
    game.result && ROUND_RESULT_LABELS[game.result],
    (yours || theirs) && `${yours || '?'} vs ${theirs || '?'}`,
  ]
    .filter(Boolean)
    .join(' · ')
}
// The Opponent's Team (ADR 22) as one line of species, such as "Incineroar, Rillaboom".
const teamLine = (opponentId: string | undefined) =>
  opponentTeamOf(props.tournament.opponentTeams, opponentId)
    ?.pokemon.map((build) => nameOf(build.species))
    .join(', ')
const ageDivisionOf = (opponentId: string | undefined) =>
  opponentAgeDivisionOf(props.tournament.opponentAgeDivisions, opponentId)
const hasTopCut = computed(() => props.tournament.rounds.some((r) => r.phase === 'top-cut'))

// Each Round not yet synced is marked (DEV-167). A Round deleted on this phone stays, struck
// through, and a new Round the server refused stays too, until the server has them; neither
// counts in the Record.
const { state } = useOutbox()
const rows = computed(() => roundRows(props.tournament, state.value))
const NuxtLink = resolveComponent('NuxtLink')
</script>

<template>
  <section aria-labelledby="rounds-title" class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="rounds-title" class="font-semibold">Rounds</h2>
        <p class="text-muted-foreground text-sm" data-testid="record">
          Swiss {{ formatRecord(tournament.record.swiss) }}
          <template v-if="hasTopCut">
            · Top cut {{ formatRecord(tournament.record.topCut) }}</template
          >
        </p>
      </div>
      <Button as-child size="lg">
        <NuxtLink :to="newRoundPath(tournament.id)">Log Round</NuxtLink>
      </Button>
    </div>

    <p v-if="rows.length === 0" class="text-muted-foreground text-sm">No Rounds logged yet.</p>
    <ol
      v-else
      class="flex flex-col divide-y overflow-hidden rounded-lg border"
      data-testid="rounds"
    >
      <li v-for="{ round: r, mark } in rows" :key="r.id" :class="syncEdge(mark)">
        <component
          :is="mark?.status === 'deleting' ? 'div' : NuxtLink"
          :to="mark?.status === 'deleting' ? undefined : roundPath(tournament.id, r.id)"
          class="focus-visible:ring-ring/50 flex items-start gap-3 p-3 outline-none focus-visible:ring-3"
          :class="{ 'hover:bg-muted/50': mark?.status !== 'deleting' }"
          data-testid="round"
        >
          <span
            class="text-muted-foreground w-16 shrink-0 text-sm"
            :class="{ 'line-through': mark?.status === 'deleting' }"
            >{{ roundLabel(r) }}</span
          >
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="flex flex-wrap items-center gap-1.5">
              <span
                class="font-medium break-words"
                :class="{ 'line-through opacity-70': mark?.status === 'deleting' }"
                >{{ r.bye ? 'Bye' : (r.opponent?.displayName ?? 'Unknown') }}</span
              >
              <AgeDivisionBadge
                v-if="ageDivisionOf(r.opponent?.id)"
                :age-division="ageDivisionOf(r.opponent?.id)!"
              />
            </span>
            <span
              v-if="teamLine(r.opponent?.id)"
              class="text-muted-foreground text-xs break-words"
              data-testid="their-team-line"
              >Team: {{ teamLine(r.opponent?.id) }}</span
            >
            <span v-if="r.notes" class="text-muted-foreground line-clamp-2 text-xs">{{
              r.notes
            }}</span>
            <span
              v-for="game in r.games"
              :key="game.number"
              class="text-muted-foreground text-xs break-words"
              data-testid="game-line"
              >{{ gameLine(game) }}</span
            >
            <SyncMark v-if="mark" :mark="mark" class="mt-1" />
          </span>
          <span class="flex shrink-0 flex-col items-end gap-1">
            <span
              class="rounded px-2 py-0.5 text-xs font-semibold"
              :class="resultClass[r.result]"
              >{{ ROUND_RESULT_LABELS[r.result] }}</span
            >
            <span v-if="r.gameScore" class="text-muted-foreground text-xs"
              >{{ r.gameScore.won }}-{{ r.gameScore.lost }}</span
            >
          </span>
        </component>
      </li>
    </ol>
  </section>
</template>

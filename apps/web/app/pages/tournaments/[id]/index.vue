<script setup lang="ts">
import { EVENT_TIER_LABELS, canRefreshSnapshot, formatMoney, today } from '@myvgc/core/schema'
import { useMutation } from '@tanstack/vue-query'
import { saveFailureMessage } from '@/lib/api'
import { formatDates, ordinal } from '@/lib/format'
import { notYetCreated, tournamentMarks } from '@/lib/outbox-view'
import { deleteTournament, editTournament } from '@/lib/outbox-writes'
import { editTournamentPath } from '@/lib/paths'

const route = useRoute()
const id = computed(() => String(route.params.id))

const { query, tournament, notFound } = useTournament(id)

const calendar = useCalendar()
// The server has the final say; this only decides which buttons to show.
const canRefresh = computed(() =>
  tournament.value
    ? canRefreshSnapshot(tournament.value, calendar.data.value?.today ?? today())
    : false,
)

// Changes are kept on the phone first, so they work with no signal too, and sent when they can be
// (ADR 17). The Tournament is marked until the server has them (DEV-204).
const outbox = useOutbox()
const mark = computed(() => tournamentMarks(outbox.state.value).get(id.value))
// The Teamsheet PDF needs the Tournament on the server first (ADR 27).
const unsynced = computed(() => notYetCreated(outbox.state.value, id.value))

const confirmingDelete = ref(false)
const remove = useMutation({
  // Runs with no signal too, as the outbox keeps the change (ADR 17).
  networkMode: 'always',
  mutationFn: () => outbox.save(deleteTournament(tournament.value!)),
  onSuccess: async () => {
    confirmingDelete.value = false
    await navigateTo('/tournaments')
  },
})

// After a Top cut Round, the Round form passes on the Placement it implies.
const suggested = computed(() => {
  const n = Number(route.query.placement)
  return Number.isInteger(n) && n >= 1 && tournament.value && !tournament.value.placement
    ? n
    : undefined
})
const applyPlacement = useMutation({
  networkMode: 'always',
  mutationFn: (placement: number) => outbox.save(editTournament(tournament.value!, { placement })),
  onSuccess: () => navigateTo({ path: route.path, query: {} }, { replace: true }),
})

/** "9th of 128", "9th", or nothing. */
const placement = computed(() => {
  const t = tournament.value
  if (!t?.placement) return ''
  return t.playerCount ? `${ordinal(t.placement)} of ${t.playerCount}` : ordinal(t.placement)
})

useHead({
  title: computed(() =>
    tournament.value ? `${tournament.value.name} · MyVGC` : 'Tournament · MyVGC',
  ),
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <ListBackLink to="/tournaments">Your Tournaments</ListBackLink>

    <p v-if="query.isPending.value" class="text-muted-foreground">Loading…</p>

    <Card v-else-if="notFound">
      <CardHeader>
        <CardTitle>Tournament not found</CardTitle>
        <CardDescription>It may have been deleted.</CardDescription>
      </CardHeader>
    </Card>

    <template v-else-if="tournament">
      <header class="flex flex-col gap-2">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <h1 class="min-w-0 text-2xl font-semibold break-words" data-testid="tournament-name">
            {{ tournament.name }}
          </h1>
          <Badge v-if="tournament.upcoming">Upcoming</Badge>
        </div>
        <SyncMark v-if="mark" :mark="mark" />
        <dl class="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <div>
            <dt class="sr-only">Dates</dt>
            <dd>{{ formatDates(tournament.startDate, tournament.endDate) }}</dd>
          </div>
          <div>
            <dt class="sr-only">Event tier</dt>
            <dd>{{ EVENT_TIER_LABELS[tournament.eventTier] }}</dd>
          </div>
          <div>
            <dt class="sr-only">Regulation</dt>
            <dd>Reg {{ tournament.regulation }}</dd>
          </div>
          <div>
            <dt class="sr-only">Where</dt>
            <dd>
              {{ tournament.online ? 'Online' : 'In person'
              }}<template v-if="tournament.location"> · {{ tournament.location }}</template>
            </dd>
          </div>
          <div>
            <dt class="sr-only">Best of</dt>
            <dd>Best of {{ tournament.defaultBestOf }}</dd>
          </div>
        </dl>
      </header>

      <Alert v-if="suggested" data-testid="placement-suggestion">
        <AlertDescription class="flex flex-wrap items-center justify-between gap-3">
          <span>That puts you at {{ ordinal(suggested) }}. Set it as your Placement?</span>
          <span class="flex gap-2">
            <Button
              size="sm"
              :disabled="applyPlacement.isPending.value"
              @click="applyPlacement.mutate(suggested)"
              >Set {{ ordinal(suggested) }}</Button
            >
            <Button
              size="sm"
              variant="ghost"
              @click="navigateTo({ path: route.path, query: {} }, { replace: true })"
              >Not now</Button
            >
          </span>
        </AlertDescription>
      </Alert>

      <TournamentRounds :tournament="tournament" />

      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="tournament-results">
        <div class="rounded-lg border p-3">
          <dt class="text-muted-foreground text-xs">Placement</dt>
          <dd class="font-semibold" data-testid="placement">
            {{ placement || (tournament.dropped ? 'Dropped' : '—') }}
          </dd>
          <dd v-if="placement && tournament.dropped" class="text-muted-foreground text-xs">
            Dropped
          </dd>
        </div>
        <div class="rounded-lg border p-3">
          <dt class="text-muted-foreground text-xs">Championship Points</dt>
          <dd class="font-semibold">{{ tournament.championshipPoints ?? '—' }}</dd>
        </div>
        <div class="rounded-lg border p-3">
          <dt class="text-muted-foreground text-xs">Entry fee</dt>
          <dd class="font-semibold">
            {{ tournament.entryFee ? formatMoney(tournament.entryFee) : '—' }}
          </dd>
        </div>
        <div class="rounded-lg border p-3">
          <dt class="text-muted-foreground text-xs">Organizer</dt>
          <dd class="font-semibold break-words">{{ tournament.organizer ?? '—' }}</dd>
        </div>
      </dl>

      <TournamentTeam :tournament="tournament" :can-refresh="canRefresh" />

      <TournamentTeamsheet :tournament="tournament" :unsynced="unsynced" />

      <p v-if="tournament.link" class="text-sm">
        <a
          :href="tournament.link"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary break-all underline"
          >Standings and pairings ↗</a
        >
      </p>

      <section v-if="tournament.notes" aria-labelledby="notes-title" class="flex flex-col gap-2">
        <h2 id="notes-title" class="font-semibold">Notes</h2>
        <p class="max-w-prose text-sm whitespace-pre-wrap">{{ tournament.notes }}</p>
      </section>

      <div class="flex flex-col gap-3 border-t pt-6 sm:flex-row">
        <Button as-child variant="outline"
          ><NuxtLink :to="editTournamentPath(tournament.id)">Edit details</NuxtLink></Button
        >
        <Button
          v-if="mark?.status !== 'deleting'"
          variant="ghost"
          class="text-destructive"
          @click="confirmingDelete = true"
        >
          Delete Tournament
        </Button>
      </div>

      <AlertDialog v-model:open="confirmingDelete">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {{ tournament.name }}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the Tournament, its notes and
              {{
                tournament.rounds.length === 1 ? '1 Round' : `${tournament.rounds.length} Rounds`
              }}. Your Opponents stay. It can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Alert v-if="remove.isError.value" variant="destructive" role="alert">
            <AlertDescription>{{
              saveFailureMessage(remove.error.value, 'Tournament')
            }}</AlertDescription>
          </Alert>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="remove.isPending.value">Keep it</AlertDialogCancel>
            <Button
              variant="destructive"
              :disabled="remove.isPending.value"
              @click="remove.mutate()"
            >
              {{ remove.isPending.value ? 'Deleting…' : 'Delete Tournament' }}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </template>

    <Alert v-else-if="query.isError.value && !tournament" variant="destructive" role="alert">
      <AlertDescription
        >Couldn't load this Tournament. Check your connection and try again.</AlertDescription
      >
    </Alert>
  </div>
</template>

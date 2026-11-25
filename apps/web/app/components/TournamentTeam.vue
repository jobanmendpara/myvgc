<script setup lang="ts">
import type { TeamView, TournamentView } from '@myvgc/core/schema'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { saveFailureMessage } from '@/lib/api'
import { RejectedChange } from '@/lib/outbox'
import { linkTournamentTeam, unlinkTournamentTeam } from '@/lib/outbox-writes'
import { teamPath } from '@/lib/paths'

// The Team snapshot on a Tournament (ADR 9): link one of the User's Teams, replace or refresh
// it, or unlink it. Refreshing it from the same Team only works until the Tournament is over.
// Each change is kept on the phone first, so it works with no signal too (ADR 17, DEV-204); the
// snapshot shows the Team as this phone has it until the server makes its own.
const props = defineProps<{ tournament: TournamentView; canRefresh: boolean }>()

const teams = useQuery({ queryKey: ['teams'], queryFn: () => $fetch<TeamView[]>('/api/teams') })
const { style: spriteStyle } = useSpriteStyle()

const choosing = ref(false)
const chosenTeamId = ref('')
const showBuilds = ref(false)

const outbox = useOutbox()
const link = useMutation({
  // Runs with no signal too, as the outbox keeps the change (ADR 17).
  networkMode: 'always',
  mutationFn: (teamId: string) => {
    const team = teams.data.value?.find((t) => t.id === teamId)
    if (!team)
      throw new RejectedChange(404, "Your Teams aren't on this phone yet. Try again with a signal.")
    return outbox.save(linkTournamentTeam(props.tournament, team))
  },
  onSuccess: () => (choosing.value = false),
})
const unlink = useMutation({
  networkMode: 'always',
  mutationFn: () => outbox.save(unlinkTournamentTeam(props.tournament)),
})

function startChoosing() {
  chosenTeamId.value = props.tournament.team?.teamId ?? teams.data.value?.[0]?.id ?? ''
  choosing.value = true
}

const snapshotDate = computed(() =>
  props.tournament.team
    ? new Date(props.tournament.team.snapshotAt).toLocaleDateString(undefined, {
        dateStyle: 'medium',
      })
    : '',
)
</script>

<template>
  <section aria-labelledby="team-title" class="flex flex-col gap-3" data-testid="tournament-team">
    <h2 id="team-title" class="font-semibold">Team</h2>

    <Alert v-for="warning in tournament.warnings" :key="warning">
      <AlertDescription>{{ warning }}</AlertDescription>
    </Alert>

    <div v-if="tournament.team && !choosing" class="flex flex-col gap-3 rounded-lg border p-4">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <NuxtLink
            v-if="tournament.team.teamId"
            :to="teamPath(tournament.team.teamId)"
            class="font-semibold break-words hover:underline"
            data-testid="team-snapshot-name"
            >{{ tournament.team.name }}</NuxtLink
          >
          <span v-else class="font-semibold break-words" data-testid="team-snapshot-name">{{
            tournament.team.name
          }}</span>
          <p class="text-muted-foreground text-xs">
            Snapshot from {{ snapshotDate
            }}<template v-if="!tournament.team.teamId"> · original Team deleted</template>
          </p>
        </div>
        <div class="flex flex-wrap justify-end gap-1.5">
          <LegalityBadge :legality="tournament.team.legality" />
          <Badge variant="secondary">Reg {{ tournament.team.regulation }}</Badge>
        </div>
      </div>
      <LegalityWarnings
        v-if="tournament.team.legality.problems.length"
        :problems="tournament.team.legality.problems"
      />
      <!-- As a Detailed Team row: Inline and Leading slot put the Sprite inside each chip; Stacked
           tiles put it over each name, 3 a row on a phone and 6 on a wide screen. -->
      <ul
        v-if="spriteStyle !== 'stacked-tiles'"
        class="flex flex-wrap gap-1.5"
        :aria-label="`Pokémon in ${tournament.team.name}`"
      >
        <li
          v-for="(build, index) in tournament.team.pokemon"
          :key="index"
          class="bg-muted text-muted-foreground flex items-center gap-1 rounded px-2 py-0.5 text-sm"
        >
          <Sprite :species="build.species" surface="tournament-team" />
          {{ build.names.species }}
        </li>
      </ul>
      <ul
        v-else
        class="grid grid-cols-3 gap-1.5 sm:grid-cols-6"
        :aria-label="`Pokémon in ${tournament.team.name}`"
      >
        <li
          v-for="(build, index) in tournament.team.pokemon"
          :key="index"
          class="bg-muted text-muted-foreground flex min-w-0 flex-col items-center rounded p-1 text-center text-xs"
        >
          <Sprite :species="build.species" surface="tournament-team" />
          <span class="w-full break-words">{{ build.names.species }}</span>
        </li>
      </ul>
      <Button variant="ghost" size="sm" class="self-start" @click="showBuilds = !showBuilds">
        {{ showBuilds ? 'Hide builds' : 'Show builds' }}
      </Button>
      <div v-if="showBuilds" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <PokemonBuildCard
          v-for="(build, index) in tournament.team.pokemon"
          :key="index"
          :build="build"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          v-if="tournament.team.teamId && canRefresh"
          variant="outline"
          size="sm"
          :disabled="link.isPending.value"
          @click="link.mutate(tournament.team.teamId)"
        >
          {{ link.isPending.value ? 'Updating…' : 'Update snapshot' }}
        </Button>
        <TeamsheetExport
          :url="`/api/tournaments/${tournament.id}/team/teamsheet`"
          :team-name="tournament.team.name"
          :legality="tournament.team.legality"
          :season-date="tournament.startDate"
        />
        <Button variant="outline" size="sm" @click="startChoosing">Change Team</Button>
        <Button
          variant="ghost"
          size="sm"
          :disabled="unlink.isPending.value"
          @click="unlink.mutate()"
        >
          Unlink
        </Button>
      </div>
    </div>

    <div v-else-if="choosing" class="flex flex-col gap-3 rounded-lg border p-4">
      <p
        v-if="teams.isPending.value && teams.fetchStatus.value === 'paused'"
        class="text-muted-foreground text-sm"
      >
        Your Teams aren't on this phone yet. Open them once with a signal.
      </p>
      <p v-else-if="teams.isPending.value" class="text-muted-foreground text-sm">
        Loading your Teams…
      </p>
      <p v-else-if="!teams.data.value?.length" class="text-sm">
        You have no Teams yet.
        <NuxtLink to="/teams/new" class="text-primary underline">Add one</NuxtLink> first.
      </p>
      <template v-else>
        <Label for="team-choice">Which Team did you bring?</Label>
        <NativeSelect id="team-choice" v-model="chosenTeamId" class="w-full">
          <NativeSelectOption v-for="team in teams.data.value" :key="team.id" :value="team.id">
            {{ team.name }} (Reg {{ team.regulation }})
          </NativeSelectOption>
        </NativeSelect>
        <p class="text-muted-foreground text-xs">
          MyVGC keeps a copy of its Pokémon, so later changes to them don't change this Tournament.
          Renaming the Team renames it here too.
        </p>
      </template>
      <Alert v-if="link.isError.value" variant="destructive" role="alert">
        <AlertDescription>{{
          saveFailureMessage(link.error.value, 'Team snapshot')
        }}</AlertDescription>
      </Alert>
      <div class="flex gap-2">
        <Button
          :disabled="!chosenTeamId || link.isPending.value"
          @click="link.mutate(chosenTeamId)"
          >{{ link.isPending.value ? 'Linking…' : 'Link Team' }}</Button
        >
        <Button variant="ghost" @click="choosing = false">Cancel</Button>
      </div>
    </div>

    <div v-else class="flex flex-col items-start gap-2 rounded-lg border border-dashed p-4">
      <p class="text-muted-foreground text-sm">No Team linked.</p>
      <Button variant="outline" size="sm" @click="startChoosing">Link a Team</Button>
    </div>
  </section>
</template>

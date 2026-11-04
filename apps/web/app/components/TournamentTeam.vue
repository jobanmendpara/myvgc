<script setup lang="ts">
import type { TeamView, TournamentView } from '@myvgc/core/schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { saveFailureMessage } from '@/lib/api'

// The Team snapshot on a Tournament (ADR 9): link one of the User's Teams, replace or refresh
// it while the Tournament is on, or unlink it.
const props = defineProps<{ tournament: TournamentView; canSnapshot: boolean }>()

const queryClient = useQueryClient()
const teams = useQuery({ queryKey: ['teams'], queryFn: () => $fetch<TeamView[]>('/api/teams') })

const choosing = ref(false)
const chosenTeamId = ref('')
const showBuilds = ref(false)

const url = computed(() => `/api/tournaments/${props.tournament.id}/team`)
const onSaved = (saved: TournamentView) => {
  queryClient.setQueryData(['tournament', saved.id], (old: TournamentView | undefined) =>
    old ? { ...old, ...saved } : saved,
  )
  choosing.value = false
}
const link = useMutation({
  mutationFn: (teamId: string) => {
    const target: string = url.value
    return $fetch<TournamentView>(target, { method: 'PUT', body: { teamId } })
  },
  onSuccess: onSaved,
})
const unlink = useMutation({
  mutationFn: () => {
    const target: string = url.value
    return $fetch<TournamentView>(target, { method: 'DELETE' })
  },
  onSuccess: onSaved,
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
            :to="`/teams/${tournament.team.teamId}`"
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
        <Badge variant="secondary">Reg {{ tournament.team.regulation }}</Badge>
      </div>
      <ul class="flex flex-wrap gap-1.5" :aria-label="`Pokémon in ${tournament.team.name}`">
        <li
          v-for="(build, index) in tournament.team.pokemon"
          :key="index"
          class="bg-muted text-muted-foreground rounded px-2 py-0.5 text-sm"
        >
          {{ build.names.species }}
        </li>
      </ul>
      <Button variant="ghost" size="sm" class="self-start" @click="showBuilds = !showBuilds">
        {{ showBuilds ? 'Hide builds' : 'Show builds' }}
      </Button>
      <div v-if="showBuilds" class="grid gap-3 sm:grid-cols-2">
        <PokemonBuildCard
          v-for="(build, index) in tournament.team.pokemon"
          :key="index"
          :build="build"
        />
      </div>
      <div v-if="canSnapshot" class="flex flex-wrap gap-2">
        <Button
          v-if="tournament.team.teamId"
          variant="outline"
          size="sm"
          :disabled="link.isPending.value"
          @click="link.mutate(tournament.team.teamId)"
        >
          {{ link.isPending.value ? 'Updating…' : 'Update snapshot' }}
        </Button>
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
      <p v-if="teams.isPending.value" class="text-muted-foreground text-sm">Loading your Teams…</p>
      <p v-else-if="!teams.data.value?.length" class="text-sm">
        You have no Teams yet.
        <NuxtLink to="/teams/new" class="text-primary underline">Import one</NuxtLink> first.
      </p>
      <template v-else>
        <Label for="team-choice">Which Team did you bring?</Label>
        <NativeSelect id="team-choice" v-model="chosenTeamId" class="w-full">
          <NativeSelectOption v-for="team in teams.data.value" :key="team.id" :value="team.id">
            {{ team.name }} (Reg {{ team.regulation }})
          </NativeSelectOption>
        </NativeSelect>
        <p class="text-muted-foreground text-xs">
          MyVGC keeps a copy, so later changes to the Team don't change this Tournament.
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
      <Button v-if="canSnapshot" variant="outline" size="sm" @click="startChoosing"
        >Link a Team</Button
      >
    </div>
  </section>
</template>

<script setup lang="ts">
import { type DashboardView, formatMoney, formatRecord } from '@myvgc/core/schema'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { formatDates, ordinal, percent } from '@/lib/format'

useHead({ title: 'Dashboard · MyVGC' })

const { query, setFilters } = useFilterQuery()
const dashboard = useQuery({
  queryKey: computed(() => ['dashboard', query.value]),
  queryFn: () => $fetch<DashboardView>('/api/dashboard', { query: query.value }),
  placeholderData: keepPreviousData,
})
const filters = computed(() => dashboard.data.value?.filters)
const s = computed(() => dashboard.data.value?.summary)

const playedNothing = computed(
  () => s.value && s.value.tournamentsPlayed === 0 && s.value.entryFees.length === 0,
)
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-2xl font-semibold">Dashboard</h1>

    <DashboardFilters :query="query" :applied="filters" @change="setFilters" />

    <p v-if="dashboard.isPending.value" class="text-muted-foreground">Loading…</p>
    <Alert v-else-if="dashboard.isError.value" variant="destructive" role="alert">
      <AlertDescription
        >Couldn't load the dashboard. Check your connection and try again.</AlertDescription
      >
    </Alert>

    <Card v-else-if="playedNothing" data-testid="dashboard-empty">
      <CardHeader>
        <CardTitle>Nothing to show yet</CardTitle>
        <CardDescription>
          No Tournaments match these filters. Try another Regulation or Season, or
          <NuxtLink to="/tournaments/new" class="text-primary underline">log a Tournament</NuxtLink
          >.
        </CardDescription>
      </CardHeader>
    </Card>

    <template v-else-if="s">
      <Alert v-if="s.includesPartialSeason">
        <AlertDescription
          >The 2026 Season only counts from Pokémon Champions' release on 8 April 2026, so its
          totals are partial.</AlertDescription
        >
      </Alert>

      <dl
        class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        data-testid="dashboard-tiles"
      >
        <div class="rounded-lg border p-3">
          <dt class="text-muted-foreground text-xs">Tournaments</dt>
          <dd class="text-2xl font-semibold tabular-nums">{{ s.tournamentsPlayed }}</dd>
        </div>
        <div class="rounded-lg border p-3">
          <dt class="text-muted-foreground text-xs">Round win rate</dt>
          <dd class="text-2xl font-semibold tabular-nums" data-testid="round-win-rate">
            {{ percent(s.rounds.winRate) }}
          </dd>
          <dd class="text-muted-foreground text-xs tabular-nums">{{ formatRecord(s.rounds) }}</dd>
        </div>
        <div class="rounded-lg border p-3">
          <dt class="text-muted-foreground text-xs">Game win rate</dt>
          <dd class="text-2xl font-semibold tabular-nums">
            {{ s.games ? percent(s.games.winRate) : '—' }}
          </dd>
          <dd class="text-muted-foreground text-xs tabular-nums">
            {{ s.games ? `${s.games.won}-${s.games.lost} in Games` : 'No Game scores' }}
          </dd>
        </div>
        <div class="rounded-lg border p-3">
          <dt class="text-muted-foreground text-xs">Top cut rate</dt>
          <dd class="text-2xl font-semibold tabular-nums">{{ percent(s.topCut.rate) }}</dd>
          <dd class="text-muted-foreground text-xs tabular-nums">
            {{ s.topCut.made }} of {{ s.topCut.of }} Tournaments
          </dd>
        </div>
        <div class="rounded-lg border p-3">
          <dt class="text-muted-foreground text-xs">Championship Points</dt>
          <template v-if="s.championshipPoints.length === 1">
            <dd class="text-2xl font-semibold tabular-nums">
              {{ s.championshipPoints[0]!.points }}
            </dd>
            <dd class="text-muted-foreground text-xs">
              {{ s.championshipPoints[0]!.season?.name ?? 'Before Champions' }}
            </dd>
          </template>
          <dd v-else-if="s.championshipPoints.length === 0" class="text-2xl font-semibold">—</dd>
          <template v-else>
            <dd
              v-for="row in s.championshipPoints"
              :key="row.season?.id ?? 'none'"
              class="flex justify-between gap-2 text-sm tabular-nums"
            >
              <span class="text-muted-foreground">{{
                row.season?.name ?? 'Before Champions'
              }}</span>
              <span class="font-semibold">{{ row.points }}</span>
            </dd>
          </template>
        </div>
        <div class="rounded-lg border p-3">
          <dt class="text-muted-foreground text-xs">Entry fees</dt>
          <dd v-if="s.entryFees.length === 0" class="text-2xl font-semibold">—</dd>
          <dd
            v-for="fee in s.entryFees"
            :key="fee.currency"
            :class="s.entryFees.length === 1 ? 'text-2xl font-semibold' : 'text-sm font-semibold'"
            class="tabular-nums"
          >
            {{ formatMoney(fee) }}
          </dd>
        </div>
      </dl>

      <div class="grid items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby="splits-title" class="flex flex-col gap-4 rounded-lg border p-4">
          <h2 id="splits-title" class="font-semibold">Win rate by Round</h2>
          <WinRateMeter label="Swiss" :rate="s.byPhase.swiss" />
          <WinRateMeter label="Top cut" :rate="s.byPhase.topCut" />
          <WinRateMeter label="Best of 1" :rate="s.byBestOf[1]" />
          <WinRateMeter label="Best of 3" :rate="s.byBestOf[3]" />
        </section>

        <section
          v-if="s.byTeam.length"
          aria-labelledby="teams-title"
          class="flex flex-col gap-4 rounded-lg border p-4"
        >
          <h2 id="teams-title" class="font-semibold">By Team</h2>
          <WinRateMeter
            v-for="team in s.byTeam"
            :key="team.teamId ?? team.name"
            :label="`${team.name} (${team.tournaments === 1 ? '1 Tournament' : `${team.tournaments} Tournaments`})`"
            :rate="team"
          />
        </section>
      </div>

      <div class="grid gap-6 sm:grid-cols-2">
        <section
          v-if="s.opponents.length"
          aria-labelledby="opponents-title"
          class="flex flex-col gap-2"
        >
          <h2 id="opponents-title" class="font-semibold">Most-played Opponents</h2>
          <table class="w-full text-sm">
            <thead class="text-muted-foreground text-xs">
              <tr>
                <th scope="col" class="py-1 text-left font-medium">Opponent</th>
                <th scope="col" class="py-1 text-right font-medium">Head-to-head</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="o in s.opponents" :key="o.id">
                <td class="py-2">
                  <NuxtLink :to="`/opponents/${o.id}`" class="hover:underline">{{
                    o.displayName
                  }}</NuxtLink>
                </td>
                <td class="py-2 text-right tabular-nums">{{ formatRecord(o) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section
          v-if="s.bestPlacements.length"
          aria-labelledby="placements-title"
          class="flex flex-col gap-2"
        >
          <h2 id="placements-title" class="font-semibold">Best Placements</h2>
          <ol class="divide-y text-sm">
            <li
              v-for="p in s.bestPlacements"
              :key="p.tournamentId"
              class="flex items-baseline justify-between gap-3 py-2"
            >
              <span class="min-w-0">
                <NuxtLink
                  :to="`/tournaments/${p.tournamentId}`"
                  class="break-words hover:underline"
                  >{{ p.name }}</NuxtLink
                >
                <span class="text-muted-foreground block text-xs">{{
                  formatDates(p.startDate)
                }}</span>
              </span>
              <span class="shrink-0 font-semibold tabular-nums"
                >{{ ordinal(p.placement)
                }}<span v-if="p.playerCount" class="text-muted-foreground font-normal">
                  of {{ p.playerCount }}</span
                ></span
              >
            </li>
          </ol>
        </section>
      </div>
    </template>
  </div>
</template>

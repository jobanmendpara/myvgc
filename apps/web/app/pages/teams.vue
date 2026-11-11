<script setup lang="ts">
import { type TeamView, groupTeams } from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'

definePageMeta({ listDetail: true })
useHead({ title: 'Your Teams · MyVGC' })

const teams = useQuery({ queryKey: ['teams'], queryFn: () => $fetch<TeamView[]>('/api/teams') })
const groupBy = (items: TeamView[]) => groupTeams(items)

// The Team open in the pane, also while editing it.
const route = useRoute()
const selectedId = computed(() => ('id' in route.params ? String(route.params.id) : ''))
</script>

<template>
  <ListDetail base="/teams" placeholder="Select a Team">
    <template #list="{ wide }">
      <ListColumn
        list="teams"
        title="Your Teams"
        :wide="wide"
        :pending="teams.isPending.value"
        :error="
          teams.isError.value
            ? `Couldn't load your Teams. Check your connection and try again.`
            : undefined
        "
        :empty="teams.data.value?.length === 0"
      >
        <template #actions>
          <Button v-if="teams.data.value?.length" as-child :size="wide ? 'sm' : 'default'">
            <NuxtLink to="/teams/new">{{ wide ? 'New' : 'New Team' }}</NuxtLink>
          </Button>
        </template>

        <template #empty>
          <Card data-testid="teams-empty">
            <CardHeader>
              <CardTitle>No Teams yet</CardTitle>
              <CardDescription>Import a Team from Showdown or build one here.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button as-child size="lg" class="w-full sm:w-auto">
                <NuxtLink to="/teams/new">Add your first Team</NuxtLink>
              </Button>
            </CardFooter>
          </Card>
        </template>

        <template #default="{ listStyle }">
          <ListRows
            :items="teams.data.value ?? []"
            :list-style="listStyle"
            :wide="wide"
            :selected-id="selectedId"
            base="/teams"
            :group-by="groupBy"
            data-testid="teams-list"
          >
            <template #default="{ item }">
              <TeamSummary :team="item" :list-style="listStyle" :condensed="wide" />
            </template>
          </ListRows>
        </template>
      </ListColumn>
    </template>
    <NuxtPage />
  </ListDetail>
</template>

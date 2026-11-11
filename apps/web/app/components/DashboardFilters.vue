<script setup lang="ts">
import {
  EVENT_TIERS,
  EVENT_TIER_LABELS,
  REGULATIONS,
  type AppliedFilters,
  type EventTier,
} from '@myvgc/core/schema'
import type { FilterChanges, FilterQuery } from '@/composables/useFilterQuery'

// The dashboard's filters: Regulation and Season up front, dates, Event tier and setting behind
// "More filters". The slot adds a page's own filters to the first row.
const props = defineProps<{ query: FilterQuery; applied: AppliedFilters | undefined }>()
const emit = defineEmits<{ change: [changes: FilterChanges] }>()
const setFilters = (changes: FilterChanges) => emit('change', changes)

const calendar = useCalendar()
const isCurrent = (reg: string) => reg === calendar.data.value?.currentRegulation

// Choosing a Season sets the dates; editing a date leaves the Season behind.
const chooseSeason = (season: string) =>
  setFilters({ season: season || undefined, from: undefined, to: undefined })
const chooseDate = (field: 'from' | 'to', value: string) =>
  setFilters({
    season: undefined,
    from: props.applied?.from ?? undefined,
    to: props.applied?.to ?? undefined,
    [field]: value || undefined,
  })
function toggleTier(tier: EventTier) {
  const tiers = props.query.eventTier
  setFilters({
    eventTier: tiers.includes(tier) ? tiers.filter((t) => t !== tier) : [...tiers, tier],
  })
}
const showFilters = ref(false)
const activeFilterCount = computed(
  () =>
    (props.query.season || props.query.from || props.query.to ? 1 : 0) +
    (props.query.eventTier.length ? 1 : 0) +
    (props.query.setting ? 1 : 0),
)
const settings = [
  { value: '', label: 'Anywhere' },
  { value: 'in-person', label: 'In person' },
  { value: 'online', label: 'Online' },
]
</script>

<template>
  <section aria-label="Filters" class="flex flex-col gap-3 rounded-lg border p-3">
    <div class="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
      <div class="flex flex-col gap-1.5">
        <Label for="filter-regulation" class="text-xs">Regulation</Label>
        <NativeSelect
          id="filter-regulation"
          :model-value="applied?.regulation ?? query.regulation ?? ''"
          class="w-full sm:w-48"
          @change="(e: Event) => setFilters({ regulation: (e.target as HTMLSelectElement).value })"
        >
          <NativeSelectOption v-for="reg in REGULATIONS" :key="reg" :value="reg">
            {{ reg }}{{ isCurrent(reg) ? ' (current)' : '' }}
          </NativeSelectOption>
          <NativeSelectOption value="all">All</NativeSelectOption>
        </NativeSelect>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="filter-season" class="text-xs">Season</Label>
        <NativeSelect
          id="filter-season"
          :model-value="query.season ?? ''"
          class="w-full sm:w-48"
          @change="(e: Event) => chooseSeason((e.target as HTMLSelectElement).value)"
        >
          <NativeSelectOption value="">Any time</NativeSelectOption>
          <NativeSelectOption
            v-for="season in calendar.data.value?.seasons ?? []"
            :key="season.id"
            :value="season.id"
            >{{ season.name }}</NativeSelectOption
          >
        </NativeSelect>
      </div>
      <slot />
      <Button
        variant="ghost"
        size="sm"
        class="col-span-2 justify-self-start"
        :aria-expanded="showFilters"
        aria-controls="more-filters"
        @click="showFilters = !showFilters"
      >
        {{ showFilters ? 'Fewer filters' : 'More filters' }}
        <template v-if="activeFilterCount && !showFilters"> ({{ activeFilterCount }})</template>
      </Button>
    </div>

    <div v-if="showFilters" id="more-filters" class="flex flex-col gap-3">
      <div class="grid grid-cols-2 gap-3 sm:max-w-sm">
        <div class="flex flex-col gap-1.5">
          <Label for="filter-from" class="text-xs">From</Label>
          <Input
            id="filter-from"
            type="date"
            :model-value="applied?.from ?? ''"
            @change="(e: Event) => chooseDate('from', (e.target as HTMLInputElement).value)"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="filter-to" class="text-xs">To</Label>
          <Input
            id="filter-to"
            type="date"
            :model-value="applied?.to ?? ''"
            @change="(e: Event) => chooseDate('to', (e.target as HTMLInputElement).value)"
          />
        </div>
      </div>
      <fieldset class="flex flex-col gap-1.5">
        <legend class="mb-1.5 text-xs font-medium">Event tier</legend>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="tier in EVENT_TIERS"
            :key="tier"
            class="has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-ring/50 flex min-h-9 cursor-pointer items-center rounded-full border px-3 text-sm has-[:focus-visible]:ring-3"
          >
            <input
              type="checkbox"
              class="sr-only"
              :checked="query.eventTier.includes(tier)"
              @change="toggleTier(tier)"
            />
            {{ EVENT_TIER_LABELS[tier] }}
          </label>
        </div>
      </fieldset>
      <fieldset class="flex flex-col gap-1.5">
        <legend class="mb-1.5 text-xs font-medium">Where</legend>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="option in settings"
            :key="option.value"
            class="has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-ring/50 flex min-h-9 cursor-pointer items-center rounded-full border px-3 text-sm has-[:focus-visible]:ring-3"
          >
            <input
              type="radio"
              name="setting"
              class="sr-only"
              :checked="(query.setting ?? '') === option.value"
              @change="setFilters({ setting: option.value || undefined })"
            />
            {{ option.label }}
          </label>
        </div>
      </fieldset>
    </div>
  </section>
</template>

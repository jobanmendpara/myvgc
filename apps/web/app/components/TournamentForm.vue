<script setup lang="ts">
import {
  BEST_OF,
  EVENT_TIERS,
  EVENT_TIER_LABELS,
  MAX_NOTES_LENGTH,
  MAX_SHORT_TEXT_LENGTH,
  MAX_TOURNAMENT_NAME_LENGTH,
  REGULATIONS,
  type BestOf,
  type EventTier,
  type Regulation,
  regulationOn,
} from '@myvgc/core/schema'

export interface TournamentFormValues {
  name: string
  startDate: string
  endDate: string
  eventTier: EventTier
  online: boolean
  regulation: Regulation
  defaultBestOf: BestOf
  location: string
  notes: string
}

const props = defineProps<{
  /** What the form starts with. A new Tournament leaves the Regulation to follow the date. */
  initial: TournamentFormValues
  /** Whether the Regulation was chosen already (editing), so dates don't change it. */
  regulationChosen?: boolean
  fieldErrors?: Record<string, string>
  pending: boolean
  submitLabel: string
  cancelTo: string
}>()
const emit = defineEmits<{ submit: [values: TournamentFormValues] }>()

const form = reactive<TournamentFormValues>({ ...props.initial })

// The Regulation follows the start date until the User picks one themselves.
const regulationTouched = ref(props.regulationChosen ?? false)
watch(
  () => form.startDate,
  (date) => {
    if (!regulationTouched.value && /^\d{4}-\d{2}-\d{2}$/.test(date))
      form.regulation = regulationOn(date)
  },
)

const settings = [
  { value: false, label: 'In person' },
  { value: true, label: 'Online' },
] as const
const bestOfOptions = BEST_OF.map((value) => ({ value, label: `Best of ${value}` }))

const error = (field: string) => props.fieldErrors?.[field]
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="emit('submit', { ...form })">
    <div class="flex flex-col gap-2">
      <Label for="name">Name</Label>
      <Input
        id="name"
        v-model="form.name"
        autocomplete="off"
        required
        :maxlength="MAX_TOURNAMENT_NAME_LENGTH"
        :aria-invalid="error('name') ? true : undefined"
        aria-describedby="name-error"
      />
      <p v-if="error('name')" id="name-error" class="text-destructive text-sm">
        {{ error('name') }}
      </p>
    </div>

    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div class="flex flex-col gap-2">
        <Label for="start-date">Start date</Label>
        <Input
          id="start-date"
          v-model="form.startDate"
          type="date"
          required
          :aria-invalid="error('startDate') ? true : undefined"
          aria-describedby="start-date-error"
        />
        <p v-if="error('startDate')" id="start-date-error" class="text-destructive text-sm">
          {{ error('startDate') }}
        </p>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="end-date"
          >End date
          <span class="text-muted-foreground font-normal">(if more than one day)</span></Label
        >
        <Input
          id="end-date"
          v-model="form.endDate"
          type="date"
          :min="form.startDate || undefined"
          :aria-invalid="error('endDate') ? true : undefined"
          aria-describedby="end-date-error"
        />
        <p v-if="error('endDate')" id="end-date-error" class="text-destructive text-sm">
          {{ error('endDate') }}
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div class="flex flex-col gap-2">
        <Label for="event-tier">Event tier</Label>
        <NativeSelect id="event-tier" v-model="form.eventTier" class="w-full">
          <NativeSelectOption v-for="tier in EVENT_TIERS" :key="tier" :value="tier">
            {{ EVENT_TIER_LABELS[tier] }}
          </NativeSelectOption>
        </NativeSelect>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="regulation">Regulation</Label>
        <NativeSelect
          id="regulation"
          v-model="form.regulation"
          class="w-full"
          @change="regulationTouched = true"
        >
          <NativeSelectOption v-for="reg in REGULATIONS" :key="reg" :value="reg">
            Reg {{ reg }}
          </NativeSelectOption>
        </NativeSelect>
      </div>
    </div>

    <ChoiceGroup v-model="form.online" :options="settings" label="Where" name="online" />
    <ChoiceGroup
      v-model="form.defaultBestOf"
      :options="bestOfOptions"
      label="Rounds are usually"
      name="default-best-of"
    />

    <div class="flex flex-col gap-2">
      <Label for="location"
        >Location <span class="text-muted-foreground font-normal">(optional)</span></Label
      >
      <Input
        id="location"
        v-model="form.location"
        autocomplete="off"
        :maxlength="MAX_SHORT_TEXT_LENGTH"
        placeholder="Venue or city"
      />
    </div>

    <slot name="more" :form="form" :error="error" />

    <div class="flex flex-col gap-2">
      <Label for="notes"
        >Notes <span class="text-muted-foreground font-normal">(optional)</span></Label
      >
      <Textarea
        id="notes"
        v-model="form.notes"
        rows="4"
        :maxlength="MAX_NOTES_LENGTH"
        placeholder="Travel, metagame reads, lessons…"
      />
    </div>

    <slot name="problem" />

    <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button as-child variant="outline" size="lg"
        ><NuxtLink :to="props.cancelTo">Cancel</NuxtLink></Button
      >
      <Button type="submit" size="lg" :disabled="props.pending">
        {{ props.pending ? 'Saving…' : props.submitLabel }}
      </Button>
    </div>
  </form>
</template>

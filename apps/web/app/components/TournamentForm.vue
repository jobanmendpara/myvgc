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
import { useQuery } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import { type TournamentBody, formToBody } from '@/lib/tournament-form'

export interface TournamentFormValues {
  name: string
  startDate: string
  endDate: string
  eventTier: EventTier
  online: boolean
  regulation: Regulation
  defaultBestOf: BestOf
  location: string
  organizer: string
  /** As typed, such as `35.00`. */
  entryFeeAmount: string
  entryFeeCurrency: string
  championshipPoints: string
  playerCount: string
  link: string
  placement: string
  dropped: boolean
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
const emit = defineEmits<{ submit: [body: TournamentBody] }>()

const form = reactive<TournamentFormValues>({ ...props.initial })

// Amounts and counts are checked here first, since the API only sees them as numbers.
const localErrors = ref<Record<string, string>>({})
function submit() {
  const result = formToBody(form)
  localErrors.value = result.ok ? {} : result.errors
  if (result.ok) emit('submit', result.body)
}

// Organizers the User has entered before, as suggestions while typing.
const organizerSearch = refDebounced(toRef(form, 'organizer'), 250)
const organizers = useQuery({
  queryKey: computed(() => ['organizers', organizerSearch.value.trim()]),
  queryFn: () =>
    $fetch<string[]>('/api/tournaments/organizers', { query: { q: organizerSearch.value.trim() } }),
  placeholderData: (previous) => previous,
})

// The Regulation follows the start date until the User picks one themselves.
const regulationTouched = ref(props.regulationChosen ?? false)
watch(
  () => form.startDate,
  (date) => {
    if (!regulationTouched.value && /^\d{4}-\d{2}-\d{2}$/.test(date))
      form.regulation = regulationOn(date)
  },
)

const COMMON_CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY', 'MXN', 'BRL', 'NZD']

const settings = [
  { value: false, label: 'In person' },
  { value: true, label: 'Online' },
] as const
const bestOfOptions = BEST_OF.map((value) => ({ value, label: `Best of ${value}` }))

const error = (field: string) => localErrors.value[field] ?? props.fieldErrors?.[field]
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
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

    <div class="flex flex-col gap-2">
      <Label for="organizer"
        >Organizer <span class="text-muted-foreground font-normal">(optional)</span></Label
      >
      <Input
        id="organizer"
        v-model="form.organizer"
        autocomplete="off"
        list="organizer-suggestions"
        :maxlength="MAX_SHORT_TEXT_LENGTH"
        placeholder="Store, league or community"
      />
      <datalist id="organizer-suggestions">
        <option v-for="name in organizers.data.value ?? []" :key="name" :value="name" />
      </datalist>
    </div>

    <div class="grid grid-cols-[1fr_6rem] gap-3">
      <div class="flex flex-col gap-2">
        <Label for="entry-fee"
          >Entry fee <span class="text-muted-foreground font-normal">(optional)</span></Label
        >
        <Input
          id="entry-fee"
          v-model="form.entryFeeAmount"
          inputmode="decimal"
          autocomplete="off"
          placeholder="0.00"
          :aria-invalid="error('entryFee.amount') ? true : undefined"
          aria-describedby="entry-fee-error"
        />
      </div>
      <div class="flex flex-col gap-2">
        <Label for="currency">Currency</Label>
        <Input
          id="currency"
          v-model="form.entryFeeCurrency"
          autocomplete="off"
          autocapitalize="characters"
          list="currency-suggestions"
          maxlength="3"
          class="uppercase"
          :aria-invalid="error('entryFee.currency') ? true : undefined"
          aria-describedby="entry-fee-error"
        />
        <datalist id="currency-suggestions">
          <option v-for="code in COMMON_CURRENCIES" :key="code" :value="code" />
        </datalist>
      </div>
      <p
        v-if="error('entryFee.amount') || error('entryFee.currency')"
        id="entry-fee-error"
        class="text-destructive col-span-2 text-sm"
      >
        {{ error('entryFee.amount') ?? error('entryFee.currency') }}
      </p>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-2">
        <Label for="player-count">Players</Label>
        <Input
          id="player-count"
          v-model="form.playerCount"
          inputmode="numeric"
          autocomplete="off"
          :aria-invalid="error('playerCount') ? true : undefined"
          aria-describedby="player-count-error"
        />
        <p v-if="error('playerCount')" id="player-count-error" class="text-destructive text-sm">
          {{ error('playerCount') }}
        </p>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="championship-points">Championship Points</Label>
        <Input
          id="championship-points"
          v-model="form.championshipPoints"
          inputmode="numeric"
          autocomplete="off"
          :aria-invalid="error('championshipPoints') ? true : undefined"
          aria-describedby="championship-points-error"
        />
        <p
          v-if="error('championshipPoints')"
          id="championship-points-error"
          class="text-destructive text-sm"
        >
          {{ error('championshipPoints') }}
        </p>
      </div>
    </div>

    <div class="grid grid-cols-2 items-end gap-3">
      <div class="flex flex-col gap-2">
        <Label for="placement">Placement</Label>
        <Input
          id="placement"
          v-model="form.placement"
          inputmode="numeric"
          autocomplete="off"
          placeholder="e.g. 9"
          :aria-invalid="error('placement') ? true : undefined"
          aria-describedby="placement-error"
        />
      </div>
      <label class="flex min-h-9 items-center gap-2 text-sm font-medium">
        <input v-model="form.dropped" type="checkbox" class="size-5" />
        I Dropped
      </label>
      <p v-if="error('placement')" id="placement-error" class="text-destructive col-span-2 text-sm">
        {{ error('placement') }}
      </p>
    </div>

    <div class="flex flex-col gap-2">
      <Label for="link"
        >Link <span class="text-muted-foreground font-normal">(optional)</span></Label
      >
      <Input
        id="link"
        v-model="form.link"
        type="url"
        inputmode="url"
        autocomplete="off"
        placeholder="RK9, Limitless or start.gg page"
        :aria-invalid="error('link') ? true : undefined"
        aria-describedby="link-error"
      />
      <p v-if="error('link')" id="link-error" class="text-destructive text-sm">
        {{ error('link') }}
      </p>
    </div>

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

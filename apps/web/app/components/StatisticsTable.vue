<script setup lang="ts">
import type { CountedRound } from '@myvgc/core/schema'
import { percent } from '@/lib/format'
import { rowSpecies, spriteSize } from '@/lib/sprites'
import type { StatisticsTableRow, StatisticsTableView } from '@/lib/statistics-tables'

// One Statistics table: a row per species or Lead pair with its sample size, its outcome (the
// W-L-T, or how many Games it was Brought in) and its rate. Sorted by sample size until a column
// header is chosen; a rate from fewer than three is dimmed, as it says little. Clicking a row
// lists the Rounds or Games behind it.
const props = defineProps<{
  table: StatisticsTableView
  /** The Rounds the rows count, by id. */
  rounds: Record<string, CountedRound>
}>()

// The row whose Rounds or Games are listed, by key.
const expanded = ref<string>()
const toggle = (key: string) => (expanded.value = expanded.value === key ? undefined : key)

const SMALL_SAMPLE = 3
type Column = 'name' | 'played' | 'outcome' | 'rate'
const sort = ref<{ column: Column; descending: boolean }>({ column: 'played', descending: true })

const value = (row: StatisticsTableRow, column: Column) =>
  column === 'rate' ? (row.rate ?? -1) : row[column]

const sorted = computed(() => {
  const { column, descending } = sort.value
  const direction = descending ? -1 : 1
  return [...props.table.rows].sort((a, b) => {
    const x = value(a, column)
    const y = value(b, column)
    const order = typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)
    return order * direction || b.played - a.played || a.name.localeCompare(b.name)
  })
})

function sortBy(column: Column) {
  sort.value =
    sort.value.column === column
      ? { column, descending: !sort.value.descending }
      : { column, descending: column !== 'name' }
}
const ariaSort = (column: Column) =>
  sort.value.column === column ? (sort.value.descending ? 'descending' : 'ascending') : 'none'

const id = useId()
// A Lead pair's key has a space in it, which an id can't.
const panelId = (key: string) => `${id}-${key.replace(/\s+/g, '-')}`
// A number never wraps, so a record such as 1-0-0 stays on one line and the species column gives
// way instead; the padding keeps neighbouring numbers apart (DEV-190). Headings may still wrap
// between words ("Win / rate"), but not at W-L-T's dashes.
const NUMBER = 'pl-2 text-right whitespace-nowrap'
const columns = computed(() => {
  const { headings, unit } = props.table
  return [
    { column: 'name', label: headings.name, align: 'text-left' },
    { column: 'played', label: unit, align: 'pl-2 text-right' },
    { column: 'outcome', label: headings.outcome, align: NUMBER },
    { column: 'rate', label: headings.rate, align: 'pl-2 text-right' },
  ] satisfies { column: Column; label: string; align: string }[]
})

const { style: spriteStyle } = useSpriteStyle()
// Stacked tiles overlap a Lead pair. The front Sprite is outlined in the page's background
// colour, tracing its shape, so two dark or busy Sprites never blend into one; a missing front
// Sprite's dashed circle is filled, so its partner doesn't show through it (DEV-189).
const STACKED_PAIR = [
  '[&>*+*]:-ml-3',
  '[&>*+*]:[filter:drop-shadow(2px_0_0_var(--background))_drop-shadow(-2px_0_0_var(--background))_drop-shadow(0_2px_0_var(--background))_drop-shadow(0_-2px_0_var(--background))]',
  '[&>*+[data-testid=sprite-gap]]:bg-background',
]
// The Leading slot keeps room for two Sprites (and the 2 px between them) on every row.
const slotWidth = computed(() =>
  spriteStyle.value === 'leading-slot'
    ? { width: `${spriteSize('statistics-row', 'leading-slot') * 2 + 2}px` }
    : undefined,
)
</script>

<template>
  <section :aria-labelledby="id" class="flex flex-col gap-2">
    <h2 :id="id" class="font-semibold">{{ table.title }}</h2>
    <p class="text-muted-foreground text-xs">{{ table.coverage }}</p>
    <div v-if="table.rows.length" class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-muted-foreground text-xs">
          <tr>
            <th
              v-for="c in columns"
              :key="c.column"
              scope="col"
              :aria-sort="ariaSort(c.column)"
              class="py-1 font-medium"
              :class="c.align"
            >
              <button
                type="button"
                class="hover:text-foreground focus-visible:ring-ring/50 inline-flex min-h-8 items-center gap-1 rounded outline-none focus-visible:ring-3"
                @click="sortBy(c.column)"
              >
                {{ c.label }}
                <span v-if="sort.column === c.column" aria-hidden="true">{{
                  sort.descending ? '↓' : '↑'
                }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <template v-for="row in sorted" :key="row.key">
            <tr class="hover:bg-muted/50 cursor-pointer" @click="toggle(row.key)">
              <td class="py-2">
                <button
                  type="button"
                  class="focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded text-left outline-none focus-visible:ring-3"
                  :aria-expanded="expanded === row.key"
                  :aria-controls="panelId(row.key)"
                >
                  <span aria-hidden="true" class="text-muted-foreground w-3 text-xs">{{
                    expanded === row.key ? '▾' : '▸'
                  }}</span>
                  <!-- Inline: side by side. Leading slot: a fixed slot two Sprites wide, so
                       names line up. Stacked tiles: a Lead pair overlapping. -->
                  <span
                    class="flex shrink-0 items-center"
                    :class="spriteStyle === 'stacked-tiles' ? STACKED_PAIR : 'gap-0.5'"
                    :style="slotWidth"
                  >
                    <Sprite
                      v-for="species in rowSpecies(row.key)"
                      :key="species"
                      :species="species"
                      surface="statistics-row"
                    />
                  </span>
                  {{ row.name }}
                </button>
              </td>
              <td class="py-2 tabular-nums" :class="NUMBER">{{ row.played }}</td>
              <td class="py-2 tabular-nums" :class="NUMBER">{{ row.outcomeLabel }}</td>
              <td
                class="py-2 font-semibold tabular-nums"
                :class="[
                  NUMBER,
                  { 'text-muted-foreground font-normal': row.played < SMALL_SAMPLE },
                ]"
                :title="
                  row.played < SMALL_SAMPLE ? `Fewer than ${SMALL_SAMPLE} ${table.unit}` : undefined
                "
              >
                {{ percent(row.rate) }}
              </td>
            </tr>
            <tr v-if="expanded === row.key" :id="panelId(row.key)">
              <td colspan="4" class="pb-2">
                <StatisticsCounted :counted="row.counted" :rounds="rounds" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </section>
</template>

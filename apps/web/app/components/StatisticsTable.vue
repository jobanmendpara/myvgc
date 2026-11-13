<script setup lang="ts">
import type { Counted, CountedRound, Rate } from '@myvgc/core/schema'
import { formatRecord } from '@myvgc/core/schema'
import { percent } from '@/lib/format'

export type StatisticsTableRow = {
  key: string
  name: string
  played: number
  /** The Rounds or Games the row counts. */
  counted: Counted[]
} & (Rate | { brought: number; bringRate: number })

// One Statistics table: a row per species or Lead pair with its sample size, W-L-T and win
// rate, or for the bring-rate table how many Games it was Brought in and its bring rate. Sorted
// by sample size until a column header is chosen; a rate from fewer than three is dimmed, as it
// says little. Clicking a row lists the Rounds or Games behind it.
const props = defineProps<{
  title: string
  /** What the rows measure: the User's win rate (the default) or a species' bring rate. */
  measure?: 'winRate' | 'bringRate'
  /** What the sample counts: Rounds or Games. */
  unit: 'Rounds' | 'Games'
  /** The first column's heading, such as Species or Leads. */
  nameHeading: string
  rows: StatisticsTableRow[]
  coverage: string
  /** The Rounds the rows count, by id. */
  rounds: Record<string, CountedRound>
}>()

// The row whose Rounds or Games are listed, by key.
const expanded = ref<string>()
const toggle = (key: string) => (expanded.value = expanded.value === key ? undefined : key)

const SMALL_SAMPLE = 3
type Column = 'name' | 'played' | 'record' | 'winRate'
const sort = ref<{ column: Column; descending: boolean }>({ column: 'played', descending: true })

const count = (row: StatisticsTableRow) => ('wins' in row ? row.wins : row.brought)
const rateOf = (row: StatisticsTableRow) => ('winRate' in row ? row.winRate : row.bringRate)
const value = (row: StatisticsTableRow, column: Column) =>
  column === 'name'
    ? row.name
    : column === 'played'
      ? row.played
      : column === 'record'
        ? count(row)
        : (rateOf(row) ?? -1)

const sorted = computed(() => {
  const { column, descending } = sort.value
  const direction = descending ? -1 : 1
  return [...props.rows].sort((a, b) => {
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
const columns: { column: Column; label: () => string; align: string }[] = [
  { column: 'name', label: () => props.nameHeading, align: 'text-left' },
  { column: 'played', label: () => props.unit, align: 'text-right' },
  {
    column: 'record',
    label: () => (props.measure === 'bringRate' ? 'Brought' : 'W-L-T'),
    align: 'text-right',
  },
  {
    column: 'winRate',
    label: () => (props.measure === 'bringRate' ? 'Bring rate' : 'Win rate'),
    align: 'text-right',
  },
]
</script>

<template>
  <section :aria-labelledby="id" class="flex flex-col gap-2">
    <h2 :id="id" class="font-semibold">{{ title }}</h2>
    <p class="text-muted-foreground text-xs">{{ coverage }}</p>
    <div v-if="rows.length" class="overflow-x-auto">
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
                {{ c.label() }}
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
                  {{ row.name }}
                </button>
              </td>
              <td class="py-2 text-right tabular-nums">{{ row.played }}</td>
              <td class="py-2 text-right tabular-nums">
                {{ 'wins' in row ? formatRecord(row) : row.brought }}
              </td>
              <td
                class="py-2 text-right font-semibold tabular-nums"
                :class="{ 'text-muted-foreground font-normal': row.played < SMALL_SAMPLE }"
                :title="
                  row.played < SMALL_SAMPLE ? `Fewer than ${SMALL_SAMPLE} ${unit}` : undefined
                "
              >
                {{ percent(rateOf(row)) }}
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

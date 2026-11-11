<script setup lang="ts">
import type { Rate } from '@myvgc/core/schema'
import { formatRecord } from '@myvgc/core/schema'
import { percent } from '@/lib/format'

export type StatisticsTableRow = Rate & { key: string; name: string; played: number }

// One Statistics table: a row per species or Lead pair with its sample size, W-L-T and win
// rate. Sorted by sample size until a column header is chosen; a win rate from fewer than
// three is dimmed, as it says little.
const props = defineProps<{
  title: string
  /** What the sample counts: Rounds or Games. */
  unit: 'Rounds' | 'Games'
  /** The first column's heading, such as Species or Leads. */
  nameHeading: string
  rows: StatisticsTableRow[]
  coverage: string
}>()

const SMALL_SAMPLE = 3
type Column = 'name' | 'played' | 'record' | 'winRate'
const sort = ref<{ column: Column; descending: boolean }>({ column: 'played', descending: true })

const value = (row: StatisticsTableRow, column: Column) =>
  column === 'name'
    ? row.name
    : column === 'played'
      ? row.played
      : column === 'record'
        ? row.wins
        : (row.winRate ?? -1)

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
const columns: { column: Column; label: () => string; align: string }[] = [
  { column: 'name', label: () => props.nameHeading, align: 'text-left' },
  { column: 'played', label: () => props.unit, align: 'text-right' },
  { column: 'record', label: () => 'W-L-T', align: 'text-right' },
  { column: 'winRate', label: () => 'Win rate', align: 'text-right' },
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
          <tr v-for="row in sorted" :key="row.key">
            <td class="py-2">{{ row.name }}</td>
            <td class="py-2 text-right tabular-nums">{{ row.played }}</td>
            <td class="py-2 text-right tabular-nums">{{ formatRecord(row) }}</td>
            <td
              class="py-2 text-right font-semibold tabular-nums"
              :class="{ 'text-muted-foreground font-normal': row.played < SMALL_SAMPLE }"
              :title="row.played < SMALL_SAMPLE ? `Fewer than ${SMALL_SAMPLE} ${unit}` : undefined"
            >
              {{ percent(row.winRate) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

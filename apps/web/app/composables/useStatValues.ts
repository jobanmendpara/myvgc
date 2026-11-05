import { type StatPoints, type StatValues, statValues } from '@myvgc/core/schema'

/**
 * A Pokémon build's stat values, worked out on the device from the base stats in the names list.
 * Undefined until there's a species and the names list has its base stats.
 */
export function useStatValues(
  build: MaybeRefOrGetter<{
    species?: string | null
    nature?: string
    statPoints: StatPoints
  }>,
) {
  const names = useChampionsNames()
  return computed<StatValues | undefined>(() => {
    const { species, nature, statPoints } = toValue(build)
    const baseStats = species ? names.data.value?.baseStats[species] : undefined
    return baseStats && statValues(baseStats, statPoints, nature || undefined)
  })
}

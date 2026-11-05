import { REGULATION_MODS } from './calendar'
import { modDexes } from './champions'
import type { Legality, LegalityBuild, LegalityProblem, Regulation } from './team'

/** Species tags a Regulation bans. Sub-Legendary Pokémon are allowed. */
const BANNED_TAGS = ['Mythical', 'Restricted Legendary']

/** An entry's display name, or the stored ID when the data doesn't have it. */
const nameOf = (entry: { exists: boolean; name: string }, id: string) =>
  entry.exists ? entry.name : id

/** The first entry of each group sharing a key with another entry. */
function repeatedBy<T>(entries: readonly T[], key: (entry: T) => unknown): T[] {
  const keys = entries.map(key)
  return entries.filter(
    (_, index) => keys.indexOf(keys[index]) === index && keys.lastIndexOf(keys[index]) !== index,
  )
}

/**
 * Judges Pokémon builds against a Regulation's rules (ADR 18). This is a warning a Team can always
 * save past, so anything the data doesn't have, such as a name dropped by a data update, is one
 * more problem rather than a failure. Learnsets aren't checked yet.
 */
export function judgeTeam(pokemon: readonly LegalityBuild[], regulation: Regulation): Legality {
  const mod = REGULATION_MODS[regulation]
  if (!mod) return { regulation, status: 'unchecked', problems: [] }

  const dex = modDexes[mod]
  const problems: LegalityProblem[] = []
  const notAllowed = (name: string) => `${name} isn't allowed in Reg ${regulation}.`

  pokemon.forEach((build, index) => {
    if (build.species === null) return
    const path = (field: string): LegalityProblem['path'] => ['pokemon', index, field]

    const species = dex.species.get(build.species)
    const name = nameOf(species, build.species)
    const banned = species.tags.find((tag) => BANNED_TAGS.includes(tag))
    if (banned) {
      problems.push({
        path: path('species'),
        message: `${name} is a ${banned} Pokémon, banned in Reg ${regulation}.`,
      })
    } else if (!species.exists || species.isNonstandard) {
      problems.push({ path: path('species'), message: notAllowed(name) })
    }

    if (build.ability && species.exists) {
      // A form that only exists in battle, such as a Mega, starts with its base form's ability.
      const forms = [species, ...[species.battleOnly ?? []].flat().map((n) => dex.species.get(n))]
      const own = forms.flatMap((form) => Object.values(form.abilities))
      const ability = dex.abilities.get(build.ability)
      if (!own.some((abilityName) => dex.abilities.get(abilityName).id === ability.id)) {
        problems.push({
          path: path('ability'),
          message: `${name} can't have ${nameOf(ability, build.ability)}.`,
        })
      }
    }

    if (build.item) {
      const item = dex.items.get(build.item)
      if (!item.exists || item.isNonstandard) {
        problems.push({
          path: path('item'),
          message: notAllowed(nameOf(item, build.item)),
        })
      }
    }
  })

  const allSpecies = pokemon.flatMap((build) =>
    build.species === null ? [] : [dex.species.get(build.species)],
  )
  const known = allSpecies.filter((species) => species.exists)
  for (const repeated of repeatedBy(known, (species) => species.num)) {
    problems.push({
      path: ['pokemon'],
      message: `Species Clause: more than one ${repeated.baseSpecies}.`,
    })
  }
  const items = pokemon.flatMap((build) =>
    build.species !== null && build.item ? [dex.items.get(build.item)] : [],
  )
  for (const repeated of repeatedBy(items, (item) => item.id)) {
    problems.push({
      path: ['pokemon'],
      message: `Item Clause: more than one ${nameOf(repeated, repeated.id)}.`,
    })
  }

  return { regulation, status: problems.length ? 'illegal' : 'legal', problems }
}
